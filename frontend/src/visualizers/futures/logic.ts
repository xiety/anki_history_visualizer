import type { Viewport, CanvasSize, IVisualizerScreenFit, VisualizerInfo } from '@/types/visualizers';
import { Status } from '@/types/visualizers';
import { drawRects, find_rect_at_position, getGradeColor, getIntevalColorLerp, type Rect } from '../common';
import type { IAnimationControls } from '@/composables/useVisualizer';

export interface Controls extends IAnimationControls {
    squareSize: number;
    maxStability: number;
}

interface Square extends Rect {
}

function initialize(info: VisualizerInfo): Rect[] {
    return info.states.map(state => ({
        id: state.id, x: 0, y: 0, targetX: 0, targetY: 0, color: 'black', width: 0, height: 0, isActive: false
    }));
}

function calculate(squares: Square[], info: VisualizerInfo, controls: Readonly<Controls>, canvasSize: CanvasSize): void {
    const keys = info.states.map((s, idx) => ({ day: s.timeline_sort_day, idx }));
    keys.sort((a, b) => a.day - b.day);

    const columnHeights = new Map<number, number>();

    for (const { idx } of keys) {
        const state = info.states[idx];
        const shape = squares[idx];
        shape.isActive = false;

        if (state.status !== Status.AfterDue) {
            shape.isActive = true;
            shape.width = controls.squareSize;
            shape.height = controls.squareSize;

            if (state.status === Status.OnReview) {
                shape.color = getGradeColor(state.review.grade);
            } else if (state.status === Status.BeforeNew) {
                shape.color = 'DarkCyan';
            } else {
                shape.color = getIntevalColorLerp(state.scheduled_interval, controls.maxStability);
            }

            const colHeight = columnHeights.get(state.timeline_offset) ?? 0;
            columnHeights.set(state.timeline_offset, colHeight + 1);

            shape.targetX = state.timeline_offset * controls.squareSize;
            shape.targetY = canvasSize.height - (colHeight + 1) * controls.squareSize;
        }
    }
}

function drawShapes(ctx: CanvasRenderingContext2D, squares: readonly Square[], selectedSquare: Square | null, viewport: Viewport): void {
    drawRects(ctx, viewport, squares, false);
    if (selectedSquare) {
        drawRects(ctx, viewport, [selectedSquare], true);
    }
}

function hitTest(x: number, y: number, squares: readonly Square[]): Square | null {
    return find_rect_at_position(squares, x, y, 0);
}

export const logic = {
    isAnimated: true,
    pannable: false,
    initialize,
    calculate,
    drawShapes,
    hitTest,
} as IVisualizerScreenFit<Controls, Square>;
