<script setup lang="ts">
import { ref, computed, onMounted, inject, shallowRef, watch } from 'vue';
import { useMasterLoop } from '@/composables/useMasterLoop';
import type { ApiInterface, Card } from '@/services/api';
import { calculateInfo } from '@/services/stateCalculator';
import { addDays, daysBetween, dayToDate } from '@/utils';
import VisualizerBalls from '@/visualizers/balls/Component.vue';
import VisualizerSquares from '@/visualizers/squares/Component.vue';
import VisualizerStars from '@/visualizers/stars/Component.vue';
import VisualizerBars from '@/visualizers/bars/Component.vue';
import VisualizerFutures from '@/visualizers/futures/Component.vue';
import VisualizerRevlogs from '@/visualizers/revlogs/Component.vue';
import VisualizerGrid from '@/visualizers/grid/Component.vue';
import Parameter from '@/parameters/Parameter.vue';
import type { VisualizerInfo } from './types/visualizers';

const api = inject<ApiInterface>('api')!;
const isDemo = inject('isDemo', false);

const cards = shallowRef<Card[] | null>(null);
const frameCount = ref(0);
const isPlaying = ref(false);
const speed = ref(30);
const currentFrame = ref(0);
const selected_card_id = ref<number | null>(null);
const preview_card_question = ref("");
const preview_card_answer = ref("");
const min_date = ref<Date | null>(null);

const visualizerRef = ref<{ renderFrame: (time: number) => void; } | null>(null);

function renderCanvas(time: number) {
    visualizerRef.value?.renderFrame(time);
}

useMasterLoop({ isPlaying, speed, currentFrame, frameCount }, renderCanvas);

const visualizers = {
    'balls': { name: 'Balls', component: VisualizerBalls },
    'squares': { name: 'Squares', component: VisualizerSquares },
    'stars': { name: 'Stars', component: VisualizerStars },
    'bars': { name: 'Bars', component: VisualizerBars },
    'futures': { name: 'Futures', component: VisualizerFutures },
    'revlogs': { name: 'Revlogs', component: VisualizerRevlogs },
    'grid': { name: 'All', component: VisualizerGrid },
};

type VisualizerId = keyof typeof visualizers;

const activeVisualizerId = ref<VisualizerId>(isDemo ? 'grid' : 'balls');
const activeComponent = computed(() => visualizers[activeVisualizerId.value].component);

const info = computed<VisualizerInfo | null>(() => cards.value ? calculateInfo(cards.value, currentFrame.value) : null);

onMounted(async () => {
    const response = await api.get_cards();
    min_date.value = dayToDate(response.min_day);
    frameCount.value = daysBetween(min_date.value, new Date()) + 1;
    cards.value = response.cards;
});

function handle_clicked(id: number | null) {
    selected_card_id.value = id;
}

function handle_openinbrowser() {
    if (selected_card_id.value) api.open_browser(`cid:${selected_card_id.value}`);
}

function handle_opencardinfo() {
    if (selected_card_id.value) api.open_card_info();
}

async function update_card_preview() {
    if (selected_card_id.value) {
        const response = await api.card_info(selected_card_id.value);
        preview_card_question.value = response.question;
        preview_card_answer.value = response.answer;
    } else {
        preview_card_question.value = "";
        preview_card_answer.value = "";
    }
}

watch(selected_card_id, update_card_preview);

const current_date = computed(() => {
    return min_date.value ? addDays(min_date.value, currentFrame.value) : null;
});

const current_date_text = computed(() => current_date.value ? current_date.value.toLocaleDateString() : 'No data');

const padded_frame = computed(() => {
    const max_digits = String(frameCount.value).length;
    return String(currentFrame.value).padStart(max_digits > 0 ? max_digits : 1, '0');
});
</script>

<template>
    <div v-if="isDemo" id="banner">
        <h3>History Visualizer v0.7</h3>
        <p>New version is available on ankiweb.net</p>
        <p>Code: 1545338943</p>
    </div>
    <div class="container">
        <div class="modes" v-if="!isDemo">
            <div v-for="(visualizer, id) in visualizers" :key="id">
                <label>
                    <input type="radio" v-model="activeVisualizerId" :value="id">
                    {{ visualizer.name }}
                </label>
            </div>
        </div>
        <div class="visualizer-wrapper">
            <KeepAlive>
                <component :is="activeComponent" ref="visualizerRef" :info="info" :selectedCardId="selected_card_id"
                    @clicked="handle_clicked" />
            </KeepAlive>
        </div>
        <div class="bottom-controls">
            <input type="range" step="1" v-model.number="currentFrame" :min="0"
                :max="frameCount > 0 ? frameCount - 1 : 0" />
            <div class="toolbar">
                <div class="date_info">
                    <span>{{ current_date_text }}</span>
                    <span class="frame_counter">({{ padded_frame }})</span>
                </div>
                <button @click="isPlaying = !isPlaying">{{ isPlaying ? 'Stop' : 'Play' }}</button>
                <Parameter name="Speed" v-model="speed" :step="1" :min="1" :max="60" />
                <button :disabled="!selected_card_id" @click="handle_openinbrowser">Browser</button>
                <button :disabled="!selected_card_id" @click="handle_opencardinfo">Info</button>
            </div>
            <div class="card_preview">
                <div class="card_side" v-html="preview_card_question"></div>
                <div class="card_side" v-html="preview_card_answer"></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
#banner {
    position: fixed;
    top: 30%;
    left: 50%;
    transform: translate(-50%, -30%);
    padding: 24px 36px;
    border-radius: 12px;
    background: rgba(0, 0, 0, .85);
    color: #fff;
    font: 600 28px/1.4 system-ui, sans-serif;
    white-space: nowrap;
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .4);
    text-align: center;
}

.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.modes {
    flex-shrink: 0;
    user-select: none;
}

.bottom-controls {
    flex-shrink: 0;
}

.visualizer-wrapper {
    flex-grow: 1;
    min-height: 0;
    width: 100%;
}

.bottom-controls {
    display: flex;
    flex-direction: column;
}

.modes {
    display: flex;
    gap: 1em;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 1em;
    margin: 2px;
}

.toolbar button {
    white-space: nowrap;
}

.date_info {
    font-family: monospace;
    white-space: nowrap;
}

.frame_counter {
    font-size: 0.8em;
}

.card_preview {
    display: flex;
    width: 100%;
    height: 15vh;
}

.card_side {
    flex: 1;
    border: 1px solid gray;
    padding: 2px;
    overflow-y: auto;
}
</style>
