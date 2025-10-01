<script setup lang="ts">
import { ref, onBeforeUpdate, shallowRef } from 'vue';
import VisualizerBalls from '@/visualizers/balls/Component.vue';
import VisualizerSquares from '@/visualizers/squares/Component.vue';
import VisualizerStars from '@/visualizers/stars/Component.vue';
import VisualizerBars from '@/visualizers/bars/Component.vue';
import VisualizerFutures from '@/visualizers/futures/Component.vue';
import VisualizerRevlogs from '@/visualizers/revlogs/Component.vue';
import type { VisualizerInfo } from '@/types/visualizers';

defineProps<{
    info: VisualizerInfo | null,
    selectedCardId: number | null,
}>();

const emit = defineEmits<{
    (e: 'clicked', id: number | null): void;
}>();

const allVisualizers = shallowRef([
    VisualizerBalls,
    VisualizerSquares,
    VisualizerStars,
    VisualizerBars,
    VisualizerFutures,
    VisualizerRevlogs
]);

const visualizerRefs = ref<any[]>([]);

onBeforeUpdate(() => {
    visualizerRefs.value = [];
});

function handle_clicked(id: number | null) {
    emit('clicked', id);
}

function renderFrame(time: number) {
    for (const visualizer of visualizerRefs.value) {
        if (visualizer && typeof visualizer.renderFrame === 'function') {
            visualizer.renderFrame(time);
        }
    }
}

defineExpose({ renderFrame });
</script>

<template>
    <div class="grid-container">
        <div v-for="(visualizerComponent, index) in allVisualizers" :key="index" class="grid-item">
            <component :is="visualizerComponent" :ref="el => { if (el) visualizerRefs[index] = el; }" :info="info"
                :selectedCardId="selectedCardId" @clicked="handle_clicked" />
        </div>
    </div>
</template>

<style scoped>
.grid-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    width: 100%;
    height: 100%;
    gap: 1px;
}

.grid-item {
    overflow: hidden;
}
</style>
