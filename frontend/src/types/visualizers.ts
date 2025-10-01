import type { Card, Revlog } from "@/services/api";

export type Viewport = DOMRectReadOnly;
export type CanvasSize = { width: number, height: number; };

export interface VisualizerInfo {
    cards: Card[];
    day: number;
    states: VisualizerState[];
};

export enum Status {
    Unknown,
    BeforeNew,
    OnReview,
    InProgress,
    OnDue,
    AfterDue,
}

interface VisualizerStateBase {
    id: number;
    timeline_sort_day: number;
    timeline_offset: number;
}

interface VisualizerStateBeforeNew extends VisualizerStateBase {
    status: Status.BeforeNew;
    scheduled_interval: number;
    progress_percent: number;
}

interface VisualizerStateOnReview extends VisualizerStateBase {
    status: Status.OnReview;
    review: Revlog;
    scheduled_interval: number;
    previous_scheduled_interval: number;
}

interface VisualizerStateOnDue extends VisualizerStateBase {
    status: Status.OnDue;
    scheduled_interval: number;
}

interface VisualizerStateAfterDue extends VisualizerStateBase {
    status: Status.AfterDue;
    prev_review: Revlog;
    scheduled_interval: number;
}

interface VisualizerStateInProgress extends VisualizerStateBase {
    status: Status.InProgress;
    prev_review: Revlog;
    next_review: Revlog;
    scheduled_interval: number;
    actual_interval_duration: number;
    progress_percent: number;
    schedule_matches_review: boolean;
}

export type VisualizerState =
    | VisualizerStateBeforeNew
    | VisualizerStateOnReview
    | VisualizerStateOnDue
    | VisualizerStateAfterDue
    | VisualizerStateInProgress;

export interface Shape {
    id: number;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    color: string;
    isActive: boolean;
}

export interface IVisualizerBase<TControls, TShape> {
    readonly isAnimated: boolean;
    calculate(shapes: TShape[], info: VisualizerInfo, controls: Readonly<TControls>, canvasSize: CanvasSize): void;
    drawShapes(ctx: CanvasRenderingContext2D, shapes: readonly TShape[], selectedShape: TShape | null, viewport: Viewport,): void;
    drawBackground?(ctx: CanvasRenderingContext2D, controls: Readonly<TControls>, canvasSize: CanvasSize, zoomLevel: number, viewport: Viewport): void;
    hitTest(x: number, y: number, shapes: readonly TShape[]): TShape | null;
}

export interface IVisualizerPannable<TControls, TShape> extends IVisualizerBase<TControls, TShape> {
    readonly pannable: true;
    initialize(info: VisualizerInfo): [CanvasSize, TShape[]];
}

export interface IVisualizerScreenFit<TControls, TShape> extends IVisualizerBase<TControls, TShape> {
    readonly pannable: false;
    initialize(info: VisualizerInfo): TShape[];
}

export type IVisualizer<TControls, TShape> =
    | IVisualizerPannable<TControls, TShape>
    | IVisualizerScreenFit<TControls, TShape>;
