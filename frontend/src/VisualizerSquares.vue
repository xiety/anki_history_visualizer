<template>
    <div class="parameters">
        <Parameter name="Square size" v-model="square_size" :step="1" :min="2" :max="200" />
        <Parameter name="Max stability" v-model="max_stability" :step="1" :min="30" :max="1000" />
    </div>
    <canvas class="canvas" ref="canvas" :width=props.width :height=props.height
        :style="{ width: props.width + 'px', height: props.height + 'px' }" @mouseup="handle_mouseup"></canvas>
</template>

<script setup lang="ts">
import Parameter from './Parameter.vue';
import { type Card } from './api';
import { nextTick, onMounted, ref, watch } from 'vue';
import { last, lerp_color } from './utils';

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

const default_square_size = 14;
const default_max_stability = 365;
const selected_stroke_width = 4;

const square_size = ref<number>(default_square_size);
const max_stability = ref<number>(default_max_stability);

let squares: Square[] = [];

watch([() => props.slider_value, () => props.records, square_size, max_stability], refresh_canvas);
watch([() => props.width, () => props.height], () => nextTick(refresh_canvas));
watch([() => props.selected_card_id], draw);

onMounted(() => {
    if (canvas.value)
        ctx.value = canvas.value.getContext('2d');

    refresh_canvas();
});

function find_square(e: MouseEvent) {
    if (!canvas.value)
        return undefined;

    const rect = canvas.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const square = last(squares, (a) => is_inside(a, x, y));

    return square;
}

function handle_mouseup(e: MouseEvent) {
    const square = find_square(e);

    if (square) {
        emit('clicked', square.card_id);
    }
}

const grade_colors = ['red', 'blue', 'green', 'yellow'];

function generate() {
    squares = []

    const max_x = Math.floor(props.width / square_size.value);

    let xn = 0;
    let yn = 0;

    for (const card of props.records) {
        const x = xn * square_size.value;
        const y = yn * square_size.value;

        const revlogNext = card.steps.find((a) => a.day > props.slider_value);

        let color = 'black';

        if (revlogNext) {
            const revlogPrev = last(card.steps, (a) => a.day <= props.slider_value);

            if (revlogPrev) {
                if (revlogPrev.day === props.slider_value) {
                    color = grade_colors[revlogPrev.grade - 1];
                } else {
                    const stability_percent = Math.min(Math.max(revlogNext.stability / Math.max(1, max_stability.value), 0), 0.99);
                    color = lerp_color(0, 0, 0, 255, 0, 255, stability_percent);
                }
            }
        }

        squares.push({ card_id: card.card_id, x: x, y: y, width: square_size.value, height: square_size.value, color: color });

        xn++;

        if (xn === max_x) {
            xn = 0;
            yn++;
        }
    }
}

function refresh_canvas() {
    generate();
    draw();
}

function draw() {
    if (!ctx.value)
        return;

    ctx.value.clearRect(0, 0, props.width, props.height);

    ctx.value.strokeStyle = 'white';
    ctx.value.lineWidth = 1;

    for (const square of squares) {
        ctx.value.beginPath();
        ctx.value.rect(square.x, square.y, square.width, square.height);
        ctx.value.fillStyle = square.color;
        ctx.value.fill();
        ctx.value.stroke();
    }

    ctx.value.lineWidth = selected_stroke_width;

    for (const square of squares) {
        if (square.card_id === props.selected_card_id) {
            ctx.value.beginPath();
            ctx.value.rect(square.x, square.y, square.width, square.height);
            ctx.value.stroke();
        }
    }
}

type Square = {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    card_id: number;
}

function is_inside(square: Square, x: number, y: number): boolean {
    return x >= square.x && x < square.x + square.width && y >= square.y && y < square.y + square.height;
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
