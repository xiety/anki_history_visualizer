<template>
    <div class="container">
        <canvas class="canvas" ref="canvas" :width=width :height=height
            :style="{ width: width + 'px', height: height + 'px' }" @mousemove="handle_mousemove"
            @mouseup="handle_mouseup"></canvas>
        <input type="range" step="1" v-model.number="slider_value" :min="0" :max="max_step" />
        <div class="toolbar">
            <div>{{ current_date_text }}</div>
            <button v-if="!is_playing" @click="handle_play">Play</button>
            <button v-if="is_playing" @click="handle_stop">Stop</button>
        </div>
        <div v-if="info_loaded" class="card_info">
            <div class="card_side" v-html="card_question"></div>
            <div class="card_side" v-html="card_answer"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { Api, type Card } from './api';
import { addDays, count, last, rainbow } from './utils';

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

const api = new Api();
const slider_value = ref(0);
const max_step = ref(0);
const min_date = ref<Date | null>(null);
const records = ref<Array<Card>>([]);
const card_question = ref<string>("");
const card_answer = ref<string>("");
const is_playing = ref<boolean>(false);
const hovered_card_id = ref<number | undefined>();
const info_loaded = ref<boolean>(false);

const width = 800;
const height = 600;
const day_size = 3.5;
const box_width = 5;

let circles: Circle[] = [];

watch([slider_value, records], refresh_canvas);
watch([hovered_card_id], draw);

onMounted(async () => {
    var response = await api.get_cards();
    min_date.value = new Date(response.min_day * 60 * 60 * 24 * 1000);
    max_step.value = Math.round((new Date().getTime() - min_date.value.getTime()) / (1000 * 60 * 60 * 24)) + 100;
    records.value = response.cards;
});

const current_date = computed(() => {
    return min_date.value ? addDays(min_date.value, slider_value.value) : null;
});

const current_date_text = computed(() => {
    if (!current_date.value)
        return '';

    const day = current_date.value.getDate().toString().padStart(2, '0');
    const month = (current_date.value.getMonth() + 1).toString().padStart(2, '0');
    const year = current_date.value.getFullYear();

    return `${day}.${month}.${year}`;
});

onMounted(() => {
    if (canvas.value)
        ctx.value = canvas.value.getContext('2d');
});

function handle_play() {
    if (!is_playing.value) {
        is_playing.value = true;

        window.requestAnimationFrame(handle_animation);
    }
}

function handle_stop() {
    if (is_playing.value) {
        is_playing.value = false;
    }
}

let previous_timeStamp: number | undefined;

function handle_animation(timestamp: number) {
    if (timestamp !== previous_timeStamp) {
        if (slider_value.value === max_step.value)
            slider_value.value = 0;
        else
            slider_value.value += 1;

        previous_timeStamp = timestamp;
    }

    if (is_playing.value)
        window.requestAnimationFrame(handle_animation);
}

function handle_mousemove(e: MouseEvent) {
    const circle = find_circle(e);

    if (circle && circle.card_id != hovered_card_id.value)
    {
        setTimeout(() => update_card_info(hovered_card_id.value), 100);
        hovered_card_id.value = circle.card_id;
    }
}

function find_circle(e: MouseEvent) {
    if (!canvas.value)
        return undefined;

    const rect = canvas.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const circle = last(circles, (a) => is_inside(a, x, y));

    return circle;
}

async function update_card_info(card_id: number | undefined) {
    if (card_id) {
        const response = await api.card_info(card_id);
        card_question.value = response.question;
        card_answer.value = response.answer;
        info_loaded.value = true;
    }
}

function handle_mouseup(e: MouseEvent) {
    const circle = find_circle(e);

    if (circle) {
        api.open_browser(`cid:${circle.card_id}`);
    }
}

function generate() {
    const step_width = (width - box_width) / records.value.length;
    let x = 0;

    circles = []

    for (const card of records.value) {
        const revlogPrev = last(card.steps, (a) => a.day <= slider_value.value);
        const revlogNext = card.steps.find((a) => a.day > slider_value.value);

        if (revlogNext) {
            if (revlogPrev) {
                const percent = Math.min(Math.max((revlogNext.day - slider_value.value) / revlogNext.stability, 0), 1);

                const max_height = revlogNext.stability * day_size;
                const normalize = Math.pow(max_height / 2, 2) / max_height;
                const arc = (Math.pow(max_height / 2, 2) - Math.pow(max_height / 2 - max_height * percent, 2)) / normalize;
                const y = height - arc;

                const reviews_count = count(card.steps, (a) => a.day <= slider_value.value);
                const size = 3 + (reviews_count * box_width) / 3;
                const color = rainbow(Math.min(Math.max(revlogNext.stability / 365, 0), 0.99));

                circles.push({ card_id: card.card_id, x: x + size / 2, y: y, radius: size / 2, color: color });
            } else {
                const percent = Math.min(Math.max(slider_value.value / revlogNext.stability, 0), 1);

                const max_height = revlogNext.stability * day_size;
                const arc = max_height - Math.pow(max_height * percent, 2) / max_height;
                const y = height - arc;

                const size = 1;

                circles.push({ card_id: card.card_id, x: x + size / 2, y: y, radius: size / 2, color: 'gray' });
            }
        }

        x += step_width;
    }
}

function refresh_canvas() {
    generate();
    draw();
}

function draw() {
    if (!ctx.value) return;

    ctx.value.clearRect(0, 0, width, height);

    ctx.value.lineWidth = 1;
    ctx.value.font = '12px serif';
    ctx.value.fillStyle = 'gray';
    ctx.value.strokeStyle = 'gray';

    for (let d = 30; d < (height / day_size); d += 30) {
        var y = height - d * day_size;

        ctx.value.beginPath();
        ctx.value.moveTo(0, y);
        ctx.value.lineTo(width, y);
        ctx.value.stroke();

        ctx.value.fillText(`${d}`, width - 20, y - 4, 20);
    }

    ctx.value.strokeStyle = 'white';
    ctx.value.lineWidth = 3;

    for (const circle of circles) {
        ctx.value.beginPath();
        ctx.value.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI, false);
        ctx.value.fillStyle = circle.color;
        ctx.value.fill();

        if (circle.card_id === hovered_card_id.value) {
            ctx.value.stroke();
        }
    }
}

type Circle = {
    x: number;
    y: number;
    radius: number;
    color: string;
    card_id: number;
}

function is_inside(circle: Circle, x: number, y: number): boolean {
    var distance_sq = Math.pow(circle.x - x, 2) + Math.pow(circle.y - y, 2);
    return distance_sq < (Math.pow(circle.radius, 2) + 9);
}
</script>

<style>
/* style of the body from Anki */
.isWin {
    margin: 0px;
}

.container {
    display: flex;
    flex-direction: column;
}

.canvas {
    background: black;
}

.toolbar {
    display: flex;
    align-items: center;
    margin: 2px;
}

.card_info {
    display: flex;
    width: 100%;
}

.card_side {
    flex: 1;
    border: 1px solid gray;
    padding: 2px;
}
</style>
