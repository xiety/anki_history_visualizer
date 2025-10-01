import { ref, computed, nextTick, watch, type Ref } from 'vue';
import { usePointerTracker, type Point } from './usePointerTracker';

const DEFAULT_MIN_ZOOM = 0.05;
const DEFAULT_MAX_ZOOM = 5;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function roundZoom(n: number): number {
    return Math.round(n * 100) / 100;
}

interface PanAndZoomOptions {
    zoomLevel: Ref<number>;
    onClick: (payload: { x: number, y: number; }) => void;
    scrollWrapper: Ref<HTMLDivElement | null>;
    canvas: Ref<HTMLCanvasElement | null>;
    canvasSize: Ref<{ width: number; height: number; }>;
    virtualSize: Ref<{ width: number; height: number; } | undefined>;
    scrollable: Ref<boolean>;
}

export function usePanAndZoom(options: PanAndZoomOptions) {
    const {
        zoomLevel,
        onClick,
        scrollWrapper,
        canvas,
        canvasSize,
        virtualSize,
        scrollable
    } = options;

    const scrollLeft = ref(0);
    const scrollTop = ref(0);

    let focalPointForNextZoom: Point | null = null;

    const internalVirtualSize = computed(() => {
        return (scrollable.value && virtualSize.value)
            ? virtualSize.value
            : { width: canvasSize.value.width, height: canvasSize.value.height };
    });

    watch(zoomLevel, (newZoom, oldZoom) => {
        if (oldZoom === undefined || newZoom === oldZoom) return;

        const wrapper = scrollWrapper.value;
        if (!wrapper) return;

        const focalPoint = focalPointForNextZoom || { x: canvasSize.value.width / 2, y: canvasSize.value.height / 2 };
        focalPointForNextZoom = null;

        const virtualFocalX = (wrapper.scrollLeft + focalPoint.x) / oldZoom;
        const virtualFocalY = (wrapper.scrollTop + focalPoint.y) / oldZoom;

        nextTick(() => {
            if (scrollWrapper.value) {
                const newScrollLeft = virtualFocalX * newZoom - focalPoint.x;
                const newScrollTop = virtualFocalY * newZoom - focalPoint.y;
                scrollWrapper.value.scrollLeft = newScrollLeft;
                scrollWrapper.value.scrollTop = newScrollTop;
            }
        });
    }, { immediate: true });

    const visible = computed(() => new DOMRect(
        scrollLeft.value / zoomLevel.value,
        scrollTop.value / zoomLevel.value,
        canvasSize.value.width / zoomLevel.value,
        canvasSize.value.height / zoomLevel.value
    ));

    const virtualStyle = computed(() => ({
        width: `${internalVirtualSize.value.width * zoomLevel.value}px`,
        height: `${internalVirtualSize.value.height * zoomLevel.value}px`,
    }));

    function setZoom(newZoom: number, focalPoint?: Point) {
        if (focalPoint) {
            focalPointForNextZoom = focalPoint;
        }
        zoomLevel.value = newZoom;
    }

    const pointerTracker = usePointerTracker({
        onPan: ({ dx, dy }) => {
            if (!scrollWrapper.value) return;
            scrollWrapper.value.scrollLeft -= dx;
            scrollWrapper.value.scrollTop -= dy;
        },
        onPinch: ({ scale, center }) => {
            if (!canvas.value) return;
            const rect = canvas.value.getBoundingClientRect();
            const focalPoint = { x: center.x - rect.left, y: center.y - rect.top };
            setZoom(zoomLevel.value * scale, focalPoint);
        },
        onClick: ({ point }) => {
            if (!canvas.value) return;
            const rect = canvas.value.getBoundingClientRect();
            const virtualX = visible.value.x + (point.x - rect.left) / zoomLevel.value;
            const virtualY = visible.value.y + (point.y - rect.top) / zoomLevel.value;
            onClick({ x: virtualX, y: virtualY });
        }
    });

    function onPointerDown(e: PointerEvent) {
        if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            return;
        }
        if (!scrollable.value) return;
        pointerTracker.onPointerDown(e);
    }

    function onScroll(e: Event) {
        const target = e.target as HTMLDivElement;
        scrollLeft.value = target.scrollLeft;
        scrollTop.value = target.scrollTop;
    }

    function handleWheel(e: WheelEvent) {
        if (!scrollable.value || !canvas.value) return;
        e.preventDefault();

        const ZOOM_IN_INTENSITY = 0.001;
        const ZOOM_OUT_INTENSITY = 0.0015;
        const MIN_ABSOLUTE_STEP = 0.01;

        const isZoomingOut = e.deltaY > 0;
        const intensity = isZoomingOut ? ZOOM_OUT_INTENSITY : ZOOM_IN_INTENSITY;
        const scrollAmount = e.deltaY * -intensity;
        const zoomFactor = Math.exp(scrollAmount);

        // Calculate the change based on the zoom factor (proportional)
        const proportionalChange = zoomLevel.value * (zoomFactor - 1);

        // Determine the direction of change
        const direction = isZoomingOut ? -1 : 1;

        // Use the larger of the proportional change or the minimum absolute step
        const change = direction * Math.max(Math.abs(proportionalChange), MIN_ABSOLUTE_STEP);

        const newZoom = zoomLevel.value + change;

        const rect = canvas.value.getBoundingClientRect();
        const focalPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        const clampedZoom = clamp(roundZoom(newZoom), DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM);

        setZoom(clampedZoom, focalPoint);
    }

    function withTransformedContext(
        callback: (ctx: CanvasRenderingContext2D, visible: DOMRectReadOnly) => void,
        renderCtxOverride: CanvasRenderingContext2D
    ) {
        const ctx = renderCtxOverride;
        ctx.save();
        ctx.scale(zoomLevel.value, zoomLevel.value);
        ctx.translate(-visible.value.x, -visible.value.y);
        try {
            callback(ctx, visible.value);
        } finally {
            ctx.restore();
        }
    }

    return {
        isPanning: pointerTracker.isTracking,
        virtualStyle,
        visible,
        onScroll,
        onPointerDown,
        handleWheel,
        withTransformedContext,
    };
}
