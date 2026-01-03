import { useEffect, useRef, useState, useMemo } from 'react';
import type { TimingOffset } from '../types';
import { StatsCalculator } from '../core/StatsCalculator';

interface ControlChartProps {
    offsets: TimingOffset[];
    bpm: number;
    isRunning: boolean;
    isPlaying: boolean;
    currentTime: number; // Playback time in seconds
    totalDuration: number; // In seconds
    loopStart: number;
    loopEnd: number;
    onSeek: (time: number) => void;
    onLoopChange: (start: number, end: number) => void;
}

export function ControlChart({
    offsets,
    bpm,
    isRunning,
    currentTime,
    totalDuration,
    loopStart,
    loopEnd,
    onSeek,
    onLoopChange
}: ControlChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Interaction state
    const [isDragging, setIsDragging] = useState<'playhead' | 'loopStart' | 'loopEnd' | null>(null);

    // Stats calculation (memoized)
    const stats = useMemo(() => {
        // Determine which offsets to use for stats
        const beatDuration = 60 / bpm;

        // Filter offsets within loop range (based on offset.timestamp relative to start)
        // We assume offset.beatIndex * beatDuration is the relative time

        const activeOffsets = offsets.filter(o => {
            const time = o.beatIndex * beatDuration;
            return time >= loopStart && time <= loopEnd;
        });

        return StatsCalculator.calculate(activeOffsets);
    }, [offsets, loopStart, loopEnd, bpm]);

    // Canvas drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // Use container dimensions
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Config
        const padding = { top: 20, right: 20, bottom: 30, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Data Ranges
        // Y-Axis: Fixed range or dynamic? 
        // Use dynamic range with minimum of ±50ms
        const maxOffset = Math.max(50, ...offsets.map(o => Math.abs(o.offsetMs)));
        const yRange = maxOffset * 1.2; // Add headroom

        // X-Axis: Time
        // Ensure we show at least the total duration, or extend if offsets go beyond
        const xMax = Math.max(totalDuration, offsets.length * (60 / bpm));

        // Coordinate Transformers
        const timeToX = (t: number) => padding.left + (t / xMax) * chartWidth;
        const offsetToY = (ms: number) => padding.top + (chartHeight / 2) + (ms / yRange) * (chartHeight / 2);

        // --- Draw Grid & Zones ---

        // Green zone (±25ms)
        const y25 = offsetToY(25);
        const yMinus25 = offsetToY(-25);
        ctx.fillStyle = 'rgba(0, 255, 136, 0.05)';
        ctx.fillRect(padding.left, yMinus25, chartWidth, y25 - yMinus25);

        // Center Line
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.moveTo(padding.left, offsetToY(0));
        ctx.lineTo(width - padding.right, offsetToY(0));
        ctx.stroke();

        // Reference Lines (±10ms, ±20ms, etc.)
        const referenceLines = [-50, -40, -30, -20, -10, 10, 20, 30, 40, 50];
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';

        referenceLines.forEach(ms => {
            if (Math.abs(ms) > maxOffset * 1.5) return; // Skip if out of view

            const y = offsetToY(ms);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillText(`${ms > 0 ? '+' : ''}${ms}`, padding.left - 5, y + 3);
        });

        // --- Draw Control Limits (Mean ± 3σ) ---
        if (stats.count > 1) {
            const meanY = offsetToY(stats.mean);
            const uclY = offsetToY(stats.mean + 3 * stats.standardDeviation); // Upper Control Limit
            const lclY = offsetToY(stats.mean - 3 * stats.standardDeviation); // Lower Control Limit

            // Mean Line
            ctx.beginPath();
            ctx.strokeStyle = '#4a9eff'; // Blue
            ctx.setLineDash([5, 5]);
            ctx.moveTo(padding.left, meanY);
            ctx.lineTo(width - padding.right, meanY);
            ctx.stroke();

            ctx.fillStyle = '#4a9eff';
            ctx.font = '10px monospace';
            ctx.fillText('x̄', padding.left - 15, meanY + 3);

            // Control Limits
            ctx.strokeStyle = '#ff4a4a'; // Red
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.moveTo(padding.left, uclY);
            ctx.lineTo(width - padding.right, uclY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(padding.left, lclY);
            ctx.lineTo(width - padding.right, lclY);
            ctx.stroke();

            // Labels
            ctx.fillStyle = '#ff4a4a';
            ctx.fillText('UCL', padding.left - 25, uclY + 3);
            ctx.fillText('LCL', padding.left - 25, lclY + 3);
        }

        // --- Draw Data Points ---
        const beatDuration = 60 / bpm;

        ctx.lineWidth = 2;

        // Connect lines
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';

        let first = true;
        offsets.forEach((o) => {
            const time = o.beatIndex * beatDuration;
            const x = timeToX(time);
            const y = offsetToY(o.offsetMs);

            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw dots
        offsets.forEach((o) => {
            const time = o.beatIndex * beatDuration;
            const x = timeToX(time);
            const y = offsetToY(o.offsetMs);
            const inLoop = time >= loopStart && time <= loopEnd;

            ctx.beginPath();
            ctx.arc(x, y, inLoop ? 3 : 2, 0, Math.PI * 2);

            // Color based on value
            const isLate = o.offsetMs > 0;
            // Logic: specific colors for in-loop vs out-loop
            ctx.fillStyle = inLoop
                ? (Math.abs(o.offsetMs) < 25 ? '#00ff88' : (isLate ? '#ffaa00' : '#00aaff'))
                : '#444'; // Dim outside loop

            ctx.fill();
        });

        // --- Draw Overlay Elements (Playhead, Loop) ---
        if (!isRunning) {
            // Loop Region
            const loopStartX = timeToX(loopStart);
            const loopEndX = timeToX(loopEnd);

            // Dim areas outside loop
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            // Left dim
            ctx.fillRect(padding.left, padding.top, Math.max(0, loopStartX - padding.left), chartHeight);
            // Right dim
            ctx.fillRect(loopEndX, padding.top, Math.max(0, width - padding.right - loopEndX), chartHeight);

            // Trim Lines
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;

            // Start Line
            ctx.beginPath();
            ctx.moveTo(loopStartX, padding.top);
            ctx.lineTo(loopStartX, height - padding.bottom);
            ctx.stroke();

            // End Line
            ctx.beginPath();
            ctx.moveTo(loopEndX, padding.top);
            ctx.lineTo(loopEndX, height - padding.bottom);
            ctx.stroke();

            // Loop Handles (Triangles)
            ctx.fillStyle = '#fff';
            // Start Handle
            ctx.beginPath();
            ctx.moveTo(loopStartX, padding.top);
            ctx.lineTo(loopStartX + 8, padding.top - 10);
            ctx.lineTo(loopStartX - 8, padding.top - 10);
            ctx.fill();

            // End Handle
            ctx.beginPath();
            ctx.moveTo(loopEndX, padding.top);
            ctx.lineTo(loopEndX + 8, padding.top - 10);
            ctx.lineTo(loopEndX - 8, padding.top - 10);
            ctx.fill();

        }

        // Playhead
        const playheadX = timeToX(currentTime);
        if (playheadX >= padding.left && playheadX <= width - padding.right) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(playheadX, padding.top);
            ctx.lineTo(playheadX, height - padding.bottom);
            ctx.stroke();

            // Head
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(playheadX, height - padding.bottom);
            ctx.lineTo(playheadX - 6, height - padding.bottom + 10);
            ctx.lineTo(playheadX + 6, height - padding.bottom + 10);
            ctx.fill();
        }

    }, [offsets, stats, loopStart, loopEnd, currentTime, totalDuration, isRunning, bpm]); // Removed container/canvas refs from dep, just rely on effect firing

    // Handle Mouse Interaction
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isRunning) return; // No interaction during recording

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 50, right: 20 };
        const width = rect.width;
        const chartWidth = width - padding.left - padding.right;

        // Transform X to Time
        const xToTime = (xCoord: number) => {
            const relativeX = xCoord - padding.left;
            const xMax = Math.max(totalDuration, offsets.length * (60 / bpm));
            return (relativeX / chartWidth) * xMax;
        };

        const clickTime = xToTime(x);

        // Check click targets (with tolerance)
        const timeThreshold = totalDuration * 0.05; // 5% tolerance

        if (Math.abs(clickTime - loopStart) < timeThreshold) {
            setIsDragging('loopStart');
        } else if (Math.abs(clickTime - loopEnd) < timeThreshold) {
            setIsDragging('loopEnd');
        } else {
            setIsDragging('playhead');
            onSeek(Math.max(0, Math.min(totalDuration, clickTime)));
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 50, right: 20 };
        const width = rect.width;
        const chartWidth = width - padding.left - padding.right;

        const xMax = Math.max(totalDuration, offsets.length * (60 / bpm));
        const rawTime = ((x - padding.left) / chartWidth) * xMax;
        const time = Math.max(0, Math.min(xMax, rawTime)); // Clamp to max, not just duration

        if (isDragging === 'playhead') {
            onSeek(time);
        } else if (isDragging === 'loopStart') {
            // Don't cross loopEnd
            onLoopChange(Math.min(time, loopEnd - 0.1), loopEnd);
        } else if (isDragging === 'loopEnd') {
            // Don't cross loopStart
            onLoopChange(loopStart, Math.max(time, loopStart + 0.1));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(null);
    };

    return (
        <div
            ref={containerRef}
            className="control-chart-container"
            style={{ position: 'relative', width: '100%', height: '300px', background: '#0a0a0f', borderRadius: '8px', overflow: 'hidden' }}
        >
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', cursor: isRunning ? 'default' : 'pointer' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
            {/* Legend / Stats Overlay */}
            <div style={{ position: 'absolute', top: 10, right: 20, color: '#888', fontSize: '12px', textAlign: 'right', pointerEvents: 'none' }}>
                <div>Mean: <span style={{ color: '#4a9eff' }}>{(-stats.mean).toFixed(1)}ms</span></div>
                <div>StdDev (σ): <span style={{ color: '#fff' }}>{stats.standardDeviation.toFixed(1)}ms</span></div>
                <div>Count: {stats.count}</div>
            </div>
        </div>
    );
}
