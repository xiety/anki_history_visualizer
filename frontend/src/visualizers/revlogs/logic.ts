import type { Viewport, CanvasSize, IVisualizerPannable, VisualizerInfo, Shape } from '@/types/visualizers';
import { drawRects, find_rect_at_position, getGradeColor, type Rect } from '../common';
import { type Revlog, RevlogType } from '@/services/api';

const BOX_SIZE = 8;
const BOX_SPACING = 1;

const REVIEW_TYPES = new Set([
    RevlogType.Review,
    RevlogType.Learn,
    RevlogType.Relearn,
    RevlogType.Filtered,
]);

export enum SortMode {
    FirstReview,
    LastReview,
    DueDate,
    NumOfAgain,
}

export interface Controls {
    zoomLevel: number;
    sortMode: SortMode;
}

interface Row extends Shape {
    id: number;
    steps: Rect[];
    y: number;
    targetY: number;
    firstReview: number;
    lastReview: number;
    dueDate: number;
    initialIndex: number;
    numOfAgain: number;
}

function getColor(step: Revlog): string {
    return step.revlog_type === RevlogType.Due ? 'gray' : getGradeColor(step.grade);
}

function initialize(info: VisualizerInfo): [CanvasSize, Row[]] {
    const rows: Row[] = [];
    let width = 0;

    for (let i = 0; i < info.cards.length; ++i) {
        const card = info.cards[i];

        const firstReview = card.steps.find(s => REVIEW_TYPES.has(s.revlog_type))?.day ?? 0;
        const lastReview = card.steps.findLast(s => REVIEW_TYPES.has(s.revlog_type))?.day ?? 0;
        const dueDate = card.steps.find(s => s.revlog_type === RevlogType.Due)?.day ?? 0;
        const numOfAgain = card.steps.filter(s => s.grade === 1).length;

        const row: Row = {
            initialIndex: i,
            id: card.card_id,
            isActive: true,
            steps: [],
            x: 0, y: 0,
            targetX: 0, targetY: 0,
            color: 'white',
            firstReview,
            lastReview,
            dueDate,
            numOfAgain,
        };

        for (const step of card.steps) {
            if (step.revlog_type === RevlogType.Due || REVIEW_TYPES.has(step.revlog_type)) {
                const x = step.day * (BOX_SIZE + BOX_SPACING);
                row.steps.push({
                    id: row.id,
                    x: x, y: 0,
                    targetX: x, targetY: 0,
                    width: BOX_SIZE, height: BOX_SIZE,
                    color: getColor(step),
                    isActive: true,
                });
                if (width < x + BOX_SIZE) width = x + BOX_SIZE;
            }
        }
        rows.push(row);
    }

    const height = info.cards.length * (BOX_SIZE + BOX_SPACING);
    return [{ width, height }, rows];
}

function comparison(a: Row, b: Row, controls: Controls) {
    function orderBy(m: SortMode) {
        switch (m) {
            case SortMode.FirstReview: return a.firstReview - b.firstReview;
            case SortMode.LastReview: return a.lastReview - b.lastReview;
            case SortMode.DueDate: return a.dueDate - b.dueDate;
            case SortMode.NumOfAgain: return b.numOfAgain - a.numOfAgain; //descending
        }
    }

    function getSecond(m: SortMode) {
        switch (m) {
            case SortMode.FirstReview: return SortMode.DueDate;
            case SortMode.LastReview: return SortMode.DueDate;
            case SortMode.DueDate: return SortMode.FirstReview;
            case SortMode.NumOfAgain: return SortMode.DueDate;
        }
    }

    return orderBy(controls.sortMode)
        || orderBy(getSecond(controls.sortMode))
        || (a.id - b.id);
}

function calculate(rows: Row[], info: VisualizerInfo, controls: Readonly<Controls>): void {
    rows.sort((a, b) => comparison(a, b, controls));

    for (let i = 0; i < rows.length; ++i) {
        const row = rows[i];
        const y = i * (BOX_SIZE + BOX_SPACING);
        row.y = row.targetY = y;
        for (const step of row.steps) {
            step.y = step.targetY = y;
        }
    }
}

function drawShapes(ctx: CanvasRenderingContext2D, rows: readonly Row[], selectedRow: Row | null, viewport: Viewport): void {
    const allRects = rows.flatMap(r => r.steps);

    drawRects(ctx, viewport, allRects, false);
    if (selectedRow) {
        drawRects(ctx, viewport, selectedRow.steps, true);
    }
}

function hitTest(x: number, y: number, rows: readonly Row[]): Row | null {
    const allRects = rows.flatMap(r => r.steps);
    const hitRect = find_rect_at_position(allRects, x, y, 0);

    if (hitRect) {
        return rows.find(row => row.id === hitRect.id) ?? null;
    }
    return null;
}

export const logic = {
    isAnimated: true,
    pannable: true,
    initialize,
    calculate,
    drawShapes,
    hitTest,
} as IVisualizerPannable<Controls, Row>;
