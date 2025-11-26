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
    alignBottom?: Ref<boolean>;
}

export function usePanAndZoom(options: PanAndZoomOptions) {
    const {
        zoomLevel,
        onClick,
        scrollWrapper,
        canvas,
        canvasSize,
        virtualSize,
        scrollable,
        alignBottom
    } = options;

    const scrollLeft = ref(0);
    const scrollTop = ref(0);

    let focalPointForNextZoom: Point | null = null;

    const internalVirtualSize = computed(() => {
        return (scrollable.value && virtualSize.value)
            ? virtualSize.value
            : { width: canvasSize.value.width, height: canvasSize.value.height };
    });

    function getOffset(zoom: number) {
        if (!alignBottom?.value) return { x: 0, y: 0 };
        const containerH = canvasSize.value.height;
        const contentH = internalVirtualSize.value.height * zoom;
        const y = (contentH < containerH) ? (containerH - contentH) : 0;
        return { x: 0, y };
    }

    const contentOffset = computed(() => getOffset(zoomLevel.value));

    watch(zoomLevel, (newZoom, oldZoom) => {
        if (oldZoom === undefined || newZoom === oldZoom) return;

        const wrapper = scrollWrapper.value;
        if (!wrapper) return;

        const focalPoint = focalPointForNextZoom || { x: canvasSize.value.width / 2, y: canvasSize.value.height / 2 };
        focalPointForNextZoom = null;

        const oldOffset = getOffset(oldZoom);

        const virtualFocalX = (wrapper.scrollLeft + focalPoint.x - oldOffset.x) / oldZoom;
        const virtualFocalY = (wrapper.scrollTop + focalPoint.y - oldOffset.y) / oldZoom;

        const newOffset = getOffset(newZoom);

        nextTick(() => {
            if (scrollWrapper.value) {
                const newScrollLeft = virtualFocalX * newZoom - focalPoint.x + newOffset.x;
                const newScrollTop = virtualFocalY * newZoom - focalPoint.y + newOffset.y;

                scrollWrapper.value.scrollLeft = newScrollLeft;
                scrollWrapper.value.scrollTop = newScrollTop;
            }
        });
    }, { immediate: true });

    const visible = computed(() => new DOMRect(
        (scrollLeft.value - contentOffset.value.x) / zoomLevel.value,
        (scrollTop.value - contentOffset.value.y) / zoomLevel.value,
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

    function getRelativePoint(clientX: number, clientY: number): Point {
        if (!canvas.value) return { x: 0, y: 0 };
        const rect = canvas.value.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    const pointerTracker = usePointerTracker({
        onPan: ({ dx, dy }) => {
            if (!scrollWrapper.value) return;
            scrollWrapper.value.scrollLeft -= dx;
            scrollWrapper.value.scrollTop -= dy;
        },
        onPinch: ({ scale, center }) => {
            const point = getRelativePoint(center.x, center.y);
            setZoom(zoomLevel.value * scale, point);
        },
        onClick: ({ point }) => {
            const screen = getRelativePoint(point.x, point.y);
            const virtualX = (screen.x + scrollLeft.value - contentOffset.value.x) / zoomLevel.value;
            const virtualY = (screen.y + scrollTop.value - contentOffset.value.y) / zoomLevel.value;
            onClick({ x: virtualX, y: virtualY });
        }
    });

    function onPointerDown(e: PointerEvent) {
        if (e.button === 1) {
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

        const proportionalChange = zoomLevel.value * (zoomFactor - 1);
        const direction = isZoomingOut ? -1 : 1;
        const change = direction * Math.max(Math.abs(proportionalChange), MIN_ABSOLUTE_STEP);
        const newZoom = zoomLevel.value + change;

        const focalPoint = getRelativePoint(e.clientX, e.clientY);
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
