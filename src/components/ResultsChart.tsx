/**
 * ResultsChart - Histogram visualization with normal distribution overlay
 * 
 * Renders a canvas-based chart showing:
 * - Histogram bars of timing offsets
 * - Normal distribution curve overlay
 * - Vertical lines for mean and standard deviations
 */

import { useEffect, useRef } from 'react';
import type { SessionStats } from '../types';
import { StatsCalculator } from '../core/StatsCalculator';

interface ResultsChartProps {
  stats: SessionStats;
  bpm: number;
}

export function ResultsChart({ stats, bpm }: ResultsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || stats.count === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 40, right: 30, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    if (stats.histogram.length === 0) return;

    // Calculate axis ranges
    const histogramMin = stats.histogram[0].min;
    const histogramMax = stats.histogram[stats.histogram.length - 1].max;
    
    // Extend range to show ±3σ if they fit
    const xMin = Math.min(histogramMin, stats.mean - 3.5 * stats.standardDeviation);
    const xMax = Math.max(histogramMax, stats.mean + 3.5 * stats.standardDeviation);
    const xRange = xMax - xMin;

    const maxCount = Math.max(...stats.histogram.map(b => b.count));
    const yMax = maxCount * 1.2; // Add some headroom

    // Helper functions
    const xToCanvas = (x: number) => padding.left + ((x - xMin) / xRange) * chartWidth;
    const yToCanvas = (y: number) => padding.top + chartHeight - (y / yMax) * chartHeight;

    // Draw grid lines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    
    // Vertical grid at standard deviations
    const stdDevLines = StatsCalculator.getStdDevLines(stats.mean, stats.standardDeviation);
    for (const line of stdDevLines) {
      const x = xToCanvas(line.value);
      if (x >= padding.left && x <= width - padding.right) {
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
      }
    }

    // Draw histogram bars
    const barPadding = 1;
    for (const bin of stats.histogram) {
      const x = xToCanvas(bin.min) + barPadding;
      const barWidth = (xToCanvas(bin.max) - xToCanvas(bin.min)) - barPadding * 2;
      const barHeight = (bin.count / yMax) * chartHeight;
      const y = yToCanvas(bin.count);

      // Gradient fill based on position (early = blue, late = orange)
      const normalizedMid = (bin.midpoint - xMin) / xRange;
      const hue = normalizedMid < 0.5 ? 200 : 30; // Blue for early, orange for late
      const saturation = Math.abs(normalizedMid - 0.5) * 100 + 30;
      
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, 50%, 0.7)`;
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Bar border
      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 60%, 0.9)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
    }

    // Draw normal distribution curve
    if (stats.standardDeviation > 0) {
      const curvePoints = StatsCalculator.generateNormalCurve(
        stats.mean, 
        stats.standardDeviation, 
        xMin, 
        xMax, 
        200
      );

      // Scale the curve to match histogram height
      const binWidth = stats.histogram[0].max - stats.histogram[0].min;
      const scaleFactor = stats.count * binWidth;
      
      ctx.beginPath();
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      
      let started = false;
      for (const point of curvePoints) {
        const x = xToCanvas(point.x);
        const y = yToCanvas(point.y * scaleFactor);
        
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw vertical lines for mean and std devs
    const lineColors: Record<string, string> = {
      'μ': '#ffffff',
      '-1σ': '#888888',
      '+1σ': '#888888',
      '-2σ': '#555555',
      '+2σ': '#555555',
      '-3σ': '#333333',
      '+3σ': '#333333',
    };

    for (const line of stdDevLines) {
      const x = xToCanvas(line.value);
      if (x >= padding.left && x <= width - padding.right) {
        ctx.beginPath();
        ctx.strokeStyle = lineColors[line.label] || '#666666';
        ctx.lineWidth = line.label === 'μ' ? 2 : 1;
        ctx.setLineDash(line.label === 'μ' ? [] : [5, 5]);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = lineColors[line.label] || '#666666';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(line.label, x, padding.top - 8);
        
        // Value below axis - flip sign for display (+ = on top, - = behind)
        const displayValue = -line.value;
        ctx.fillStyle = '#666666';
        ctx.font = '10px system-ui';
        ctx.fillText(`${displayValue >= 0 ? '+' : ''}${displayValue.toFixed(0)}ms`, x, height - padding.bottom + 30);
      }
    }

    // Draw axes
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    
    // X axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Y axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // Zero line (the beat)
    const zeroX = xToCanvas(0);
    if (zeroX >= padding.left && zeroX <= width - padding.right) {
      ctx.beginPath();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.moveTo(zeroX, padding.top);
      ctx.lineTo(zeroX, height - padding.bottom);
      ctx.stroke();
      
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('BEAT', zeroX, height - padding.bottom + 45);
    }

    // Axis labels - Note: internal values are negative=early, positive=late
    // But we display as: left = ahead/on top (+), right = behind/dragging (-)
    ctx.fillStyle = '#888888';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('← On top (+) | Behind (-) →', width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Count', 0, 0);
    ctx.restore();

  }, [stats]);

  if (stats.count === 0) {
    return (
      <div className="results-chart empty">
        <p>No data to display</p>
      </div>
    );
  }

  const assessment = StatsCalculator.assessSkillLevel(stats, bpm);
  const beatDurationMs = (60 / bpm) * 1000;

  return (
    <div className="results-chart">
      {/* Two-column assessment badges */}
      <div className="assessment-badges">
        {/* Consistency Badge */}
        <div className={`assessment-badge consistency-${assessment.consistencyLevel}`}>
          <span className="badge-emoji">{assessment.consistencyEmoji}</span>
          <div className="badge-info">
            <span className="badge-title">{assessment.consistencyTitle}</span>
            <span className="badge-subtitle">Consistency</span>
          </div>
        </div>

        {/* Offset Badge */}
        <div className={`assessment-badge offset-${assessment.offsetFeel}`}>
          <span className="badge-emoji">{assessment.offsetMs >= 0 ? '🎯' : '⚡'}</span>
          <div className="badge-info">
            <span className="badge-title">{assessment.offsetTitle}</span>
            <span className="badge-subtitle">Timing Feel</span>
          </div>
        </div>
      </div>

      <canvas 
        ref={canvasRef} 
        className="chart-canvas"
        style={{ width: '100%', height: '300px' }}
      />
      
      <div className="stats-summary">
        <div className="stat-item">
          <span className="stat-label">Offset</span>
          <span className={`stat-value ${assessment.offsetMs >= 0 ? 'early' : 'late'}`}>
            {assessment.offsetMs >= 0 ? '+' : ''}{assessment.offsetMs.toFixed(1)}ms
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Std Dev (σ)</span>
          <span className="stat-value">{stats.standardDeviation.toFixed(1)}ms</span>
        </div>
        <div className="stat-item highlight">
          <span className="stat-label">σ of Beat</span>
          <span className="stat-value">{assessment.consistencyPercent.toFixed(1)}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Samples</span>
          <span className="stat-value">{stats.count}</span>
        </div>
      </div>

      {/* Offset interpretation */}
      <div className="assessment-section">
        <div className="assessment-header">
          <span className="assessment-label">Timing Feel</span>
          <span className={`assessment-value offset-${assessment.offsetFeel}`}>
            {assessment.offsetTitle}
          </span>
        </div>
        <p className="assessment-description">{assessment.offsetDescription}</p>
      </div>

      {/* Consistency interpretation */}
      <div className="assessment-section">
        <div className="assessment-header">
          <span className="assessment-label">Consistency</span>
          <span className={`assessment-value consistency-${assessment.consistencyLevel}`}>
            {assessment.consistencyTitle}
          </span>
        </div>
        <p className="assessment-description">{assessment.consistencyDescription}</p>
      </div>

      {/* Consistency scale */}
      <div className="consistency-scale">
        <h4>Consistency Levels <span className="scale-note">(σ as % of beat at {bpm} BPM = {beatDurationMs.toFixed(0)}ms)</span></h4>
        <div className="scale-bar">
          <div className="scale-segments">
            <div className={`scale-segment metronome ${assessment.consistencyLevel === 'metronome' ? 'current' : ''}`}>
              <span className="segment-label">🤖 Metronome</span>
              <span className="segment-value">&lt;2.5%</span>
            </div>
            <div className={`scale-segment session_pro ${assessment.consistencyLevel === 'session_pro' ? 'current' : ''}`}>
              <span className="segment-label">🎯 Session Pro</span>
              <span className="segment-value">&lt;3%</span>
            </div>
            <div className={`scale-segment musician ${assessment.consistencyLevel === 'musician' ? 'current' : ''}`}>
              <span className="segment-label">🎸 Musician</span>
              <span className="segment-value">&lt;4%</span>
            </div>
            <div className={`scale-segment intermediate ${assessment.consistencyLevel === 'intermediate' ? 'current' : ''}`}>
              <span className="segment-label">📈 Intermediate</span>
              <span className="segment-value">&lt;5%</span>
            </div>
            <div className={`scale-segment beginner ${assessment.consistencyLevel === 'beginner' ? 'current' : ''}`}>
              <span className="segment-label">🌱 Beginner</span>
              <span className="segment-value">&lt;6%</span>
            </div>
            <div className={`scale-segment inconsistent ${assessment.consistencyLevel === 'inconsistent' ? 'current' : ''}`}>
              <span className="segment-label">🎲 Inconsistent</span>
              <span className="segment-value">&gt;6%</span>
            </div>
          </div>
          <div 
            className="scale-marker" 
            style={{ left: `${Math.min(100, (assessment.consistencyPercent / 8) * 100)}%` }}
          />
        </div>
      </div>

      {/* Offset scale reference - follows user's image: + = on top, - = behind */}
      <div className="offset-scale">
        <h4>Offset Reference</h4>
        <div className="offset-ruler">
          <div className="ruler-labels">
            <span className="ruler-label extreme">Day Job</span>
            <span className="ruler-label">Nervous</span>
            <span className="ruler-label">Drive</span>
            <span className="ruler-label good">Snap</span>
            <span className="ruler-label center">Pocket</span>
            <span className="ruler-label good">Groove</span>
            <span className="ruler-label">Dragging</span>
            <span className="ruler-label extreme">Get Sleep</span>
          </div>
          <div className="ruler-bar">
            <div 
              className="ruler-marker"
              style={{ 
                // assessment.offsetMs: + = ahead (left), - = behind (right)
                // Scale: +40ms = 0%, 0ms = 50%, -40ms = 100%
                left: `${Math.max(0, Math.min(100, 50 - (assessment.offsetMs / 40) * 50))}%` 
              }}
            />
          </div>
          <div className="ruler-values">
            <span>+40ms</span>
            <span>+20ms</span>
            <span>+10ms</span>
            <span>0</span>
            <span>-10ms</span>
            <span>-20ms</span>
            <span>-40ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

