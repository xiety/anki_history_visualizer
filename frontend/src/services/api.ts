declare var pycmd: (name: string, callback: (json: string) => void) => string;

export interface ApiInterface {
    get_cards: () => Promise<GetCardsResponse>;
    open_browser: (filter: string) => Promise<boolean>;
    card_info: (card_id: number) => Promise<CardInfoResponse>;
    open_card_info: () => Promise<boolean>;
}

export class Api implements ApiInterface {
    get_cards = async () => {
        return await this.exec<GetCardsResponse>('get_cards');
    }

    open_browser = async (filter: string) => {
        return await this.exec<boolean>(`open_browser:${filter}`);
    }

    card_info = async (card_id: number) => {
        return await this.exec<CardInfoResponse>(`card_info:${card_id}`);
    }

    open_card_info = async () => {
        return await this.exec<boolean>(`open_card_info`);
    }

    private exec = async <T,>(name: string): Promise<T> => {
        var response = await this.pycmd_async(name);
        return JSON.parse(response);
    }

    private pycmd_async = (name: string): Promise<string> =>
        new Promise((resolve) => pycmd(name, resolve));
}

export type GetCardsResponse = {
    min_day: number;
    max_day: number;
    cards: Card[];
}

export const enum RevlogType {
    Learn = 0,
    Review = 1,
    Relearn = 2,
    Filtered = 3,
    Manual = 4,
    Rescheduled = 5,
    Due = -1,
}

export type Revlog = {
    revlog_id: number;
    day: number;
    revlog_type: RevlogType;
    interval_due: number;
    grade: number;
    counter: number;
};

export type Card = {
    note_id: number;
    card_id: number;
    steps: Revlog[];
    due_day: number;
};

export type CardInfoResponse = {
    question: string;
    answer: string;
}
