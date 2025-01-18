<template>
    <div class="container">
        <div class="modes">
            <div v-for="(visualizer, id) in visualizers">
                <input :id="id" type="radio" v-model="mode" :value="id">
                <label :for="id">{{ visualizer.name }}</label>
            </div>
        </div>
        <div>
            <KeepAlive>
                <component :is="visualizers[mode].component" :width="width" :height="height"
                    :slider_value="slider_value" :records="records" :selected_card_id="selected_card_id"
                    @clicked="handle_clicked" />
            </KeepAlive>
        </div>
        <input type="range" step="1" v-model.number="slider_value" :min="0" :max="max_step" />
        <div class="toolbar">
            <div class="date_info">{{ current_date_text }}</div>
            <button v-if="!is_playing" @click="handle_play">Play</button>
            <button v-if="is_playing" @click="handle_stop">Stop</button>
            <Parameter name="Speed" v-model="animation_speed" :step="1" :min="1" :max="30" />
            <button :disabled="!selected_card_id" @click="handle_openinbrowser">Open in browser</button>
            <button :disabled="!selected_card_id" @click="handle_opencardinfo">Open card info</button>
        </div>
        <div v-if="info_loaded" class="card_info">
            <div class="card_side" v-html="card_question"></div>
            <div class="card_side" v-html="card_answer"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import Parameter from './Parameter.vue';
import VisualizerCircles from './VisualizerCircles.vue';
import VisualizerSquares from './VisualizerSquares.vue';
import VisualizerFuture from './VisualizerFuture.vue';
import VisualizerStars from './VisualizerStars.vue';
import { onMounted, onUnmounted, ref, shallowRef, computed, watch, inject } from 'vue';
import { type ApiInterface, type Card } from './api';
import { addDays, format_date } from './utils';

const api = inject<ApiInterface>('api')!;

const animation_speed = ref<number>(30);
const slider_value = ref(0);
const max_step = ref(0);
const min_date = ref<Date | null>(null);
const records = shallowRef<Array<Card>>([]);
const card_question = ref<string>("");
const card_answer = ref<string>("");
const is_playing = ref<boolean>(false);
const selected_card_id = ref<number | undefined>();
const info_loaded = ref<boolean>(false);
const width = ref<number>(800);
const height = ref<number>(600);

const msInDay = 60 * 60 * 24 * 1000;
const daysToAdd = 0;

const visualizers = {
    'circles': { name: 'Circles', component: VisualizerCircles },
    'squares': { name: 'Squares', component: VisualizerSquares },
    'future': { name: 'Future', component: VisualizerFuture },
    'stars': { name: 'Stars', component: VisualizerStars },
};

const mode = ref<keyof typeof visualizers>(Object.keys(visualizers)[0] as keyof typeof visualizers);

function handle_clicked(id: number) {
    selected_card_id.value = id;
}

function handle_openinbrowser() {
    if (selected_card_id.value)
        api.open_browser(`cid:${selected_card_id.value}`);
}

function handle_opencardinfo() {
    if (selected_card_id.value)
        api.open_card_info();
}

watch([selected_card_id], update_card_info);

function handle_resize() {
    //use body to take into account the width of the vertical scroll
    width.value = document.body.clientWidth;
    //window to use viewport's height not document's
    height.value = window.innerHeight * 0.8;
}

onMounted(() => {
    window.addEventListener('resize', handle_resize);
    handle_resize();
});

onUnmounted(() => {
    window.removeEventListener('resize', handle_resize);
});

onMounted(async () => {
    var response = await api.get_cards();
    min_date.value = response.min_day ? new Date(response.min_day * msInDay) : null;
    max_step.value = min_date.value ? Math.round((new Date().getTime() - min_date.value.getTime()) / msInDay) + daysToAdd : 0;
    records.value = response.cards;
});

const current_date = computed(() => {
    return min_date.value ? addDays(min_date.value, slider_value.value) : undefined;
});

const current_date_text =
    computed(() => current_date.value ? format_date(current_date.value) : 'No data');

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

let previous_timestamp: number | undefined;

function handle_animation(timestamp: number) {
    if (!previous_timestamp)
        previous_timestamp = timestamp;

    var delta_ms = timestamp - previous_timestamp;

    if (delta_ms > (1000 / animation_speed.value)) {
        if (slider_value.value === max_step.value)
            slider_value.value = 0;
        else
            slider_value.value += 1;

        previous_timestamp = timestamp;
    }

    if (is_playing.value)
        window.requestAnimationFrame(handle_animation);
}

async function update_card_info() {
    if (selected_card_id.value) {
        const response = await api.card_info(selected_card_id.value);
        card_question.value = response.question;
        card_answer.value = response.answer;
        info_loaded.value = true;
    }
}
</script>

<style scoped>
.container {
    display: flex;
    flex-direction: column;
}

.modes {
    display: flex;
    gap: 1em;
}

.date_info {
    width: 5em;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 1em;
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
