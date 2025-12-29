/**
 * StatsCalculator - Statistical analysis of timing offsets
 * 
 * Computes mean, standard deviation, and histogram for visualization.
 */

import { mean, standardDeviation, min, max } from 'simple-statistics';
import type { TimingOffset, SessionStats, HistogramBin, SkillLevel, SkillAssessment } from '../types';

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
   * Thresholds are based on standard deviation (σ):
   * - σ represents the spread of timing offsets
   * - 95% of hits fall within ±2σ of the mean
   * 
   * For example, σ = 8ms means 95% of hits are within ±16ms of where you're aiming
   */
  static assessSkillLevel(stats: SessionStats): SkillAssessment {
    if (stats.count === 0) {
      return {
        level: 'just_starting',
        title: 'No Data',
        emoji: '❓',
        description: 'Complete a session to see your skill assessment.',
        consistencyRating: 'N/A',
        timingTendency: 'N/A',
        range95: 0,
      };
    }

    const { standardDeviation: sigma, mean: meanOffset } = stats;
    const absMean = Math.abs(meanOffset);
    const range95 = sigma * 2; // ±2σ contains 95% of hits

    // Determine consistency level based on corrected σ thresholds
    // These represent standard deviation, NOT range
    let level: SkillLevel;
    let title: string;
    let emoji: string;
    let consistencyRating: string;

    if (sigma < 4) {
      level = 'metronome';
      title = 'Metronome';
      emoji = '🤖';
      consistencyRating = 'Inhuman precision';
    } else if (sigma < 8) {
      level = 'session_pro';
      title = 'Session Pro';
      emoji = '🎯';
      consistencyRating = 'Studio-grade consistency';
    } else if (sigma < 12) {
      level = 'gigging_musician';
      title = 'Gigging Musician';
      emoji = '🎸';
      consistencyRating = 'Stage-ready timing';
    } else if (sigma < 20) {
      level = 'intermediate';
      title = 'Intermediate';
      emoji = '📈';
      consistencyRating = 'Solid foundation';
    } else if (sigma < 35) {
      level = 'beginner';
      title = 'Beginner';
      emoji = '🌱';
      consistencyRating = 'Building consistency';
    } else {
      level = 'just_starting';
      title = 'Just Starting';
      emoji = '🎵';
      consistencyRating = 'Keep practicing!';
    }

    // Assess timing tendency (where you sit relative to the beat)
    let timingTendency: string;
    if (absMean < 5) {
      timingTendency = 'Right on the beat';
    } else if (absMean < 15) {
      timingTendency = meanOffset < 0 ? 'Slightly ahead (pushing)' : 'Slightly behind (in the pocket)';
    } else if (absMean < 30) {
      timingTendency = meanOffset < 0 ? 'Pushing the beat' : 'Laying back';
    } else {
      timingTendency = meanOffset < 0 ? 'Rushing significantly' : 'Dragging significantly';
    }

    // Generate description based on level
    const descriptions: Record<SkillLevel, string> = {
      metronome: 'Your timing is unnaturally precise. Either you\'re a machine, or you\'ve achieved rhythmic enlightenment.',
      session_pro: 'This is professional-level timing. Studios would hire you to lay down tracks. 95% of your hits are within ±' + range95.toFixed(0) + 'ms.',
      gigging_musician: 'Tight enough to hold down a groove in any band. Your timing won\'t let the song down.',
      intermediate: 'You\'ve got solid timing fundamentals. Regular practice will tighten this up further.',
      beginner: 'You\'re finding the groove! Focus on subdividing and internalizing the pulse.',
      just_starting: 'Timing is a skill that develops with practice. Try slower tempos and shorter sessions.',
    };

    return {
      level,
      title,
      emoji,
      description: descriptions[level],
      consistencyRating,
      timingTendency,
      range95,
    };
  }
}

