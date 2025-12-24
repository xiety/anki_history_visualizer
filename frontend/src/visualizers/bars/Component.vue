<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useVisualizer } from '@/composables/useVisualizer';
import { logic, type Controls } from './logic';
import InteractiveCanvas from '@/components/InteractiveCanvas.vue';
import VisualizerLayout from '@/components/VisualizerLayout.vue';
import Parameter from '@/parameters/Parameter.vue';
import type { VisualizerInfo } from '@/types/visualizers';
import type { Card } from '@/services/api';

const props = defineProps<{
    info: VisualizerInfo | null;
    selectedCardId: number | null;
    cards: Card[];
}>();

const emit = defineEmits<{ (e: 'clicked', payload: number | null): void; }>();

const canvasRef = ref<InstanceType<typeof InteractiveCanvas> | null>(null);
const controls = reactive<Controls>({ barSize: 3, daysOnScreen: 365 });

const { renderFrame, foregroundTick, drawBackground, onCanvasClick, virtualSize } = useVisualizer(
    logic,
    props,
    controls,
    canvasRef,
    emit
);

defineExpose({ renderFrame });
</script>

<template>
    <VisualizerLayout>
        <template #controls>
            <Parameter name="Size" v-model.number="controls.barSize" :min="1" :max="10" />
            <Parameter name="Days" v-model.number="controls.daysOnScreen" :min="7" :max="1000" />
        </template>
        <template #canvas>
            <InteractiveCanvas ref="canvasRef" :pannable="true" :virtualSize="virtualSize"
                :draw-background="drawBackground" :draw-foreground="foregroundTick" @clicked="onCanvasClick"
                :align-bottom="true" />
        </template>
    </VisualizerLayout>
</template>
