import type { HistoricalSession } from '../types';

const STORAGE_KEY = 'timetrainer_history';

class HistoryManager {
    private history: HistoricalSession[] = [];

    constructor() {
        this.load();
    }

    private load(): void {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                this.history = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse history', e);
                this.history = [];
            }
        }
    }

    private save(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    }

    getHistory(): HistoricalSession[] {
        return [...this.history];
    }

    addSession(session: HistoricalSession): void {
        this.history.push(session);
        this.save();
    }

    clearHistory(): void {
        this.history = [];
        this.save();
    }
}

export const historyManager = new HistoryManager();
