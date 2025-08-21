<template>
    <div class="component-wrapper">
        <div class="parameters">
            <Parameter name="Size" v-model="square_size" :step="1" :min="2" :max="16" />
            <Parameter name="Max stab." v-model="max_stability" :step="1" :min="30" :max="1000" />
            <Parameter name="Mov. speed" v-model="movement_speed" :step="1" :min="1" :max="50" />
            <div class="fps-counter">FPS: {{ fps_display }}</div>
        </div>
        <canvas class="canvas" ref="canvasEl" :width="props.width" :height="props.height" @mouseup="handle_mouseup">
        </canvas>
    </div>
</template>

<script setup lang="ts">
import Parameter from './Parameter.vue';
import { type Card, type Revlog } from './api';
import { nextTick, onMounted, ref, watch } from 'vue';
import { lerp_color } from './utils';
import { createFpsCalculator } from './fpsCalculator';

type Square = {
    x: number;
    y: number;
    color: string;
    card_id: number;
};

const props = defineProps<{
    records: Card[];
    slider_value: number;
    selected_card_id?: number;
    width: number;
    height: number;
}>();

const emit = defineEmits<{
    clicked: [id: number],
}>();

const DEFAULT_SQUARE_SIZE = 6;
const DEFAULT_MAX_STABILITY = 120;
const DEFAULT_MOVEMENT_SPEED = 30;
const SELECTED_STROKE_WIDTH = 4;
const GRADE_COLORS = ['red', 'blue', 'green', 'yellow'];

const canvasEl = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const fps_display = ref(0);

const square_size = ref<number>(DEFAULT_SQUARE_SIZE);
const max_stability = ref<number>(DEFAULT_MAX_STABILITY);
const movement_speed = ref<number>(DEFAULT_MOVEMENT_SPEED);

let current_squares = new Map<number, Square>();
let target_squares = new Map<number, Square>();

const tick = createFpsCalculator();
const position_cache = new Map<number, Map<number, Square>>();
const active_movers = new Set<number>();

onMounted(initialize_state);

watch(() => props.slider_value, update_targets_and_movers);
watch(() => props.selected_card_id, draw);
watch([() => props.width, () => props.height], () => nextTick(refresh_canvas));

watch([square_size, max_stability], () => {
    position_cache.clear();
    update_targets_and_movers();
});

function initialize_state() {
    if (canvasEl.value) {
        ctx.value = canvasEl.value.getContext('2d');
    }

    target_squares = calculate_target_positions();
    position_cache.set(props.slider_value, target_squares);
    current_squares = structuredClone(target_squares);

    draw();
    requestAnimationFrame(animation_loop);
}

function animation_loop(current_time: number) {
    fps_display.value = tick(current_time);

    if (active_movers.size > 0) {
        for (const card_id of active_movers) {
            const current_square = current_squares.get(card_id)!;
            const target_square = target_squares.get(card_id)!;

            const diff_x = target_square.x - current_square.x;
            const diff_y = target_square.y - current_square.y;
            const distance = Math.hypot(diff_x, diff_y);
            const speed = movement_speed.value;

            if (distance > speed) {
                const ratio = speed / distance;
                current_square.x += diff_x * ratio;
                current_square.y += diff_y * ratio;
            } else {
                current_square.x = target_square.x;
                current_square.y = target_square.y;
                active_movers.delete(card_id);
            }
        }
        draw();
    }

    requestAnimationFrame(animation_loop);
}

function get_sort_value(card: Card): number {
    const revlogPrev = card.steps.findLast((a) => a.day < props.slider_value);
    return revlogPrev ? revlogPrev.day : -1;
}

function get_square_color(revlog: Revlog, revlog_index: number, card: Card): string {
    if (revlog.day === props.slider_value) {
        return GRADE_COLORS[revlog.grade - 1] ?? 'DarkCyan';
    }
    const revlogPrev = revlog_index > 0 ? card.steps[revlog_index - 1] : undefined;
    if (revlogPrev) {
        const stability_percent = Math.min(Math.max(revlog.stability_due / Math.max(1, max_stability.value), 0), 0.99);
        return lerp_color(0, 0, 0, 255, 0, 255, stability_percent);
    }
    return 'DarkCyan';
}

function calculate_target_positions(): Map<number, Square> {
    const new_targets = new Map<number, Square>();
    const records_with_sort_key = props.records.map((card) => ({ card, sort_key: get_sort_value(card) }));
    records_with_sort_key.sort((a, b) => a.sort_key - b.sort_key);

    const column_heights = new Map<number, number>();

    for (const { card } of records_with_sort_key) {
        const revlog_index = card.steps.findIndex((a) => a.day >= props.slider_value);
        const revlog = revlog_index !== -1 ? card.steps[revlog_index] : undefined;

        const new_square: Square = { card_id: card.card_id, x: 0, y: 0, color: 'black' };

        if (revlog) {
            new_square.color = get_square_color(revlog, revlog_index, card);
            const dayOffset = revlog.day - props.slider_value;
            const height = column_heights.get(dayOffset) ?? 0;
            column_heights.set(dayOffset, height + 1);
            new_square.x = dayOffset * square_size.value;
            new_square.y = props.height - (height + 1) * square_size.value;
        }

        new_targets.set(card.card_id, new_square);
    }

    return new_targets;
}

function update_targets_and_movers() {
    if (position_cache.has(props.slider_value)) {
        target_squares = position_cache.get(props.slider_value)!;
    } else {
        target_squares = calculate_target_positions();
        position_cache.set(props.slider_value, target_squares);
    }

    for (const [card_id, target_square] of target_squares) {
        const current_square = current_squares.get(card_id)!;

        current_square.color = target_square.color;

        if (current_square.x !== target_square.x || current_square.y !== target_square.y) {
            active_movers.add(card_id);
        } else {
            active_movers.delete(card_id);
        }
    }

    draw();
}

function draw() {
    const context = ctx.value;
    if (!context) return;
    context.clearRect(0, 0, props.width, props.height);

    const squares_by_color = Map.groupBy(current_squares.values(), (square) => square.color);

    context.strokeStyle = 'white';
    context.lineWidth = 1;

    for (const [color, squares_in_group] of squares_by_color) {
        context.fillStyle = color;
        context.beginPath();
        for (const square of squares_in_group) {
            context.rect(square.x, square.y, square_size.value, square_size.value);
        }
        context.fill();
        context.stroke();
    }

    if (props.selected_card_id) {
        const selected_square = current_squares.get(props.selected_card_id)!;

        context.lineWidth = SELECTED_STROKE_WIDTH;
        context.fillStyle = selected_square.color;
        context.beginPath();
        context.rect(selected_square.x, selected_square.y, square_size.value, square_size.value);
        context.fill();
        context.stroke();
    }
}

function refresh_canvas() {
    update_targets_and_movers();
    draw();
}

function handle_mouseup(e: MouseEvent) {
    if (!canvasEl.value) return;
    const rect = canvasEl.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const squares = Array.from(current_squares.values());
    const foundSquare = squares.findLast((square) => is_inside(square, x, y));

    if (foundSquare) {
        emit('clicked', foundSquare.card_id);
    }
}

function is_inside(square: Square, x: number, y: number): boolean {
    return x >= square.x && x < square.x + square_size.value &&
        y >= square.y && y < square.y + square_size.value;
}
</script>

<style scoped>
.component-wrapper {
    position: relative;
}

.fps-counter {
    font-family: monospace;
    font-size: 14px;
}

.canvas {
    background: black;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
}

.parameters {
    display: flex;
    align-items: center;
    gap: 1em;
    margin-bottom: 2px;
}
</style>
