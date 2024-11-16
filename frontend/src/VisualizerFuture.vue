<template>
    <div class="parameters">
        <Parameter name="Size" v-model="square_size" :step="1" :min="2" :max="16" />
        <Parameter name="Max stab." v-model="max_stability" :step="1" :min="30" :max="1000" />
        <Parameter name="Mov. speed" v-model="movement_speed" :step="5" :min="1" :max="50" />
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

const default_square_size = 6;
const default_max_stability = 120;
const default_movement_speed = 30;
const selected_stroke_width = 4;

const square_size = ref<number>(default_square_size);
const max_stability = ref<number>(default_max_stability);
const movement_speed = ref<number>(default_movement_speed);

let current_squares: Square[] = [];
let target_squares: Square[] = [];

watch([() => props.slider_value, () => props.records, square_size, max_stability], generate);
watch([() => props.width, () => props.height], () => nextTick(refresh_canvas));
watch([() => props.selected_card_id], draw);

onMounted(() => {
    if (canvas.value)
        ctx.value = canvas.value.getContext('2d');

    initialize_squares();
    generate();
    current_squares = structuredClone(target_squares);
    draw();

    animate();
});

function find_square(e: MouseEvent) {
    if (!canvas.value)
        return undefined;

    const rect = canvas.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const square = last(current_squares, (a) => is_inside(a, x, y));

    return square;
}

function handle_mouseup(e: MouseEvent) {
    const square = find_square(e);

    if (square) {
        emit('clicked', square.card_id);
    }
}

const grade_colors = ['red', 'blue', 'green', 'yellow'];

function initialize_squares() {
    target_squares = [];

    for (const card of props.records) {
        target_squares.push({ card_id: card.card_id, x: 0, y: 0, color: 'black' });
    }
}

function compare(card_a: Card, card_b: Card): number {
    const revlogPrev_a = last(card_a.steps, (a) => a.day < props.slider_value);

    if (!revlogPrev_a)
        return -1;

    const revlogPrev_b = last(card_b.steps, (a) => a.day < props.slider_value);

    if (!revlogPrev_b)
        return 1;

    return revlogPrev_a.day - revlogPrev_b.day;
}

function generate() {
    const dic = new Map<number, number>();
    const sorted = props.records.toSorted(compare);

    for (let i = 0; i < sorted.length; ++i) {
        const card = sorted[i];
        const target_square = target_squares.find((a) => a.card_id == card.card_id)!;

        const revlog_index = card.steps.findIndex((a) => a.day >= props.slider_value);
        const revlog = revlog_index != -1 ? card.steps[revlog_index] : undefined;

        if (revlog) {
            let color = 'DarkCyan';

            if (revlog.day === props.slider_value) {
                color = grade_colors[revlog.grade - 1];
            } else {
                const revlogPrev = revlog_index > 0 ? card.steps[revlog_index - 1] : undefined;

                if (revlogPrev) {
                    const stability_percent = Math.min(Math.max(revlog.stability / Math.max(1, max_stability.value), 0), 0.99);
                    color = lerp_color(0, 0, 0, 255, 0, 255, stability_percent);
                }
            }

            var dayOffset = revlog.day - props.slider_value;

            const height = dic.get(dayOffset) ?? 0;
            dic.set(dayOffset, height + 1);

            const x = dayOffset * square_size.value;
            const y = props.height - 1 - (height + 1) * square_size.value;

            target_square.x = x;
            target_square.y = y;
            target_square.color = color;
        }
        else {
            target_square.x = 0;
            target_square.y = 0;
            target_square.color = 'black';
        }
    }
}

function animate() {
    let draw_required = false;

    for (let i = 0; i < props.records.length; ++i) {
        const target_square = target_squares[i];
        const current_square = current_squares[i];

        const diff_x = target_square.x - current_square.x;
        const diff_y = target_square.y - current_square.y;

        const length = Math.sqrt(diff_x * diff_x + diff_y * diff_y);

        let new_x = target_square.x;
        let new_y = target_square.y;
        let new_color = target_square.color;

        if (length > movement_speed.value) {
            const speed_x = (diff_x / length) * (movement_speed.value + (i / props.records.length));
            const speed_y = (diff_y / length) * movement_speed.value;

            new_x = current_square.x + speed_x;
            new_y = current_square.y + speed_y;
            new_color = current_square.color;
        }

        if (new_x != current_square.x || new_y != current_square.y || new_color != current_square.color) {
            current_square.x = new_x;
            current_square.y = new_y;
            current_square.color = new_color;
            draw_required = true;
        }
    }

    if (draw_required)
        draw();

    requestAnimationFrame(animate);
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

    for (const square of current_squares) {
        ctx.value.lineWidth = (square.card_id === props.selected_card_id) ? selected_stroke_width : 1;
        ctx.value.beginPath();
        ctx.value.rect(square.x, square.y, square_size.value, square_size.value);
        ctx.value.fillStyle = square.color;
        ctx.value.fill();
        ctx.value.stroke();
    }
}

type Square = {
    x: number;
    y: number;
    color: string;
    card_id: number;
};

function is_inside(square: Square, x: number, y: number): boolean {
    return x >= square.x && x < square.x + square_size.value && y >= square.y && y < square.y + square_size.value;
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
