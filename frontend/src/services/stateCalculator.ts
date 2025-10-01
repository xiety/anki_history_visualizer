import { RevlogType, type Card, type Revlog } from '@/services/api';
import { Status, type VisualizerState } from '@/types/visualizers';

function is_valid_review(revlog: Revlog): boolean {
    return revlog.grade > 0 || revlog.revlog_type === RevlogType.Due;
}

function find_last_revlog_index_for_day(revlogs: Revlog[], day: number): number {
    let low = 0;
    let high = revlogs.length - 1;
    let result_index = -1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (revlogs[mid].day <= day) {
            result_index = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return result_index;
}

function find_valid_review(revlogs: Revlog[], from_index: number, direction: 1 | -1): Revlog | null {
    for (let i = from_index; i >= 0 && i < revlogs.length; i += direction) {
        if (is_valid_review(revlogs[i])) {
            return revlogs[i];
        }
    }
    return null;
}

function calculateState(card: Card, frame: number): VisualizerState {
    const revlogs = card.steps;
    const last_idx = find_last_revlog_index_for_day(revlogs, frame);
    const prev_review_log = find_valid_review(revlogs, last_idx, -1);

    if (!prev_review_log) {
        const first_review_log = find_valid_review(revlogs, 0, 1)!;
        const due_day = first_review_log.day;
        return {
            status: Status.BeforeNew,
            id: card.card_id,
            progress_percent: due_day > 0 ? frame / due_day : 1,
            scheduled_interval: due_day,
            timeline_sort_day: -1,
            timeline_offset: due_day - frame,
        };
    }

    const last_revlog = revlogs[last_idx];

    if (prev_review_log.day === frame) {
        const review_before = find_valid_review(revlogs, last_idx - 1, -1);
        if (prev_review_log.revlog_type === RevlogType.Due) {
            return {
                status: Status.OnDue,
                id: card.card_id,
                scheduled_interval: last_revlog.interval_due,
                timeline_sort_day: review_before?.day ?? 0,
                timeline_offset: 0,
            };
        } else {
            return {
                status: Status.OnReview,
                id: card.card_id,
                review: prev_review_log,
                scheduled_interval: last_revlog.interval_due,
                previous_scheduled_interval: last_idx > 0 ? revlogs[last_idx - 1].interval_due : 0,
                timeline_sort_day: review_before?.day ?? 0,
                timeline_offset: 0,
            };
        }
    }

    const next_review_log = find_valid_review(revlogs, last_idx + 1, 1);
    if (!next_review_log) {
        return {
            status: Status.AfterDue,
            id: card.card_id,
            prev_review: prev_review_log,
            scheduled_interval: last_revlog.interval_due,
            timeline_sort_day: prev_review_log.day,
            timeline_offset: prev_review_log.day - frame,
        };
    }

    const actual_interval_duration = next_review_log.day - prev_review_log.day;
    return {
        status: Status.InProgress,
        id: card.card_id,
        prev_review: prev_review_log,
        next_review: next_review_log,
        scheduled_interval: last_revlog.interval_due,
        actual_interval_duration: actual_interval_duration,
        progress_percent: actual_interval_duration > 0 ? (frame - prev_review_log.day) / actual_interval_duration : 1,
        schedule_matches_review: last_revlog === prev_review_log,
        timeline_sort_day: prev_review_log.day,
        timeline_offset: next_review_log.day - frame,
    };
}

export function calculateInfo(cards: Card[], day: number) {
    return {
        cards,
        day,
        states: cards.map(card => calculateState(card, day))
    };
}
