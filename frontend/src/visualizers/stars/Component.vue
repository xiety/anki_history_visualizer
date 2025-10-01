<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useVisualizer } from '@/composables/useVisualizer';
import { logic, type Controls } from './logic';
import InteractiveCanvas from '@/components/InteractiveCanvas.vue';
import VisualizerLayout from '@/components/VisualizerLayout.vue';
import Parameter from '@/parameters/Parameter.vue';
import type { VisualizerInfo } from '@/types/visualizers';

const props = defineProps<{
    info: VisualizerInfo | null;
    selectedCardId: number | null;
}>();

const emit = defineEmits<{ (e: 'clicked', payload: number | null): void; }>();

const canvasRef = ref<InstanceType<typeof InteractiveCanvas> | null>(null);
const controls = reactive<Controls>({ starSize: 4, maxStability: 365 });

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
            <Parameter name="Size" v-model.number="controls.starSize" :min="1" :max="20" />
            <Parameter name="Stability" v-model.number="controls.maxStability" :min="30" :max="1000" />
        </template>
        <template #canvas>
            <InteractiveCanvas ref="canvasRef" :pannable="true" :virtualSize="virtualSize"
                :draw-background="drawBackground" :draw-foreground="foregroundTick" @clicked="onCanvasClick" />
        </template>
    </VisualizerLayout>
</template>
