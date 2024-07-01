<template>
    <div class="container">
        <canvas class="canvas" ref="canvas" width="800" height="600"></canvas>
        <input type="range" step="1" v-model.number="slider_value" :min="0" :max="max_step" />
        <div>{{ current_date_text }}</div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';

declare var pycmd: any;

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

const slider_value = ref(0);
const max_step = ref(500);
const min_date = ref<Date | null>(null)
const records = ref<Array<Card>>([]);

watch([slider_value, records], draw);

onMounted(() => {
    pycmd('get_cards', (a: any) => {
        const response = <GetCardsResponse>JSON.parse(a);
        min_date.value = new Date(response.min_day * 60 * 60 * 24 * 1000);
        max_step.value = Math.round((new Date().getTime() - min_date.value.getTime()) / (1000 * 60 * 60 * 24)) + 100;
        records.value = response.cards;
    });
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

function last<T>(arr: T[], predicate: (item: T) => boolean): T | undefined {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i]))
            return arr[i];
    }
    return undefined;
}

function draw() {
    if (!ctx.value) return;

    const width = 800;
    const height = 600;

    ctx.value.clearRect(0, 0, width, height);

    const day_size = 3.5;
    const box_width = 5;

    const step_width = (width - box_width) / records.value.length;
    let x = 0;

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

                const reviews_count = card.steps.filter(a => a.day <= slider_value.value).length;
                const size = 3 + (reviews_count * box_width) / 3;
                const color = rainbow(Math.min(Math.max(revlogNext.stability / 365, 0), 0.99));

                ctx.value.beginPath();
                ctx.value.arc(x + size / 2, y, size / 2, 0, 2 * Math.PI, false);
                ctx.value.fillStyle = color;
                ctx.value.fill();
            } else {
                const percent = Math.min(Math.max(slider_value.value / revlogNext.stability, 0), 1);

                const max_height = revlogNext.stability * day_size;
                const arc = max_height - Math.pow(max_height * percent, 2) / max_height;
                const y = height - arc;

                const size = 1;
                ctx.value.beginPath();
                ctx.value.arc(x + size / 2, y, size / 2, 0, 2 * Math.PI, false);
                ctx.value.fillStyle = 'gray';
                ctx.value.fill();
            }
        }

        x += step_width;
    }
}

function rainbow(progress: number): string {
    const div = Math.abs(progress % 1) * 5;
    const ascending = Math.floor((div % 1) * 255);
    const descending = 255 - ascending;

    switch (Math.floor(div)) {
        case 0: return `rgba(255, ${ascending}, 0, 1)`;
        case 1: return `rgba(${descending}, 255, 0, 1)`;
        case 2: return `rgba(0, 255, ${ascending}, 1)`;
        case 3: return `rgba(0, ${descending}, 255, 1)`;
        default: return `rgba(${ascending}, 0, 255, 1)`;
    }
}

function addDays(date: Date, days: number): Date {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function text_changed() {
    // const lines = text.value.split('\n');
    // min_date.value = parse_date(lines[0]);
    // records.value = parse_text(lines.splice(1));
    // recalculate();
}

// function parse_date(input: string): Date {
//     const [year, month, day] = input.split('.').map(Number);
//     return new Date(year, month - 1, day);
// }

// function parse_text(lines: Array<string>): Array<Card> {
//     return lines.slice(1).filter((line) => line != '').map((line) => {
//         const [name, id, steps] = line.split(';');
//         const stepPairs = steps.split(' ');

//         let sum = 0;
//         const parsedSteps = stepPairs.map((stepPair) => {
//             const [stability, grade] = stepPair.split(':').map(Number);
//             sum += stability;
//             return <CardStep>{ Day: sum, Stability: stability, Grade: grade };
//         });

//         return { Name: name, Id: parseInt(id), Steps: parsedSteps };
//     });
// }

type GetCardsResponse = {
    min_day: number;
    cards: Card[];
}

type CardStep = {
    day: number;
    stability: number;
    grade: number;
};

type Card = {
    note_id: number;
    card_id: number;
    steps: CardStep[];
};
</script>

<style>
.container {
    display: flex;
    flex-direction: column;
}

.canvas {
    width: 800px;
    height: 600px;
    background: black;
    border: 1px solid black;
}
</style>
