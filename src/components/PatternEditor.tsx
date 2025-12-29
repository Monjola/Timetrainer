/**
 * PatternEditor - Drum pattern programming grid
 * 
 * Allows users to program custom metronome patterns with:
 * - Time signature selection (4/4, 3/4, 6/8)
 * - Subdivision grid (8ths or 16ths)
 * - Drum sounds (kick, snare, hi-hat)
 */

import { useState } from 'react';
import type { BeatPattern, TimeSignature, DrumSoundType, PatternPreset } from '../types';
import { 
  getBeatsPerMeasure, 
  toggleSound, 
  hasSound, 
  createDefaultPattern,
  PATTERN_PRESETS 
} from '../core/PatternUtils';

interface PatternEditorProps {
  pattern: BeatPattern;
  onChange: (pattern: BeatPattern) => void;
  disabled?: boolean;
  bpm: number;
  isPreviewing: boolean;
  onPreviewToggle: () => void;
}

// Sound categories for track selection
interface SoundOption {
  sound: DrumSoundType;
  label: string;
  emoji: string;
  category: 'drums' | 'metronome' | 'bass' | 'other';
}

const ALL_SOUNDS: SoundOption[] = [
  // Drums
  { sound: 'kick', label: 'Kick', emoji: '🦶', category: 'drums' },
  { sound: 'snare', label: 'Snare', emoji: '🥁', category: 'drums' },
  { sound: 'hihat_closed', label: 'Hi-Hat', emoji: '🎩', category: 'drums' },
  { sound: 'hihat_open', label: 'Open HH', emoji: '💿', category: 'drums' },
  { sound: 'tom_high', label: 'Hi Tom', emoji: '🔴', category: 'drums' },
  { sound: 'tom_low', label: 'Lo Tom', emoji: '🟤', category: 'drums' },
  { sound: 'crash', label: 'Crash', emoji: '💥', category: 'drums' },
  { sound: 'ride', label: 'Ride', emoji: '🔔', category: 'drums' },
  { sound: 'clap', label: 'Clap', emoji: '👏', category: 'drums' },
  { sound: 'cowbell', label: 'Cowbell', emoji: '🐄', category: 'drums' },
  // Metronome
  { sound: 'click_high', label: 'Click Hi', emoji: '🔊', category: 'metronome' },
  { sound: 'click_low', label: 'Click Lo', emoji: '🔈', category: 'metronome' },
  { sound: 'wood_high', label: 'Wood Hi', emoji: '🪵', category: 'metronome' },
  { sound: 'wood_low', label: 'Wood Lo', emoji: '🌳', category: 'metronome' },
  { sound: 'beep_high', label: 'Beep Hi', emoji: '📢', category: 'metronome' },
  { sound: 'beep_low', label: 'Beep Lo', emoji: '📣', category: 'metronome' },
  // Bass
  { sound: 'bass_low', label: 'Bass Lo', emoji: '🎸', category: 'bass' },
  { sound: 'bass_mid', label: 'Bass Mid', emoji: '🎵', category: 'bass' },
  { sound: 'bass_high', label: 'Bass Hi', emoji: '🎶', category: 'bass' },
];

// Export for use in tap sound selection
export { ALL_SOUNDS };

// Default tracks to show (can be customized)
const DEFAULT_TRACKS: DrumSoundType[] = [
  'hihat_closed',
  'hihat_open', 
  'snare',
  'kick',
];

export function PatternEditor({ pattern, onChange, disabled, bpm, isPreviewing, onPreviewToggle }: PatternEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTracks, setActiveTracks] = useState<DrumSoundType[]>(DEFAULT_TRACKS);
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  
  const beatsPerMeasure = getBeatsPerMeasure(pattern.timeSignature);
  const totalSubdivisions = beatsPerMeasure * pattern.subdivisionsPerBeat;

  const handleTimeSignatureChange = (ts: TimeSignature) => {
    // Create a new pattern with the selected time signature
    onChange(createDefaultPattern(ts));
  };

  const handleSubdivisionChange = (subdivs: number) => {
    // Rebuild the grid with new subdivision count
    const newBeats = getBeatsPerMeasure(pattern.timeSignature);
    const newTotal = newBeats * subdivs;
    const newGrid: DrumSoundType[][] = Array.from({ length: newTotal }, () => []);
    
    // Try to preserve existing pattern
    pattern.grid.forEach((sounds, i) => {
      const beatIndex = Math.floor(i / pattern.subdivisionsPerBeat);
      const subdivInBeat = i % pattern.subdivisionsPerBeat;
      
      // Map old subdivision to new
      if (subdivs >= pattern.subdivisionsPerBeat) {
        // Expanding: keep sounds at their relative positions
        const ratio = subdivs / pattern.subdivisionsPerBeat;
        const newIndex = beatIndex * subdivs + Math.floor(subdivInBeat * ratio);
        if (newIndex < newTotal) {
          newGrid[newIndex] = [...sounds];
        }
      } else {
        // Contracting: only keep downbeat sounds
        if (subdivInBeat === 0) {
          const newIndex = beatIndex * subdivs;
          if (newIndex < newTotal) {
            newGrid[newIndex] = [...sounds];
          }
        }
      }
    });
    
    onChange({
      ...pattern,
      subdivisionsPerBeat: subdivs,
      grid: newGrid
    });
  };

  const handleCellClick = (subdivisionIndex: number, sound: DrumSoundType) => {
    if (disabled) return;
    onChange(toggleSound(pattern, subdivisionIndex, sound));
  };

  const handlePresetSelect = (preset: PatternPreset) => {
    onChange({ ...preset.pattern });
  };

  const clearPattern = () => {
    const newGrid: DrumSoundType[][] = Array.from({ length: totalSubdivisions }, () => []);
    onChange({ ...pattern, grid: newGrid });
  };

  const addTrack = (sound: DrumSoundType) => {
    if (!activeTracks.includes(sound)) {
      setActiveTracks([...activeTracks, sound]);
    }
    setShowTrackPicker(false);
  };

  const removeTrack = (sound: DrumSoundType) => {
    setActiveTracks(activeTracks.filter(t => t !== sound));
    // Also clear this sound from the pattern
    const newGrid = pattern.grid.map(sounds => sounds.filter(s => s !== sound));
    onChange({ ...pattern, grid: newGrid });
  };

  const getSoundInfo = (sound: DrumSoundType): SoundOption | undefined => {
    return ALL_SOUNDS.find(s => s.sound === sound);
  };

  // Determine which subdivisions are on the beat
  const isOnBeat = (subdivIndex: number) => subdivIndex % pattern.subdivisionsPerBeat === 0;
  const getBeatNumber = (subdivIndex: number) => Math.floor(subdivIndex / pattern.subdivisionsPerBeat) + 1;

  return (
    <div className="pattern-editor">
      {/* Time Signature & Presets Row */}
      <div className="pattern-controls">
        {/* Preview Button */}
        <button
          className={`preview-button ${isPreviewing ? 'playing' : ''}`}
          onClick={onPreviewToggle}
          disabled={disabled}
          title={isPreviewing ? 'Stop preview' : 'Preview pattern'}
        >
          {isPreviewing ? '⏹' : '▶'}
        </button>

        <div className="control-group">
          <label>Time Signature</label>
          <div className="time-sig-buttons">
            {(['4/4', '3/4', '6/8'] as TimeSignature[]).map(ts => (
              <button
                key={ts}
                className={`time-sig-button ${pattern.timeSignature === ts ? 'active' : ''}`}
                onClick={() => handleTimeSignatureChange(ts)}
                disabled={disabled || isPreviewing}
              >
                {ts}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Preset</label>
          <select 
            className="preset-select"
            onChange={(e) => {
              const preset = PATTERN_PRESETS.find(p => p.name === e.target.value);
              if (preset) handlePresetSelect(preset);
            }}
            disabled={disabled || isPreviewing}
            value=""
          >
            <option value="" disabled>Load preset...</option>
            {PATTERN_PRESETS.map(preset => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <button 
          className="toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼ Simple' : '▶ Advanced'}
        </button>
      </div>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="advanced-controls">
          <div className="control-group">
            <label>Subdivisions</label>
            <div className="subdiv-buttons">
              {[1, 2, 4].map(subdiv => (
                <button
                  key={subdiv}
                  className={`subdiv-button ${pattern.subdivisionsPerBeat === subdiv ? 'active' : ''}`}
                  onClick={() => handleSubdivisionChange(subdiv)}
                  disabled={disabled || (pattern.timeSignature === '6/8' && subdiv > 2)}
                  title={subdiv === 1 ? 'Quarter notes' : subdiv === 2 ? '8th notes' : '16th notes'}
                >
                  {subdiv === 1 ? '♩' : subdiv === 2 ? '♪♪' : '♬♬'}
                </button>
              ))}
            </div>
          </div>

          <button 
            className="clear-button"
            onClick={clearPattern}
            disabled={disabled}
          >
            🗑️ Clear
          </button>
        </div>
      )}

      {/* Beat numbers */}
      <div className="beat-numbers">
        <div className="track-label-spacer" />
        {Array.from({ length: totalSubdivisions }).map((_, i) => (
          <div 
            key={i} 
            className={`beat-number ${isOnBeat(i) ? 'on-beat' : 'off-beat'}`}
          >
            {isOnBeat(i) ? getBeatNumber(i) : (pattern.subdivisionsPerBeat === 2 ? '+' : '')}
          </div>
        ))}
      </div>

      {/* Pattern grid */}
      <div className="pattern-grid">
        {activeTracks.map(trackSound => {
          const track = getSoundInfo(trackSound);
          if (!track) return null;
          
          return (
            <div key={track.sound} className="pattern-row">
              <div className="track-label">
                <button 
                  className="remove-track-btn"
                  onClick={() => removeTrack(track.sound)}
                  disabled={disabled || isPreviewing}
                  title="Remove track"
                >
                  ×
                </button>
                <span className="track-emoji">{track.emoji}</span>
                <span className="track-name">{track.label}</span>
              </div>
              
              <div className="track-cells">
                {Array.from({ length: totalSubdivisions }).map((_, subdivIndex) => {
                  const isActive = hasSound(pattern, subdivIndex, track.sound);
                  const onBeat = isOnBeat(subdivIndex);
                  
                  return (
                    <button
                      key={subdivIndex}
                      className={`pattern-cell ${isActive ? 'active' : ''} ${onBeat ? 'on-beat' : 'off-beat'} ${track.sound}`}
                      onClick={() => handleCellClick(subdivIndex, track.sound)}
                      disabled={disabled || isPreviewing}
                      aria-label={`${track.label} at subdivision ${subdivIndex + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add track button */}
        <div className="add-track-row">
          <button 
            className="add-track-btn"
            onClick={() => setShowTrackPicker(!showTrackPicker)}
            disabled={disabled || isPreviewing}
          >
            + Add Sound
          </button>
        </div>

        {/* Track picker dropdown */}
        {showTrackPicker && (
          <div className="track-picker">
            {(['drums', 'metronome', 'bass'] as const).map(category => {
              const availableSounds = ALL_SOUNDS.filter(s => s.category === category && !activeTracks.includes(s.sound));
              if (availableSounds.length === 0) return null;
              
              return (
                <div key={category} className="track-category">
                  <div className="category-label">{category}</div>
                  <div className="category-sounds">
                    {availableSounds.map(sound => (
                      <button
                        key={sound.sound}
                        className="track-option"
                        onClick={() => addTrack(sound.sound)}
                      >
                        <span className="option-emoji">{sound.emoji}</span>
                        <span className="option-label">{sound.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pattern info */}
      <div className="pattern-info">
        <span className="info-item">
          {pattern.timeSignature} • {beatsPerMeasure} beats • {totalSubdivisions} steps
        </span>
      </div>
    </div>
  );
}

