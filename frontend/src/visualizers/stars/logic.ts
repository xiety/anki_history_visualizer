import { type Viewport, type CanvasSize, type IVisualizerScreenFit, type VisualizerInfo, Status } from '@/types/visualizers';
import { draw_circles, findCircleAtPosition, getIntervalColorRainbow, type Circle } from '../common';

export interface Controls {
    starSize: number;
    maxStability: number;
}

interface Star extends Circle {
    angle: number;
}

function initialize(info: VisualizerInfo): Star[] {
    const max_angle = 2.0 * Math.PI;
    return info.states.map(state => ({
        id: state.id,
        x: 0, y: 0, targetX: 0, targetY: 0,
        radius: 0, color: '',
        isActive: false,
        angle: Math.random() * max_angle
    }));
}

function _calc_position(distance: number, angle: number, canvas_size: CanvasSize) {
    const { width, height } = canvas_size;
    const center_x = width / 2.0;
    const center_y = height / 2.0;

    let x = Math.sin(angle) * distance + center_x;
    let y = Math.cos(angle) * distance + center_y;

    const p = 1.0 - Math.exp(-distance / 100);
    const funnel = 175.0;
    y -= funnel * p;

    const tilt_factor = 0.8;
    const scale_factor = tilt_factor + (1 - tilt_factor) * ((y + 150) / (height + 150));
    x = center_x + (x - center_x) * scale_factor;
    y = height - (height - y) * tilt_factor;

    return { x, y };
}

function calculate(stars: Star[], info: VisualizerInfo, controls: Readonly<Controls>, canvasSize: CanvasSize): void {
    for (let i = 0; i < info.states.length; ++i) {
        const star = stars[i];
        const state = info.states[i];
        star.isActive = false;

        if (state.status === Status.BeforeNew) {
            star.isActive = true;
            const percent_remaining = 1.0 - state.progress_percent;
            const distance = percent_remaining * canvasSize.width;
            const { x, y } = _calc_position(distance, star.angle, canvasSize);

            star.targetX = x;
            star.targetY = y;
            star.color = 'gray';
            star.radius = controls.starSize / 4;
        } else if (state.status == Status.InProgress) {
            star.isActive = true;
            const percent_remaining = 1.0 - state.progress_percent;
            const distance = percent_remaining * canvasSize.width;
            const { x, y } = _calc_position(distance, star.angle, canvasSize);

            star.targetX = x;
            star.targetY = y;
            star.color = getIntervalColorRainbow(state.scheduled_interval, controls.maxStability);
            star.radius = controls.starSize / 2;
        }
    }
}

function drawShapes(ctx: CanvasRenderingContext2D, balls: readonly Star[], selectedShape: Star | null, viewport: Viewport): void {
    draw_circles(ctx, viewport, balls, selectedShape);
}

function hitTest(x: number, y: number, shapes: readonly Star[]): Star | null {
    return findCircleAtPosition(shapes, x, y, 1);
}

export const logic = {
    isAnimated: false,
    pannable: false,
    initialize,
    calculate,
    drawShapes,
    hitTest,
} as IVisualizerScreenFit<Controls, Star>;
