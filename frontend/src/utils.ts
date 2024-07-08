export function last<T>(arr: T[], predicate: (item: T) => boolean): T | undefined {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i]))
            return arr[i];
    }
    return undefined;
}

export function count<T>(arr: T[], predicate: (item: T) => boolean): number {
    let counter = 0;
    for (let i = 0; i < arr.length; ++i) {
        if (predicate(arr[i]))
            counter++;
    }
    return counter;
}

export function rainbow(progress: number): string {
    const div = Math.abs(progress % 1) * 5;
    const ascending = Math.floor((div % 1) * 255);
    const descending = 255 - ascending;

    switch (Math.floor(div)) {
        case 0: return `rgba(255, ${ascending}, 0, 1)`;
        case 1: return `rgba(${descending}, 255, 0, 1)`;
        case 2: return `rgba(0, 255, ${ascending}, 1)`;
        case 3: return `rgba(0, ${descending}, 255, 1)`;
        default: return `rgba(${ascending}, 0, 255, 1)`;
    }
}

export function lerp_color(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, percent: number) {
    const r = Math.round(r1 + (r2 - r1) * percent);
    const g = Math.round(g1 + (g2 - g1) * percent);
    const b = Math.round(b1 + (b2 - b1) * percent);

    return `rgba(${r}, ${g}, ${b}, 1)`;
}

export function addDays(date: Date, days: number): Date {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export function format_date(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}
