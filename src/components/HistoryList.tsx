import type { HistoricalSession } from '../types';

interface HistoryListProps {
    history: HistoricalSession[];
    onClear: () => void;
    onSelectSession: (session: HistoricalSession) => void;
}

export function HistoryList({ history, onClear, onSelectSession }: HistoryListProps) {
    if (history.length === 0) {
        return (
            <div className="history-list empty">
                <p>No practice sessions recorded yet.</p>
            </div>
        );
    }

    return (
        <div className="history-list-container">
            <div className="history-header">
                <h3>Session History</h3>
                <button className="clear-history-button" onClick={(e) => { e.stopPropagation(); onClear(); }}>Clear All</button>
            </div>
            <div className="history-table-wrapper">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>BPM</th>
                            <th>Beats</th>
                            <th>Input</th>
                            <th>Std Dev</th>
                            <th>Offset</th>
                            <th>Rating</th>
                            <th>Feel</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...history].reverse().map((session) => {
                            const date = new Date(session.date);
                            return (
                                <tr
                                    key={session.id}
                                    onClick={() => onSelectSession(session)}
                                    className="history-row"
                                    title={session.result ? "Click to review this session" : "No detailed data available for this session"}
                                >
                                    <td>{date.toLocaleDateString()}</td>
                                    <td>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td>{session.bpm}</td>
                                    <td>{session.durationBeats}</td>
                                    <td className="capitalize">{session.inputMethod}</td>
                                    <td className="stat-cell">{session.stdDev.toFixed(1)}ms</td>
                                    <td className={`stat-cell ${session.meanOffset >= 0 ? 'early' : 'late'}`}>
                                        {session.meanOffset >= 0 ? '+' : ''}{session.meanOffset.toFixed(1)}ms
                                    </td>
                                    <td>{session.precisionRating}</td>
                                    <td>{session.timingFeel}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
