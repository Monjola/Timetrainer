import { useEffect, useRef } from 'react';
import type { HistoricalSession } from '../types';

interface HistoryChartProps {
    history: HistoricalSession[];
}

export function HistoryChart({ history }: HistoryChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || history.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 30, right: 30, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Clear
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, width, height);

        // Y Axis Range (ms)
        // We want to show Offset and Std Dev. Offset can be positive/negative.
        // Let's determine the range.
        const allValues = history.flatMap(s => [s.meanOffset, s.stdDev]);
        const maxVal = Math.max(50, ...allValues.map(Math.abs)) * 1.2;
        const minVal = Math.min(-50, ...history.map(s => s.meanOffset)) * 1.2;
        const yRange = maxVal - minVal;

        const yToCanvas = (y: number) => padding.top + chartHeight - ((y - minVal) / yRange) * chartHeight;
        const xToCanvas = (index: number) => padding.left + (index / (history.length - 1)) * chartWidth;

        // Grid lines (horizontal)
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;
        [minVal, 0, maxVal / 2, maxVal].forEach(val => {
            const y = yToCanvas(val);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = '#666';
            ctx.font = '10px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(`${val.toFixed(0)}ms`, padding.left - 5, y + 3);
        });

        // Zero line
        const zeroY = yToCanvas(0);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(width - padding.right, zeroY);
        ctx.stroke();

        // Plot Std Dev (Blue)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        history.forEach((s, i) => {
            const x = xToCanvas(i);
            const y = yToCanvas(s.stdDev);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Plot Mean Offset (Orange)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        history.forEach((s, i) => {
            const x = xToCanvas(i);
            const y = yToCanvas(s.meanOffset);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('Offset', padding.left + 40, padding.top - 10);
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('Std Dev', padding.left + 100, padding.top - 10);

    }, [history]);

    if (history.length < 2) {
        return (
            <div className="history-chart empty">
                <p>Perform at least two sessions to see your progress graph.</p>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            className="history-chart-canvas"
            style={{ width: '100%', height: '250px', background: '#0a0a0f', borderRadius: '8px' }}
        />
    );
}
