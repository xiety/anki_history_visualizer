const DAY_MS = 24 * 60 * 60 * 1000;

export const dayToDate = (day: number): Date =>
    new Date(day * DAY_MS);

export const dateToDay = (date: Date): number =>
    Math.floor(date.getTime() / DAY_MS);

export const addDays = (date: Date, days: number): Date =>
    new Date(date.getTime() + days * DAY_MS);

export const daysBetween = (a: Date, b: Date): number =>
    Math.round((b.getTime() - a.getTime()) / DAY_MS);
