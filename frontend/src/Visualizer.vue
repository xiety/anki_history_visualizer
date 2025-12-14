<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { useMasterLoop } from '@/composables/useMasterLoop';
import { calculateInfo } from '@/services/stateCalculator';
import { addDays } from '@/utils';
import type { ApiInterface, Card } from '@/services/api';
import type { VisualizerInfo } from './types/visualizers';

import VisualizerBalls from '@/visualizers/balls/Component.vue';
import VisualizerSquares from '@/visualizers/squares/Component.vue';
import VisualizerStars from '@/visualizers/stars/Component.vue';
import VisualizerBars from '@/visualizers/bars/Component.vue';
import VisualizerFutures from '@/visualizers/futures/Component.vue';
import VisualizerRevlogs from '@/visualizers/revlogs/Component.vue';
import VisualizerGrid from '@/visualizers/grid/Component.vue';
import Parameter from '@/parameters/Parameter.vue';

const props = defineProps<{
    cards: Card[];
    minDate: Date;
    frameCount: number;
    selectedCardId: number | null;
}>();

const emit = defineEmits<{ (e: 'clicked', id: number | null): void; }>();

const api = inject<ApiInterface>('api')!;
const isDemo = inject('isDemo', false);

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

const isPlaying = ref(false);
const speed = ref(30);
const currentFrame = ref(0);
const visualizerRef = ref<{ renderFrame: (time: number) => void; } | null>(null);

useMasterLoop({
    isPlaying,
    speed,
    currentFrame,
    frameCount: computed(() => props.frameCount)
}, (time) => visualizerRef.value?.renderFrame(time));

const info = computed<VisualizerInfo | null>(() => calculateInfo(props.cards, currentFrame.value));

const currentDate = computed(() => addDays(props.minDate, currentFrame.value));
const currentDateText = computed(() => currentDate.value.toLocaleDateString());
const paddedFrame = computed(() => {
    const digits = String(props.frameCount).length;
    return String(currentFrame.value).padStart(digits || 1, '0');
});

function openBrowser() {
    if (props.selectedCardId) api.open_browser(`cid:${props.selectedCardId}`);
}
function openInfo() {
    if (props.selectedCardId) api.open_card_info();
}
</script>

<template>
    <div v-if="isDemo" id="banner">
        <h3>History Visualizer v0.7</h3>
        <p>New version is available on ankiweb.net</p>
        <p>Code: 1545338943</p>
    </div>

    <div class="viz-root">
        <div class="modes-bar" v-if="!isDemo">
            <div v-for="(viz, id) in visualizers" :key="id">
                <label>
                    <input type="radio" v-model="activeVisualizerId" :value="id">
                    {{ viz.name }}
                </label>
            </div>
        </div>

        <div class="canvas-wrapper">
            <component :is="activeComponent" ref="visualizerRef" :info="info" :selectedCardId="selectedCardId"
                @clicked="id => emit('clicked', id)" />
        </div>

        <div class="timeline-area">
            <input type="range" class="scrubber" v-model.number="currentFrame" :min="0"
                :max="frameCount > 0 ? frameCount - 1 : 0" />
            <div class="toolbar">
                <div class="date_info">
                    <span>{{ currentDateText }}</span>
                    <span class="frame_counter">({{ paddedFrame }})</span>
                </div>
                <button @click="isPlaying = !isPlaying">
                    {{ isPlaying ? 'Stop' : 'Play' }}
                </button>
                <Parameter name="Speed" v-model="speed" :step="1" :min="1" :max="60" />
                <button :disabled="!selectedCardId" @click="openBrowser">Browser</button>
                <button :disabled="!selectedCardId" @click="openInfo">Info</button>
                <div>{{ cards.length }}</div>
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

.viz-root {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.modes-bar {
    display: flex;
    gap: 1em;
    padding: 8px;
    user-select: none;
    flex-shrink: 0;
    overflow-x: auto;
}

.canvas-wrapper {
    flex-grow: 1;
    min-height: 0;
    position: relative;
    width: 100%;
}

.timeline-area {
    flex-shrink: 0;
    padding: 8px;
    display: flex;
    flex-direction: column;
}

.scrubber {
    width: 100%;
    margin-bottom: 8px;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 1em;
}

.date_info {
    font-family: monospace;
    white-space: nowrap;
}

.frame_counter {
    font-size: 0.8em;
}

</style>
