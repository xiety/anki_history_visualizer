import { ref, onUnmounted } from 'vue';

export type Point = { x: number; y: number; };

interface PointerTrackerOptions {
    onPanStart?: (event: { point: Point; }) => void;
    onPan: (event: { dx: number; dy: number; }) => void;
    onPinch?: (event: { scale: number; center: Point; }) => void;
    onClick?: (event: { point: Point; }) => void;
    onPanEnd?: () => void;
}

export function usePointerTracker(options: PointerTrackerOptions) {
    const isTracking = ref(false);
    const activePointers = new Map<number, Point>();
    let lastDist = 0;
    let panStartPoint: Point | null = null;
    let didPan = false;

    function onPointerDown(e: PointerEvent) {
        isTracking.value = true;
        didPan = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 1) {
            panStartPoint = { x: e.clientX, y: e.clientY };
            options.onPanStart?.({ point: panStartPoint });
        }

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e: PointerEvent) {
        if (!activePointers.has(e.pointerId)) return;
        const currentPoint = { x: e.clientX, y: e.clientY };
        activePointers.set(e.pointerId, currentPoint);
        didPan = true;

        if (activePointers.size === 2 && options.onPinch) {
            const pointers = Array.from(activePointers.values());
            const p1 = pointers[0]!;
            const p2 = pointers[1]!;

            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            if (lastDist > 0) options.onPinch({ scale: dist / lastDist, center });
            lastDist = dist;
        } else if (activePointers.size === 1 && panStartPoint) {
            const dx = currentPoint.x - panStartPoint.x;
            const dy = currentPoint.y - panStartPoint.y;
            panStartPoint = currentPoint;
            options.onPan({ dx, dy });
        }
    }

    function onPointerUp(e: PointerEvent) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        activePointers.delete(e.pointerId);

        if (activePointers.size < 2) lastDist = 0;
        if (activePointers.size < 1) {
            isTracking.value = false;
            if (!didPan && options.onClick) options.onClick({ point: { x: e.clientX, y: e.clientY } });
            options.onPanEnd?.();
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        }
    }

    onUnmounted(() => {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    });

    return { isTracking, onPointerDown };
}
