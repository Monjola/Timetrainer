/**
 * PatternUtils - Utilities for beat pattern creation and manipulation
 */

import type { TimeSignature, BeatPattern, DrumSoundType, PatternPreset } from '../types';

/**
 * Get the number of beats per measure for a time signature
 */
export function getBeatsPerMeasure(timeSignature: TimeSignature): number {
  switch (timeSignature) {
    case '4/4': return 4;
    case '3/4': return 3;
    case '6/8': return 6; // 6 eighth notes
    default: return 4;
  }
}

/**
 * Get the default subdivisions per beat for a time signature
 */
export function getDefaultSubdivisions(timeSignature: TimeSignature): number {
  switch (timeSignature) {
    case '4/4': return 2; // 8th notes by default
    case '3/4': return 2; // 8th notes by default
    case '6/8': return 1; // Already in 8ths, so 1 subdivision per "beat"
    default: return 2;
  }
}

/**
 * Create an empty pattern grid
 */
export function createEmptyGrid(timeSignature: TimeSignature, subdivisionsPerBeat: number): DrumSoundType[][] {
  const beats = getBeatsPerMeasure(timeSignature);
  const totalSubdivisions = beats * subdivisionsPerBeat;
  
  // Each subdivision can have multiple sounds layered
  return Array.from({ length: totalSubdivisions }, () => []);
}

/**
 * Create a default pattern (just click on beats)
 */
export function createDefaultPattern(timeSignature: TimeSignature): BeatPattern {
  const subdivisionsPerBeat = getDefaultSubdivisions(timeSignature);
  const beats = getBeatsPerMeasure(timeSignature);
  const grid = createEmptyGrid(timeSignature, subdivisionsPerBeat);
  
  // Add accent on first beat, regular click on others
  for (let beat = 0; beat < beats; beat++) {
    const subdivisionIndex = beat * subdivisionsPerBeat;
    if (beat === 0) {
      grid[subdivisionIndex] = ['hihat_open']; // Accent on 1
    } else {
      grid[subdivisionIndex] = ['hihat_closed']; // Regular click
    }
  }
  
  return {
    timeSignature,
    subdivisionsPerBeat,
    grid
  };
}

/**
 * Toggle a sound at a specific subdivision
 */
export function toggleSound(
  pattern: BeatPattern, 
  subdivisionIndex: number, 
  sound: DrumSoundType
): BeatPattern {
  const newGrid = pattern.grid.map((sounds, i) => {
    if (i !== subdivisionIndex) return [...sounds];
    
    // If sound is already there, remove it
    if (sounds.includes(sound)) {
      return sounds.filter(s => s !== sound);
    }
    
    // Add the sound
    return [...sounds, sound];
  });
  
  return { ...pattern, grid: newGrid };
}

/**
 * Check if a sound is active at a subdivision
 */
export function hasSound(pattern: BeatPattern, subdivisionIndex: number, sound: DrumSoundType): boolean {
  return pattern.grid[subdivisionIndex]?.includes(sound) ?? false;
}

/**
 * Preset patterns
 */
export const PATTERN_PRESETS: PatternPreset[] = [
  {
    name: 'Simple Click',
    pattern: createDefaultPattern('4/4')
  },
  {
    name: 'Basic Rock',
    pattern: {
      timeSignature: '4/4',
      subdivisionsPerBeat: 2,
      grid: [
        ['kick', 'hihat_closed'],           // 1
        ['hihat_closed'],                    // 1+
        ['snare', 'hihat_closed'],          // 2
        ['hihat_closed'],                    // 2+
        ['kick', 'hihat_closed'],           // 3
        ['hihat_closed'],                    // 3+
        ['snare', 'hihat_closed'],          // 4
        ['hihat_closed'],                    // 4+
      ]
    }
  },
  {
    name: 'Four on Floor',
    pattern: {
      timeSignature: '4/4',
      subdivisionsPerBeat: 2,
      grid: [
        ['kick', 'hihat_closed'],           // 1
        ['hihat_closed'],                    // 1+
        ['kick', 'snare', 'hihat_closed'],  // 2
        ['hihat_closed'],                    // 2+
        ['kick', 'hihat_closed'],           // 3
        ['hihat_closed'],                    // 3+
        ['kick', 'snare', 'hihat_closed'],  // 4
        ['hihat_closed'],                    // 4+
      ]
    }
  },
  {
    name: 'Waltz',
    pattern: {
      timeSignature: '3/4',
      subdivisionsPerBeat: 2,
      grid: [
        ['kick', 'hihat_open'],             // 1
        [],                                  // 1+
        ['hihat_closed'],                    // 2
        [],                                  // 2+
        ['hihat_closed'],                    // 3
        [],                                  // 3+
      ]
    }
  },
  {
    name: '6/8 Feel',
    pattern: {
      timeSignature: '6/8',
      subdivisionsPerBeat: 1,
      grid: [
        ['kick', 'hihat_closed'],           // 1
        ['hihat_closed'],                    // 2
        ['hihat_closed'],                    // 3
        ['snare', 'hihat_closed'],          // 4
        ['hihat_closed'],                    // 5
        ['hihat_closed'],                    // 6
      ]
    }
  },
  {
    name: 'Metronome Only',
    pattern: {
      timeSignature: '4/4',
      subdivisionsPerBeat: 1,
      grid: [
        ['hihat_open'],   // 1 (accent)
        ['hihat_closed'], // 2
        ['hihat_closed'], // 3
        ['hihat_closed'], // 4
      ]
    }
  }
];

/**
 * Get a preset by name
 */
export function getPresetByName(name: string): PatternPreset | undefined {
  return PATTERN_PRESETS.find(p => p.name === name);
}

