import type { InputMethod } from '../types';

export interface HistoryFilterState {
    limit: number;
    inputMethod: InputMethod | 'all';
    minBpm: number;
    maxBpm: number;
    minBeats: number;
}

interface HistoryFiltersProps {
    filters: HistoryFilterState;
    onChange: (filters: HistoryFilterState) => void;
    maxSessions: number;
}

export function HistoryFilters({ filters, onChange, maxSessions }: HistoryFiltersProps) {
    const handleChange = (key: keyof HistoryFilterState, value: any) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <div className="history-filters">
            <div className="filter-group">
                <label>Last X Sessions: {filters.limit}</label>
                <input
                    type="range"
                    min="1"
                    max={Math.max(1, maxSessions)}
                    value={filters.limit}
                    onChange={(e) => handleChange('limit', parseInt(e.target.value))}
                />
            </div>

            <div className="filter-row">
                <div className="filter-group">
                    <label>Input Type</label>
                    <select
                        value={filters.inputMethod}
                        onChange={(e) => handleChange('inputMethod', e.target.value)}
                    >
                        <option value="all">All Methods</option>
                        <option value="keyboard">Keyboard</option>
                        <option value="audio">Microphone</option>
                        <option value="midi">MIDI</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Min BPM</label>
                    <input
                        type="number"
                        min="40"
                        max="300"
                        value={filters.minBpm}
                        onChange={(e) => handleChange('minBpm', parseInt(e.target.value) || 0)}
                    />
                </div>

                <div className="filter-group">
                    <label>Max BPM</label>
                    <input
                        type="number"
                        min="40"
                        max="300"
                        value={filters.maxBpm}
                        onChange={(e) => handleChange('maxBpm', parseInt(e.target.value) || 0)}
                    />
                </div>

                <div className="filter-group">
                    <label>Min Beats</label>
                    <input
                        type="number"
                        min="0"
                        value={filters.minBeats}
                        onChange={(e) => handleChange('minBeats', parseInt(e.target.value) || 0)}
                    />
                </div>
            </div>
        </div>
    );
}
