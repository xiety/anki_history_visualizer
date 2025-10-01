import type { Viewport, CanvasSize, IVisualizerScreenFit, VisualizerInfo } from '@/types/visualizers';
import { Status } from '@/types/visualizers';
import { drawRects, find_rect_at_position, getGradeColor, getIntevalColorLerp, type Rect } from '../common';

export interface Controls {
    squareSize: number;
    maxStability: number;
}

interface Square extends Rect {
}

function initialize(info: VisualizerInfo): Square[] {
    return info.states.map(state => ({
        id: state.id, x: 0, y: 0, targetX: 0, targetY: 0, color: '', width: 0, height: 0, isActive: false
    }));
}

function calculate(squares: Square[], info: VisualizerInfo, controls: Readonly<Controls>, canvasSize: CanvasSize): void {
    const { squareSize, maxStability } = controls;
    const max_x = Math.floor(canvasSize.width / controls.squareSize);
    let xn = 0;
    let yn = 0;

    for (let i = 0; i < info.states.length; ++i) {
        const state = info.states[i];

        const square = squares[i];
        square.isActive = false;

        square.targetX = xn * squareSize;
        square.targetY = yn * squareSize;
        square.width = squareSize;
        square.height = squareSize;

        if (state.status === Status.OnReview) {
            square.color = getGradeColor(state.review.grade);
            square.isActive = true;
        } else if (state.status === Status.InProgress
            || state.status === Status.AfterDue
            || state.status === Status.OnDue) {
            square.color = getIntevalColorLerp(state.scheduled_interval, maxStability);
            square.isActive = true;
        }

        xn++;
        if (xn >= max_x) {
            xn = 0;
            yn++;
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
    isAnimated: false,
    pannable: false,
    initialize,
    calculate,
    drawShapes,
    hitTest,
} as IVisualizerScreenFit<Controls, Square>;
