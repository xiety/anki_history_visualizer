<script lang="ts" setup>
import { ref, onMounted, shallowRef, computed, watch, inject } from 'vue';
import { usePanAndZoom } from '@/composables/usePanAndZoom';
import { useElementSize } from '@vueuse/core';
import type { CanvasSize, Viewport } from '@/types/visualizers';
import { createFpsCalculator } from '@/services/fpsCalculator';

const isDemo = inject('isDemo', false);

const props = defineProps<{
    drawForeground: (ctx: CanvasRenderingContext2D, visible: Viewport) => void;
    drawBackground?: (ctx: CanvasRenderingContext2D, canvasSize: CanvasSize, zoomLevel: number, viewport: Viewport) => void;
    virtualSize?: { width: number; height: number; } | null;
    pannable?: boolean;
    alignBottom?: boolean;
}>();

const emit = defineEmits<{ (e: 'clicked', payload: { x: number; y: number; }): void; }>();

const zoomLevel = defineModel<number>('zoomLevel', { default: 1 });
const scrollWrapper = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = shallowRef<CanvasRenderingContext2D | null>(null);
const canvasSize = ref({ width: 0, height: 0 });
const fpsCalculator = createFpsCalculator();

const { width, height } = useElementSize(scrollWrapper);
watch([width, height], ([w, h]) => {
    if (!w || !h) return;
    canvasSize.value = { width: w, height: h };
}, { immediate: true });

const backgroundCanvas = document.createElement('canvas');
const backgroundCtx = backgroundCanvas.getContext('2d');

function redrawBackground() {
    if (!backgroundCtx || !canvas.value) return;
    backgroundCtx.fillStyle = 'black';
    backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    if (props.drawBackground) {
        props.drawBackground(backgroundCtx, canvasSize.value, zoomLevel.value, panAndZoom.visible.value);
    }
}

function handleClick(payload: { x: number, y: number; }) {
    emit('clicked', payload);
}

const panAndZoom = usePanAndZoom({
    zoomLevel,
    onClick: handleClick,
    scrollWrapper,
    canvas,
    canvasSize,
    virtualSize: computed(() => props.virtualSize ?? undefined),
    scrollable: computed(() => props.pannable),
    alignBottom: computed(() => props.alignBottom ?? false)
});

watch([panAndZoom.visible, zoomLevel], redrawBackground, { immediate: true });

function renderFrame(time: number) {
    if (!canvas.value) return;

    if (canvas.value.width !== width.value || canvas.value.height !== height.value) {
        canvas.value.width = width.value;
        canvas.value.height = height.value;
    }
    if (backgroundCanvas.width !== width.value || backgroundCanvas.height !== height.value) {
        backgroundCanvas.width = width.value;
        backgroundCanvas.height = height.value;
        redrawBackground();
    }

    if (!ctx.value || canvas.value.width === 0 || canvas.value.height === 0) return;

    ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height);
    ctx.value.drawImage(backgroundCanvas, 0, 0);

    panAndZoom.withTransformedContext((transformedCtx, visible) => {
        props.drawForeground(transformedCtx, visible);
    }, ctx.value);
}

function drawFps(time: number) {
    if (!ctx.value) return;
    const currentFps = fpsCalculator(time);
    ctx.value.save();
    ctx.value.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.value.fillRect(5, 5, 95, 20);
    ctx.value.font = '14px sans-serif';
    ctx.value.fillStyle = 'white';
    ctx.value.fillText(`FPS: ${Math.round(currentFps)}`, 10, 20);
    ctx.value.restore();
}

onMounted(() => {
    if (canvas.value) {
        ctx.value = canvas.value.getContext('2d');
    }
});

defineExpose({ renderFrame, redrawBackground, canvasSize });
</script>

<template>
    <div ref="scrollWrapper" class="scroll-wrapper" :class="{ pannable: props.pannable && !isDemo }"
        @scroll="panAndZoom.onScroll">
        <div class="sizer" :style="panAndZoom.virtualStyle.value"></div>
        <canvas ref="canvas" class="virtual-canvas" @pointerdown="panAndZoom.onPointerDown"
            @wheel.prevent="panAndZoom.handleWheel"></canvas>
    </div>
</template>

<style scoped>
.scroll-wrapper {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
}

.scroll-wrapper.pannable {
    overflow: scroll;
}

.virtual-canvas {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
}

.sizer {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
}
</style>
