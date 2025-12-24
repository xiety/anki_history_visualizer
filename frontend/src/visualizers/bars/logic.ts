import type { Viewport, CanvasSize, IVisualizerScreenFit, VisualizerInfo } from '@/types/visualizers';
import { Status } from '@/types/visualizers';
import { drawDaysGrid, find_rect_at_position, getGradeColor, isRectVisible, TOP_PADDING, type Rect } from '../common';

export interface Controls {
    barSize: number;
    daysOnScreen: number;
}

interface Bar extends Rect {
    transitionHeight: number;
    grade: number;
    showTransition?: boolean;
}

function initialize(info: VisualizerInfo): Bar[] {
    return info.states.map(state => ({
        id: state.id, x: 0, y: 0, targetX: 0, targetY: 0, color: '', width: 0, height: 0, transitionHeight: 0,
        grade: 0, day: 0, showTransition: false, isActive: false
    }));
}

function calculate(bars: Bar[], info: VisualizerInfo, controls: Readonly<Controls>, canvasSize: CanvasSize): void {
    const day_height = (canvasSize.height - TOP_PADDING) / controls.daysOnScreen;
    const step = info.states.length > 0 ? (canvasSize.width - controls.barSize) / info.states.length : 0;
    const bar_height = 3;

    for (let i = 0; i < info.states.length; ++i) {
        const state = info.states[i];
        const bar = bars[i];
        bar.isActive = false;
        bar.targetX = i * step;
        bar.width = controls.barSize;

        if (state.status == Status.InProgress) {
            bar.isActive = true;
            bar.targetY = canvasSize.height - (state.scheduled_interval * day_height) - bar.height;
            bar.color = state.schedule_matches_review ? getGradeColor(state.prev_review.grade) : 'white';
            bar.showTransition = false;
            bar.height = bar_height;
            bar.transitionHeight = 0;
        } else if (state.status == Status.OnReview) {
            bar.isActive = true;
            bar.targetY = canvasSize.height - (state.scheduled_interval * day_height) - bar.height;
            bar.color = getGradeColor(state.review.grade);
            bar.showTransition = true;
            bar.height = bar_height;
            bar.transitionHeight = canvasSize.height - (state.previous_scheduled_interval * day_height);
        }
    }
}

function isLineVisible(x: number, y1: number, y2: number, view: DOMRectReadOnly): boolean {
    const bleed = 1;
    if (x < view.left - bleed || x > view.right + bleed) {
        return false;
    }
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return maxY >= view.top - bleed && minY <= view.bottom + bleed;
}

function drawShapes(ctx: CanvasRenderingContext2D, bars: readonly Bar[], info: VisualizerInfo, selectedBar: Bar | null, viewport: Viewport): void {
    const grouped = Map.groupBy(bars, s => s.color);
    ctx.lineWidth = 1;

    for (const [color, barsToDraw] of grouped.entries()) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (const bar of barsToDraw) {
            if (bar.isActive && bar.showTransition) {
                const start_y = bar.transitionHeight;
                const end_y = bar.y + bar.height / 2;
                const line_x = bar.x + bar.width / 2;
                if (isLineVisible(line_x, start_y, end_y, viewport)) {
                    ctx.moveTo(line_x, start_y);
                    ctx.lineTo(line_x, end_y);
                }
            }
        }
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        for (const bar of barsToDraw) {
            if (isRectVisible(bar, viewport, 1)) {
                ctx.rect(bar.x, bar.y, bar.width, bar.height);
            }
        }
        ctx.fill();
    }

    if (selectedBar && selectedBar.isActive && isRectVisible(selectedBar, viewport, 1)) {
        ctx.strokeStyle = 'white';
        ctx.strokeRect(selectedBar.x - 1, selectedBar.y - 1, selectedBar.width + 2, selectedBar.height + 2);
    }
}

function drawBackground(ctx: CanvasRenderingContext2D, controls: Readonly<Controls>, canvasSize: CanvasSize, zoomLevel: number, viewport: Viewport): void {
    drawDaysGrid(ctx, canvasSize, viewport, zoomLevel, controls.daysOnScreen);
}

function hitTest(x: number, y: number, bars: readonly Bar[]): Bar | null {
    return find_rect_at_position(bars, x, y, 1);
}

export const logic = {
    isAnimated: false,
    pannable: false,
    initialize,
    calculate,
    drawShapes,
    drawBackground,
    hitTest,
} as IVisualizerScreenFit<Controls, Bar>;
