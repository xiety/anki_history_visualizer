<template>
    <div class="parameters">
        <Parameter name="Ball size" v-model="ball_size" :step="1" :min="1" :max="20" />
        <Parameter name="Max stability" v-model="max_stability" :step="1" :min="30" :max="1000" />
    </div>
    <canvas class="canvas" ref="canvas" :width=props.width :height=props.height
        :style="{ width: props.width + 'px', height: props.height + 'px' }" @mouseup="handle_mouseup"></canvas>
</template>

<script setup lang="ts">
import Parameter from './Parameter.vue';
import { type Card } from './api';
import { nextTick, onMounted, ref, watch } from 'vue';
import { last, rainbow } from './utils';

const props = defineProps({
    records: { type: Array<Card>, required: true },
    slider_value: { type: Number, required: true },
    selected_card_id: { type: Number },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
});

const emit = defineEmits<{
    clicked: [id: number],
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

const default_ball_size = 4;
const default_max_stability = 365;

const ball_size = ref<number>(default_ball_size);
const max_stability = ref<number>(default_max_stability);

const stroke_width = 3;

let angles: CardWithAngle[] = [];
let circles: Circle[] = [];

watch([() => props.records], precalculate);
watch([() => props.slider_value, ball_size, max_stability], refresh_canvas);
watch([() => props.width, () => props.height], () => nextTick(refresh_canvas));
watch([() => props.selected_card_id], draw);

onMounted(() => {
    if (canvas.value)
        ctx.value = canvas.value.getContext('2d');

    precalculate();
});

function find_circle(e: MouseEvent) {
    if (!canvas.value)
        return undefined;

    const rect = canvas.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const circle = last(circles, (a) => is_inside(a, x, y));

    return circle;
}

function handle_mouseup(e: MouseEvent) {
    const circle = find_circle(e);

    if (circle) {
        emit('clicked', circle.card_id);
    }
}

function precalculate() {
    angles = [];
    const max_angle = 2.0 * Math.PI;

    for (const card of props.records) {
        const angle = Math.random() * max_angle;
        angles.push({ card, angle });
    }

    refresh_canvas();
}

function generate() {
    circles = [];

    const center_x = props.width / 2.0;
    const center_y = props.height / 2.0;

    for (const { card, angle } of angles) {
        const revlogNext = card.steps.find((a) => a.day > props.slider_value);

        if (revlogNext) {
            const revlogPrev = last(card.steps, (a) => a.day <= props.slider_value);

            if (revlogPrev) {
                const percent = Math.min(Math.max((revlogNext.day - props.slider_value) / revlogNext.stability, 0), 1);
                const distance = percent * props.width;
                const { x, y } = calc_position(distance, angle, center_x, center_y);

                const stability_percent = Math.min(Math.max(revlogNext.stability / Math.max(1, max_stability.value), 0), 0.99);
                const color = rainbow(stability_percent);

                const size = ball_size.value;
                circles.push({ card_id: card.card_id, x: x, y: y, radius: size / 2, color: color });
            } else {
                const percent = Math.min(Math.max(props.slider_value / revlogNext.stability, 0), 1);
                const distance = (1.0 - percent) * props.width;
                const { x, y } = calc_position(distance, angle, center_x, center_y);

                const size = ball_size.value / 2;
                circles.push({ card_id: card.card_id, x: x, y: y, radius: size / 2, color: 'gray' });
            }
        }
    }
}

function calc_position(distance: number, angle: number, center_x: number, center_y: number) {
    let x = Math.sin(angle) * distance + center_x;
    let y = Math.cos(angle) * distance + center_y;

    const p = 1.0 - Math.exp(-distance / 100);
    const funnel = 175.0;
    y -= funnel * p;

    const tilt_factor = 0.8;
    const scale_factor = tilt_factor + (1 - tilt_factor) * ((y + 150) / (props.height + 150));
    x = center_x + (x - center_x) * scale_factor;
    y = props.height - (props.height - y) * tilt_factor;

    return { x, y };
}

function refresh_canvas() {
    generate();
    draw();
}

function draw() {
    if (!ctx.value)
        return;

    ctx.value.clearRect(0, 0, props.width, props.height);

    ctx.value.lineWidth = 1;
    ctx.value.font = '12px serif';
    ctx.value.fillStyle = 'gray';
    ctx.value.strokeStyle = 'gray';

    ctx.value.strokeStyle = 'white';
    ctx.value.lineWidth = stroke_width;

    for (const circle of circles) {
        ctx.value.beginPath();
        ctx.value.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI, false);
        ctx.value.fillStyle = circle.color;
        ctx.value.fill();

        if (circle.card_id === props.selected_card_id) {
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
};

type CardWithAngle = {
    card: Card;
    angle: number;
};

function is_inside(circle: Circle, x: number, y: number): boolean {
    var distance_sq = Math.pow(circle.x - x, 2) + Math.pow(circle.y - y, 2);
    return distance_sq < (Math.pow(circle.radius + stroke_width, 2));
}
</script>

<style scoped>
.canvas {
    background: black;
}

.parameters {
    display: flex;
    align-items: center;
    gap: 1em;
    margin-bottom: 2px;
}
</style>
