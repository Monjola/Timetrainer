/**
 * StatsCalculator - Statistical analysis of timing offsets
 * 
 * Computes mean, standard deviation, and histogram for visualization.
 */

import { mean, standardDeviation, min, max } from 'simple-statistics';
import type { TimingOffset, SessionStats, HistogramBin, ConsistencyLevel, OffsetFeel, SkillAssessment } from '../types';

export class StatsCalculator {
  // Outlier threshold in standard deviations
  private static readonly OUTLIER_THRESHOLD_SIGMA = 4;

  /**
   * Calculate statistics from timing offsets, with outlier filtering
   */
  static calculate(offsets: TimingOffset[], binCount: number = 20): SessionStats {
    if (offsets.length === 0) {
      return {
        mean: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        count: 0,
        histogram: []
      };
    }

    // First pass: get raw values and initial stats for outlier detection
    const rawValues = offsets.map(o => o.offsetMs);
    
    // Filter outliers if we have enough data
    const filteredValues = this.filterOutliers(rawValues);

    const stats: SessionStats = {
      mean: mean(filteredValues),
      standardDeviation: filteredValues.length > 1 ? standardDeviation(filteredValues) : 0,
      min: min(filteredValues),
      max: max(filteredValues),
      count: filteredValues.length,
      histogram: this.createHistogram(filteredValues, binCount)
    };

    return stats;
  }

  /**
   * Filter out outliers beyond ±4 standard deviations
   * Uses iterative approach: calculate stats, remove outliers, recalculate
   */
  private static filterOutliers(values: number[]): number[] {
    if (values.length < 4) {
      // Not enough data to reliably detect outliers
      return values;
    }

    // Calculate initial mean and std dev
    const initialMean = mean(values);
    const initialStdDev = standardDeviation(values);

    if (initialStdDev === 0) {
      return values;
    }

    // Filter values within ±4σ
    const threshold = this.OUTLIER_THRESHOLD_SIGMA * initialStdDev;
    const filtered = values.filter(v => 
      Math.abs(v - initialMean) <= threshold
    );

    // Log if outliers were removed (for debugging)
    const removedCount = values.length - filtered.length;
    if (removedCount > 0) {
      console.log(`Filtered ${removedCount} outlier(s) beyond ±${this.OUTLIER_THRESHOLD_SIGMA}σ`);
    }

    return filtered;
  }

  /**
   * Create histogram bins from values
   */
  private static createHistogram(values: number[], binCount: number): HistogramBin[] {
    if (values.length === 0) return [];

    const minVal = min(values);
    const maxVal = max(values);
    
    // Ensure we have a reasonable range (at least ±50ms if data is very tight)
    const dataRange = maxVal - minVal;
    const displayRange = Math.max(dataRange, 100);
    const center = (minVal + maxVal) / 2;
    
    const rangeMin = center - displayRange / 2;
    const rangeMax = center + displayRange / 2;
    const binWidth = (rangeMax - rangeMin) / binCount;

    // Initialize bins
    const bins: HistogramBin[] = [];
    for (let i = 0; i < binCount; i++) {
      const binMin = rangeMin + i * binWidth;
      const binMax = rangeMin + (i + 1) * binWidth;
      bins.push({
        min: binMin,
        max: binMax,
        midpoint: (binMin + binMax) / 2,
        count: 0
      });
    }

    // Count values in each bin
    for (const value of values) {
      const binIndex = Math.floor((value - rangeMin) / binWidth);
      const clampedIndex = Math.max(0, Math.min(binCount - 1, binIndex));
      bins[clampedIndex].count++;
    }

    return bins;
  }

  /**
   * Calculate normal distribution PDF value
   * Used for overlaying the theoretical distribution on the histogram
   */
  static normalPDF(x: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return x === mean ? 1 : 0;
    
    const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  /**
   * Generate points for plotting the normal distribution curve
   */
  static generateNormalCurve(
    mean: number, 
    stdDev: number, 
    minX: number, 
    maxX: number, 
    pointCount: number = 100
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const step = (maxX - minX) / (pointCount - 1);

    for (let i = 0; i < pointCount; i++) {
      const x = minX + i * step;
      const y = this.normalPDF(x, mean, stdDev);
      points.push({ x, y });
    }

    return points;
  }

  /**
   * Calculate where standard deviation lines should be drawn
   */
  static getStdDevLines(mean: number, stdDev: number): Array<{ value: number; label: string }> {
    if (stdDev === 0) {
      return [{ value: mean, label: 'μ' }];
    }

    return [
      { value: mean - 3 * stdDev, label: '-3σ' },
      { value: mean - 2 * stdDev, label: '-2σ' },
      { value: mean - 1 * stdDev, label: '-1σ' },
      { value: mean, label: 'μ' },
      { value: mean + 1 * stdDev, label: '+1σ' },
      { value: mean + 2 * stdDev, label: '+2σ' },
      { value: mean + 3 * stdDev, label: '+3σ' },
    ];
  }

  /**
   * Interpret the results for the user
   */
  static interpretResults(stats: SessionStats): string {
    if (stats.count === 0) {
      return 'No data recorded.';
    }

    const parts: string[] = [];

    // Interpret mean (timing tendency)
    if (Math.abs(stats.mean) < 5) {
      parts.push('Your timing is well-centered (within ±5ms of the beat).');
    } else if (stats.mean < -5) {
      parts.push(`You tend to push (play early) by about ${Math.abs(stats.mean).toFixed(1)}ms on average.`);
    } else {
      parts.push(`You tend to drag (play late) by about ${stats.mean.toFixed(1)}ms on average.`);
    }

    // Interpret standard deviation (consistency)
    if (stats.standardDeviation < 8) {
      parts.push('Your timing is incredibly consistent - professional level!');
    } else if (stats.standardDeviation < 12) {
      parts.push('Your timing consistency is excellent.');
    } else if (stats.standardDeviation < 20) {
      parts.push('Your timing consistency is solid.');
    } else if (stats.standardDeviation < 35) {
      parts.push('Your timing has room for improvement - keep practicing!');
    } else {
      parts.push('Focus on internalizing the pulse and subdividing.');
    }

    return parts.join(' ');
  }

  /**
   * Assess skill level based on timing statistics
   * 
   * Consistency thresholds are based on standard deviation as a percentage of beat duration:
   * - Below 2.5%: Metronome-level
   * - 3%: Session pro
   * - 4%: Musician
   * - Below 5%: Intermediate
   * - Below 6%: Beginner
   * - Above 6%: Inconsistent
   * 
   * Offset (timing feel) based on where you sit relative to the beat:
   * - ±5ms: In the pocket / Groove
   * - ±10ms: Snap / Drive
   * - ±20-30ms: Dragging / Nervous
   * - Beyond ±40ms: Day job territory
   */
  static assessSkillLevel(stats: SessionStats, bpm: number): SkillAssessment {
    const beatDurationMs = (60 / bpm) * 1000;
    
    if (stats.count === 0) {
      return {
        consistencyLevel: 'inconsistent',
        consistencyTitle: 'No Data',
        consistencyEmoji: '❓',
        consistencyPercent: 0,
        consistencyDescription: 'Complete a session to see your assessment.',
        offsetFeel: 'in_the_pocket',
        offsetTitle: 'N/A',
        offsetDescription: 'N/A',
        offsetMs: 0,
      };
    }

    const { standardDeviation: sigma, mean: offset } = stats;
    
    // Calculate σ as percentage of beat duration
    const sigmaPercent = (sigma / beatDurationMs) * 100;

    // Determine consistency level based on percentage thresholds
    let consistencyLevel: ConsistencyLevel;
    let consistencyTitle: string;
    let consistencyEmoji: string;
    let consistencyDescription: string;

    if (sigmaPercent < 2.5) {
      consistencyLevel = 'metronome';
      consistencyTitle = 'Metronome';
      consistencyEmoji = '🤖';
      consistencyDescription = 'Inhuman precision. Are you a drum machine?';
    } else if (sigmaPercent < 3) {
      consistencyLevel = 'session_pro';
      consistencyTitle = 'Session Pro';
      consistencyEmoji = '🎯';
      consistencyDescription = 'Studio-grade consistency. Ready for any session.';
    } else if (sigmaPercent < 4) {
      consistencyLevel = 'musician';
      consistencyTitle = 'Musician';
      consistencyEmoji = '🎸';
      consistencyDescription = 'Tight timing that holds down any groove.';
    } else if (sigmaPercent < 5) {
      consistencyLevel = 'intermediate';
      consistencyTitle = 'Intermediate';
      consistencyEmoji = '📈';
      consistencyDescription = 'Solid foundation. Keep refining your pocket.';
    } else if (sigmaPercent < 6) {
      consistencyLevel = 'beginner';
      consistencyTitle = 'Beginner';
      consistencyEmoji = '🌱';
      consistencyDescription = 'Building consistency. Focus on feeling the subdivision.';
    } else {
      consistencyLevel = 'inconsistent';
      consistencyTitle = 'Inconsistent';
      consistencyEmoji = '🎲';
      consistencyDescription = 'Work on locking in with the metronome.';
    }

    // Determine offset feel based on the image reference
    // In our internal representation:
    //   Negative offset = input came BEFORE expected = early/ahead/on top
    //   Positive offset = input came AFTER expected = late/behind/dragging
    // 
    // But the user's reference image shows:
    //   Positive (+) = on top / ahead
    //   Negative (-) = behind / dragging
    //
    // So we flip the sign for display purposes
    const displayOffset = -offset; // Flip for display: early becomes +, late becomes -
    const absOffset = Math.abs(offset);
    
    let offsetFeel: OffsetFeel;
    let offsetTitle: string;
    let offsetDescription: string;

    if (absOffset <= 5) {
      offsetFeel = 'in_the_pocket';
      offsetTitle = 'In the Pocket';
      offsetDescription = 'Right where it feels good. Perfect placement.';
    } else if (absOffset <= 10) {
      if (offset < 0) {
        // Early = on top
        offsetFeel = 'snap';
        offsetTitle = 'Snap';
        offsetDescription = 'Slightly on top - adds energy and urgency.';
      } else {
        // Late = behind
        offsetFeel = 'groove';
        offsetTitle = 'Groove';
        offsetDescription = 'Laid back - relaxed, behind-the-beat feel.';
      }
    } else if (absOffset <= 20) {
      if (offset < 0) {
        offsetFeel = 'drive';
        offsetTitle = 'Drive';
        offsetDescription = 'Pushing forward - creates momentum and excitement.';
      } else {
        offsetFeel = 'dragging';
        offsetTitle = 'Dragging';
        offsetDescription = 'Behind the beat - may feel sluggish.';
      }
    } else if (absOffset <= 40) {
      if (offset < 0) {
        offsetFeel = 'nervous';
        offsetTitle = 'Nervous';
        offsetDescription = 'Rushing - try to relax and breathe with the tempo.';
      } else {
        offsetFeel = 'dragging';
        offsetTitle = 'Dragging';
        offsetDescription = 'Falling behind - focus on anticipating the beat.';
      }
    } else {
      if (offset < 0) {
        offsetFeel = 'day_job';
        offsetTitle = 'Day Job';
        offsetDescription = 'Way too far ahead - slow down and lock in with the click.';
      } else {
        offsetFeel = 'day_job';
        offsetTitle = 'Get Some Sleep';
        offsetDescription = 'Significantly behind - work on feeling the pulse.';
      }
    }

    return {
      consistencyLevel,
      consistencyTitle,
      consistencyEmoji,
      consistencyPercent: sigmaPercent,
      consistencyDescription,
      offsetFeel,
      offsetTitle,
      offsetDescription,
      offsetMs: displayOffset, // Flipped: + = ahead/on top, - = behind/dragging
    };
  }
}

