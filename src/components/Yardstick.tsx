import React from 'react';
import type { BeatPattern, TapSoundType } from '../types';
import { metronomeEngine } from '../core/MetronomeEngine';
import { ALL_SOUNDS } from './PatternEditor';
import './Yardstick.css';

interface YardstickProps {
    targetSubdivisions: number[];
    onChange: (targets: number[]) => void;
    beatPattern: BeatPattern;
    bpm: number;
    disabled?: boolean;
    tapSound: TapSoundType;
    onTapSoundChange: (sound: TapSoundType) => void;
}

export function Yardstick({
    targetSubdivisions,
    onChange,
    bpm,
    disabled,
    tapSound,
    onTapSoundChange,
    beatPattern
}: YardstickProps) {
    const [isPlayingTargets, setIsPlayingTargets] = React.useState(false);
    const [previewMode, setPreviewMode] = React.useState<'metronome' | 'pattern' | 'none'>('metronome');
    const subdivisionsPerBeat = 4; // We force 4 for the "yardstick" look (16ths)
    const beatsPerMeasure = 4; // Standard yardstick is 4/4
    const totalSubdivisions = beatsPerMeasure * subdivisionsPerBeat;

    const labels = ['e', '&', 'ah'];

    const toggleSubdivision = (index: number) => {
        if (disabled) return;
        if (targetSubdivisions.includes(index)) {
            onChange(targetSubdivisions.filter(i => i !== index));
        } else {
            onChange([...targetSubdivisions, index].sort((a, b) => a - b));
        }
    };

    const getLabel = (index: number) => {
        const beat = Math.floor(index / subdivisionsPerBeat) + 1;
        const sub = index % subdivisionsPerBeat;

        if (sub === 0) return beat.toString();
        return labels[sub - 1];
    };

    const isSelected = (index: number) => targetSubdivisions.includes(index);

    const getPreviewPattern = (): BeatPattern => {
        const grid = Array.from({ length: totalSubdivisions }, (_, i) => {
            const sounds: import('../types').DrumSoundType[] = [];

            // Add target sound if selected
            if (targetSubdivisions.includes(i)) {
                sounds.push(tapSound);
            }

            // Background sounds based on mode
            if (previewMode === 'metronome') {
                if (i % 4 === 0) {
                    sounds.push('click_high');
                }
            } else if (previewMode === 'pattern') {
                // Merge current beatPattern grid
                // Note: beatPattern might have different resolution, but Yardstick is fixed 16ths (4/beat)
                const patternRatio = 4 / beatPattern.subdivisionsPerBeat;
                const patternIndex = Math.floor(i / patternRatio);
                const isPatternTick = i % patternRatio === 0;

                if (isPatternTick && beatPattern.grid[patternIndex]) {
                    sounds.push(...beatPattern.grid[patternIndex]);
                }
            }

            return sounds;
        });

        return {
            timeSignature: '4/4',
            subdivisionsPerBeat: 4,
            grid
        };
    };

    // Update running preview when pattern, sound, bpm, or mode changes
    React.useEffect(() => {
        if (isPlayingTargets) {
            metronomeEngine.updatePreviewPattern(getPreviewPattern());
            metronomeEngine.updatePreviewBpm(bpm);
        }
    }, [targetSubdivisions, tapSound, bpm, isPlayingTargets, previewMode, beatPattern]);

    const togglePreview = async () => {
        if (isPlayingTargets) {
            metronomeEngine.stopPreview();
            setIsPlayingTargets(false);
        } else {
            await metronomeEngine.initialize();
            metronomeEngine.startPreview(getPreviewPattern(), bpm);
            setIsPlayingTargets(true);
        }
    };

    return (
        <div className="yardstick-container">
            <div className="yardstick-header">
                <div className="preview-mode-selector">
                    <span className="selector-label">Backgound:</span>
                    <div className="mode-buttons">
                        <button
                            className={`mode-btn ${previewMode === 'metronome' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('metronome')}
                            title="Quarter note metronome"
                        >
                            Metronome
                        </button>
                        <button
                            className={`mode-btn ${previewMode === 'pattern' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('pattern')}
                            title="Your programmed drum pattern"
                        >
                            Pattern
                        </button>
                        <button
                            className={`mode-btn ${previewMode === 'none' ? 'active' : ''}`}
                            onClick={() => setPreviewMode('none')}
                            title="Only target sounds"
                        >
                            None
                        </button>
                    </div>
                </div>

                <div className="tap-sound-selector-compact">
                    <label>Tap Sound:</label>
                    <select
                        value={tapSound}
                        onChange={(e) => onTapSoundChange(e.target.value as TapSoundType)}
                        disabled={disabled}
                    >
                        <optgroup label="Drums">
                            {ALL_SOUNDS.filter(s => s.category === 'drums').map(sound => (
                                <option key={sound.sound} value={sound.sound}>
                                    {sound.label}
                                </option>
                            ))}
                        </optgroup>
                        <optgroup label="Metronome">
                            {ALL_SOUNDS.filter(s => s.category === 'metronome').map(sound => (
                                <option key={sound.sound} value={sound.sound}>
                                    {sound.label}
                                </option>
                            ))}
                        </optgroup>
                        <optgroup label="Bass">
                            {ALL_SOUNDS.filter(s => s.category === 'bass').map(sound => (
                                <option key={sound.sound} value={sound.sound}>
                                    {sound.label}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </div>
            </div>

            <div className="yardstick">
                {Array.from({ length: totalSubdivisions }).map((_, i) => {
                    const beat = Math.floor(i / subdivisionsPerBeat);
                    const sub = i % subdivisionsPerBeat;
                    const label = getLabel(i);
                    const selected = isSelected(i);

                    return (
                        <div
                            key={i}
                            className={`yardstick-tick-wrapper ${sub === 0 ? 'main-beat' : 'subdivision'}`}
                        >
                            <div className="tick-label">{label}</div>
                            <button
                                className={`yardstick-tick ${selected ? 'selected' : ''}`}
                                onClick={() => toggleSubdivision(i)}
                                disabled={disabled}
                                title={`Toggle ${label} of ${beat + 1}`}
                            />
                        </div>
                    );
                })}
                {/* The concluding (1) */}
                <div className="yardstick-tick-wrapper main-beat final-beat">
                    <div className="tick-label">(1)</div>
                    <div className="yardstick-tick static" />
                </div>
            </div>
            <div className="yardstick-actions">
                <button
                    className={`yardstick-preview-btn ${isPlayingTargets ? 'playing' : ''}`}
                    onClick={togglePreview}
                    disabled={disabled || targetSubdivisions.length === 0}
                >
                    {isPlayingTargets ? '⏹ Stop' : '▶ Preview Targets'}
                </button>
                <div className="action-divider" />
                <button
                    className="yardstick-preset"
                    onClick={() => onChange([0, 4, 8, 12])}
                    disabled={disabled}
                >
                    Quarter Notes
                </button>
                <button
                    className="yardstick-preset"
                    onClick={() => onChange([0, 2, 4, 6, 8, 10, 12, 14])}
                    disabled={disabled}
                >
                    8th Notes
                </button>
                <button
                    className="yardstick-preset"
                    onClick={() => onChange(Array.from({ length: 16 }, (_, i) => i))}
                    disabled={disabled}
                >
                    16th Notes
                </button>
                <button
                    className="yardstick-preset clear"
                    onClick={() => onChange([])}
                    disabled={disabled}
                >
                    Clear All
                </button>
            </div>
        </div>
    );
}
