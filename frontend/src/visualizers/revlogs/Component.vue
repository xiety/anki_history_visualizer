<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useVisualizer } from '@/composables/useVisualizer';
import { logic, SortMode, type Controls } from './logic';
import InteractiveCanvas from '@/components/InteractiveCanvas.vue';
import VisualizerLayout from '@/components/VisualizerLayout.vue';
import Parameter from '@/parameters/Parameter.vue';
import ParameterCombobox from '@/parameters/ParameterCombobox.vue';
import type { VisualizerInfo } from '@/types/visualizers';
import type { Card } from '@/services/api';

const props = defineProps<{
    info: VisualizerInfo | null;
    selectedCardId: number | null;
    cards: Card[];
}>();

const emit = defineEmits<{ (e: 'clicked', payload: number | null): void; }>();

const canvasRef = ref<InstanceType<typeof InteractiveCanvas> | null>(null);
const controls = reactive<Controls>({
    zoomLevel: 0.5,
    sortMode: SortMode.FirstReview,
});

const { renderFrame, foregroundTick, drawBackground, onCanvasClick, virtualSize } = useVisualizer(
    logic,
    props,
    controls,
    canvasRef,
    emit
);

const sortModes = [
    { value: SortMode.FirstReview, text: 'First Review' },
    { value: SortMode.LastReview, text: 'Last Review' },
    { value: SortMode.DueDate, text: 'Due Date' },
    { value: SortMode.NumOfAgain, text: 'Num of Again' },
];

defineExpose({ renderFrame });
</script>

<template>
    <VisualizerLayout>
        <template #controls>
            <Parameter name="Zoom" v-model="controls.zoomLevel" :step="0.01" :min="0.05" :max="5" />
            <ParameterCombobox name="Order by" v-model="controls.sortMode" :options="sortModes" />
        </template>
        <template #canvas>
            <InteractiveCanvas ref="canvasRef" :pannable="true" :virtualSize="virtualSize"
                v-model:zoom-level="controls.zoomLevel" :draw-background="drawBackground"
                :draw-foreground="foregroundTick" @clicked="onCanvasClick" />
        </template>
    </VisualizerLayout>
</template>
