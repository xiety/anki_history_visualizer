import { shallowRef, watch, computed, onActivated, type Ref } from 'vue';
import type { CanvasSize, IVisualizer, Shape, Viewport, VisualizerInfo } from '@/types/visualizers';
import type InteractiveCanvas from '@/components/InteractiveCanvas.vue';
import type { Card } from '@/services/api';
import { animateShapes, jumpShapesToTarget } from '@/services/animation';

export interface IAnimationControls {
    animationSpeed?: number;
}

export function useVisualizer<TControls extends object, TShape extends Shape>(
    logic: IVisualizer<TControls, TShape>,
    props: {
        info: VisualizerInfo | null;
        selectedCardId: number | null;
        cards: Card[];
    },
    controls: TControls & IAnimationControls,
    canvasRef: Ref<InstanceType<typeof InteractiveCanvas> | null>,
    emit: (e: 'clicked', payload: number | null) => void
) {
    const shapes = shallowRef<TShape[]>([]);
    const virtualSize = shallowRef<{ width: number; height: number; } | null>(null);

    const canvasSize = computed(() => canvasRef.value?.canvasSize ?? { width: 0, height: 0 });

    const selectedShape = computed(() =>
        props.selectedCardId ? shapes.value.find(s => s.id === props.selectedCardId) ?? null : null
    );

    function foregroundTick(ctx: CanvasRenderingContext2D, viewport: Viewport) {
        if (!props.info) return;
        animateShapes(shapes.value, logic.isAnimated, controls.animationSpeed ?? 30);
        logic.drawShapes(ctx, shapes.value, props.info, selectedShape.value, viewport);
    }

    function drawBackground(ctx: CanvasRenderingContext2D, canvasSize: CanvasSize, zoomLevel: number, viewport: Viewport) {
        if (logic.drawBackground) {
            logic.drawBackground(ctx, controls, canvasSize, zoomLevel, viewport);
        }
    }

    function onCanvasClick(payload: { x: number, y: number; }) {
        const hit = logic.hitTest(payload.x, payload.y, shapes.value);
        emit('clicked', hit?.id ?? null);
    }

    let lastProcessedCards: Card[] | undefined;

    function calculate() {
        if (!props.info) return;
        logic.calculate(shapes.value, props.info, controls, canvasSize.value);
    }

    function refreshForeground(animate: boolean) {
        if (!props.info || !canvasSize.value.width) return;

        const isNewData = props.cards !== lastProcessedCards;

        if (isNewData) {
            lastProcessedCards = props.cards;

            if (logic.pannable) {
                [virtualSize.value, shapes.value] = logic.initialize(props.info);
            } else {
                shapes.value = logic.initialize(props.info);
            }

            calculate();
            jumpShapesToTarget(shapes.value, true);
        }
        else {
            calculate();
            jumpShapesToTarget(shapes.value, !logic.isAnimated || !animate);
        }
    }

    function renderFrame(time: number) {
        canvasRef.value?.renderFrame(time);
    }

    function refreshBackground() {
        if (!canvasSize.value.width || !canvasSize.value.height) return;
        canvasRef.value?.redrawBackground();
    }

    watch(
        [() => props.cards, () => props.info],
        () => refreshForeground(true),
        { immediate: true }
    );

    watch([controls, canvasSize], () => {
        refreshForeground(true);
        refreshBackground();
    });

    onActivated(() => {
        refreshForeground(false);
        refreshBackground();
    });

    return { renderFrame, foregroundTick, drawBackground, onCanvasClick, virtualSize };
}
