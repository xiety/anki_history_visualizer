import type { CanvasSize, Shape, Viewport } from '@/types/visualizers';

export const TOP_PADDING = 15;

const GRADE_COLORS = ['red', '#228B22', 'green', 'yellow'];

export function rainbow(progress: number): string {
    const div = progress * 5;
    const ascending = Math.round(Math.floor((div % 1) * 255));
    const descending = 255 - ascending;

    switch (Math.floor(div)) {
        case 0: return `rgba(255, ${ascending}, 0, 1)`;
        case 1: return `rgba(${descending}, 255, 0, 1)`;
        case 2: return `rgba(0, 255, ${ascending}, 1)`;
        case 3: return `rgba(0, ${descending}, 255, 1)`;
        default: return `rgba(${ascending}, 0, 255, 1)`;
    }
}

export function lerpColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, percent: number) {
    const r = Math.round(r1 + (r2 - r1) * percent);
    const g = Math.round(g1 + (g2 - g1) * percent);
    const b = Math.round(b1 + (b2 - b1) * percent);

    return `rgba(${r}, ${g}, ${b}, 1)`;
}

export function getGradeColor(grade: number) {
    return GRADE_COLORS[grade - 1] ?? 'DarkCyan';
}

function quantize(percent: number, number_of_steps: number): number {
    const stepSize = 1 / (number_of_steps - 1);
    return Math.round(percent / stepSize) * stepSize;
}

function getStabilityPercent(stability: number, maxStability: number, numberOfSteps: number) {
    const percent = maxStability > 0 ? stability / maxStability : 1;
    const percent_limit = Math.min(Math.max(percent, 0), 1);
    return quantize(percent_limit, numberOfSteps);
}

export function getIntevalColorLerp(stability: number, maxStability: number): string {
    const stabilityPercent = getStabilityPercent(stability, maxStability, 20);
    return lerpColor(0, 0, 0, 255, 0, 255, stabilityPercent);
}

export function getIntervalColorRainbow(stability: number, maxStability: number): string {
    const stability_percent = getStabilityPercent(stability, maxStability, 20);
    return rainbow(stability_percent);
}

export function drawDaysGrid(
    ctx: CanvasRenderingContext2D,
    canvasSize: CanvasSize,
    viewport: Viewport,
    zoomLevel: number,
    totalDays: number
) {
    if (totalDays <= 0 || zoomLevel <= 0 || canvasSize.height <= TOP_PADDING) return;

    const drawing_height = canvasSize.height - TOP_PADDING;
    const pixelsPerDayAtZoom1 = drawing_height / totalDays;
    const dayRefAtCanvasTopZoom1 = totalDays + (TOP_PADDING / pixelsPerDayAtZoom1);
    const pixelsPerDayNow = pixelsPerDayAtZoom1 * zoomLevel;
    const panInDays = viewport.y / pixelsPerDayAtZoom1;
    const topGridLineDayValue = dayRefAtCanvasTopZoom1 - panInDays - (TOP_PADDING / pixelsPerDayNow);
    const dayStepPerLine = (drawing_height / (11 - 1)) / pixelsPerDayNow;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '12px serif';
    ctx.fillStyle = 'gray';
    ctx.strokeStyle = 'gray';
    ctx.textAlign = 'right';

    const num_lines = 11;
    const lineSpacing = drawing_height / (num_lines - 1);

    ctx.beginPath();
    for (let i = 0; i < num_lines; ++i) {
        const y = TOP_PADDING + (i * lineSpacing);
        const dayValue = Math.round(topGridLineDayValue - (i * dayStepPerLine));

        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width, y);
        ctx.fillText(`${dayValue}`, canvasSize.width - 5, y - 4);
    }
    ctx.stroke();
    ctx.restore();
}

export interface Circle extends Shape {
    radius: number;
}

export function draw_circles(ctx: CanvasRenderingContext2D, view: Viewport, circles: Readonly<Circle[]>, selectedCircle: Circle | null) {
    const grouped = Map.groupBy(circles, s => s.color);

    for (const [color, group] of grouped) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const circle of group) {
            if (circle.isActive && isCircleVisible(circle, view)) {
                ctx.moveTo(circle.x + circle.radius, circle.y);
                ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
            }
        }
        ctx.fill();
    }

    if (selectedCircle && selectedCircle.isActive) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(selectedCircle.x, selectedCircle.y, selectedCircle.radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

export function isCircleVisible(circle: Circle, view: DOMRectReadOnly, bleed = 1): boolean {
    if (!circle.isActive) return false;

    const rect = {
        x: circle.x - circle.radius - bleed,
        y: circle.y - circle.radius - bleed,
        width: (circle.radius + bleed) * 2,
        height: (circle.radius + bleed) * 2,
    };

    return isRawRectVisible(rect, view, 0);
}

export function findCircleAtPosition<T extends Circle>(circles: readonly T[], x: number, y: number, bleed: number): T | null {
    return circles.findLast(c => c.isActive && (c.x - x) ** 2 + (c.y - y) ** 2 < (c.radius + bleed) ** 2) ?? null;
}

export interface Rect extends Shape {
    width: number;
    height: number;
};

export function drawRects(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    rects: readonly Rect[],
    isSelected: boolean
) {
    const groupedByColor = Map.groupBy(rects, r => r.color);

    ctx.strokeStyle = 'white';

    for (const [color, group] of groupedByColor) {
        ctx.beginPath();
        for (const rect of group) {
            if (isRectVisible(rect, viewport, 1)) {
                ctx.rect(rect.x, rect.y, rect.width, rect.height);
            }
        }

        if (!isSelected) {
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (isSelected) {
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}

export function isRawRectVisible(rect: { x: number, y: number, width: number, height: number; }, view: DOMRectReadOnly, bleed: number): boolean {
    return (
        rect.x + rect.width + bleed > view.left &&
        rect.x - bleed < view.right &&
        rect.y + rect.height + bleed > view.top &&
        rect.y - bleed < view.bottom
    );
}

export function isRectVisible(rect: Rect, view: DOMRectReadOnly, bleed: number): boolean {
    return rect.isActive && isRawRectVisible(rect, view, bleed);
}

export function find_rect_at_position<T extends Rect>(rects: readonly T[], x: number, y: number, bleed: number): T | null {
    return rects.findLast(r => r.isActive && x >= r.x - bleed && x < r.x + r.width + bleed * 2 && y >= r.y - bleed && y < r.y + r.height + bleed * 2) ?? null;
}
