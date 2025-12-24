import type { Viewport, CanvasSize, IVisualizerScreenFit, VisualizerInfo } from '@/types/visualizers';
import { Status } from '@/types/visualizers';
import { draw_circles, drawDaysGrid, findCircleAtPosition, getIntervalColorRainbow, TOP_PADDING, type Circle } from '../common';

export interface Controls {
    ballSize: number;
    daysOnScreen: number;
    maxStability: number;
}

interface Ball extends Circle {
}

function initialize(info: VisualizerInfo): Ball[] {
    return info.states.map(state => ({
        id: state.id, x: 0, y: 0, targetX: 0, targetY: 0, radius: 0, color: '', isActive: false
    }));
}

function get_size(counter: number, ball_size: number) {
    return Math.max(1, ((3 + (counter * 5) / 3) * (ball_size / 100.0)) / 2);
}

function calculate(balls: Ball[], info: VisualizerInfo, controls: Readonly<Controls>, canvasSize: CanvasSize): void {
    const box_width = 5;
    const step_width = (canvasSize.width - box_width * 2) / info.states.length;
    let x = 5;

    for (let i = 0; i < info.states.length; ++i) {
        const ball = balls[i];
        const state = info.states[i];
        ball.isActive = false;
        ball.targetX = x;

        const bottom_padding = 2;
        const day_height = (canvasSize.height - TOP_PADDING) / controls.daysOnScreen;

        if (state.status === Status.InProgress) {
            const max_h = state.actual_interval_duration * day_height;
            const normalize = (max_h / 2) ** 2 / max_h;
            const arc = ((max_h / 2) ** 2 - (max_h / 2 - max_h * state.progress_percent) ** 2) / normalize;
            ball.targetY = canvasSize.height - arc - bottom_padding;
            ball.radius = get_size(state.prev_review.counter, controls.ballSize);
            ball.color = getIntervalColorRainbow(state.scheduled_interval, controls.maxStability);
            ball.isActive = true;
        } else if (state.status === Status.OnReview) {
            ball.targetY = canvasSize.height - bottom_padding;
            ball.radius = get_size(state.review.counter, controls.ballSize);
            ball.color = getIntervalColorRainbow(state.scheduled_interval, controls.maxStability);
            ball.isActive = true;
        } else if (state.status === Status.BeforeNew) {
            const max_h = state.scheduled_interval * day_height;
            const arc = max_h - (max_h * state.progress_percent) ** 2 / max_h;
            ball.targetY = canvasSize.height - arc - bottom_padding;
            ball.radius = Math.max(1, 3 * (controls.ballSize / 100.0)) / 2;
            ball.color = 'gray';
            ball.isActive = true;
        }

        x += step_width;
    }
}

function drawShapes(ctx: CanvasRenderingContext2D, balls: readonly Ball[], info: VisualizerInfo, selectedShape: Ball | null, viewport: Viewport): void {
    draw_circles(ctx, viewport, balls, selectedShape);
}

function drawBackground(ctx: CanvasRenderingContext2D, controls: Readonly<Controls>, canvasSize: CanvasSize, zoomLevel: number, viewport: Viewport): void {
    drawDaysGrid(ctx, canvasSize, viewport, zoomLevel, controls.daysOnScreen);
}

function hitTest(x: number, y: number, shapes: readonly Ball[]): Ball | null {
    return findCircleAtPosition(shapes, x, y, 1);
}

export const logic = {
    isAnimated: false,
    pannable: false,
    initialize,
    calculate,
    drawShapes,
    drawBackground,
    hitTest,
} as IVisualizerScreenFit<Controls, Ball>;
