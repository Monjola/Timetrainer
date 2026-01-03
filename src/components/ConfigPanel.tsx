/**
 * ConfigPanel - Settings for BPM, duration, and input method
 */

import type { InputMethod, SessionConfig, TapSoundType, BeatPattern } from '../types';
import { InputHandler } from '../core/InputHandler';
import { PatternEditor, ALL_SOUNDS } from './PatternEditor';

interface ConfigPanelProps {
  config: SessionConfig;
  onChange: (config: SessionConfig) => void;
  disabled?: boolean;
  micSensitivity: number;
  onMicSensitivityChange: (value: number) => void;
  audioLevel: number;
  isMicTesting: boolean;
  onMicTestToggle: () => void;
  isPreviewing: boolean;
  onPreviewToggle: () => void;
}

export function ConfigPanel({
  config,
  onChange,
  disabled,
  micSensitivity,
  onMicSensitivityChange,
  audioLevel,
  isMicTesting,
  onMicTestToggle,
  isPreviewing,
  onPreviewToggle
}: ConfigPanelProps) {
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bpm = Math.max(20, Math.min(300, parseInt(e.target.value) || 60));
    onChange({ ...config, bpm });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const beats = Math.max(30, Math.min(500, parseInt(e.target.value) || 75));
    onChange({ ...config, durationBeats: beats });
  };

  const handleMethodChange = (method: InputMethod) => {
    onChange({ ...config, inputMethod: method });
  };

  const handleTapSoundChange = (sound: TapSoundType) => {
    onChange({ ...config, tapSound: sound });
  };

  const handlePatternChange = (pattern: BeatPattern) => {
    onChange({ ...config, beatPattern: pattern });
  };

  const getDurationInSeconds = () => {
    return ((config.durationBeats / config.bpm) * 60).toFixed(1);
  };

  // Get tap sound info
  const getCurrentTapSound = () => {
    return ALL_SOUNDS.find(s => s.sound === config.tapSound);
  };

  return (
    <div className="config-panel">
      <div className="config-section">
        <label htmlFor="bpm">Tempo (BPM)</label>
        <div className="input-with-display">
          <input
            id="bpm"
            type="range"
            min="20"
            max="300"
            value={config.bpm}
            onChange={handleBpmChange}
            disabled={disabled}
          />
          <input
            type="number"
            min="20"
            max="300"
            value={config.bpm}
            onChange={handleBpmChange}
            disabled={disabled}
            className="number-input"
          />
        </div>
      </div>

      <div className="config-section">
        <label htmlFor="duration">Duration (beats)</label>
        <div className="input-with-display">
          <input
            id="duration"
            type="range"
            min="30"
            max="200"
            value={config.durationBeats}
            onChange={handleDurationChange}
            disabled={disabled}
          />
          <input
            type="number"
            min="30"
            max="500"
            value={config.durationBeats}
            onChange={handleDurationChange}
            disabled={disabled}
            className="number-input"
          />
        </div>
        <span className="duration-info">≈ {getDurationInSeconds()}s</span>
      </div>

      <div className="config-section">
        <label>Input Method</label>
        <div className="input-method-buttons">
          <button
            className={`method-button ${config.inputMethod === 'keyboard' ? 'active' : ''}`}
            onClick={() => handleMethodChange('keyboard')}
            disabled={disabled}
          >
            <span className="method-icon">⌨️</span>
            <span className="method-label">Keyboard / Click</span>
          </button>

          <button
            className={`method-button ${config.inputMethod === 'audio' ? 'active' : ''}`}
            onClick={() => handleMethodChange('audio')}
            disabled={disabled || !InputHandler.isAudioInputSupported()}
            title={!InputHandler.isAudioInputSupported() ? 'Microphone not supported in this browser' : ''}
          >
            <span className="method-icon">🎤</span>
            <span className="method-label">Microphone</span>
          </button>

          <button
            className={`method-button ${config.inputMethod === 'midi' ? 'active' : ''}`}
            onClick={() => handleMethodChange('midi')}
            disabled={disabled || !InputHandler.isMIDISupported()}
            title={!InputHandler.isMIDISupported() ? 'MIDI not supported in this browser' : ''}
          >
            <span className="method-icon">🎹</span>
            <span className="method-label">MIDI</span>
          </button>
        </div>
      </div>

      {/* Pattern Editor */}
      <div className="config-section">
        <label>Beat Pattern</label>
        <PatternEditor
          pattern={config.beatPattern}
          onChange={handlePatternChange}
          disabled={disabled}
          bpm={config.bpm}
          isPreviewing={isPreviewing}
          onPreviewToggle={onPreviewToggle}
        />
      </div>

      {/* Tap Sound (only for keyboard/MIDI) */}
      {config.inputMethod !== 'audio' && (
        <div className="config-section sound-settings">
          <div className="sound-row">
            <label>Tap Sound</label>
            <div className="tap-sound-selector">
              <div className="current-tap-sound">
                {getCurrentTapSound() && (
                  <>
                    <span className="sound-name">{getCurrentTapSound()?.label}</span>
                  </>
                )}
              </div>
              <select
                className="tap-sound-select"
                value={config.tapSound}
                onChange={(e) => handleTapSoundChange(e.target.value as TapSoundType)}
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
        </div>
      )}

      {config.inputMethod === 'audio' && (
        <div className="config-section mic-settings">
          <div className="mic-header">
            <label>Mic Threshold</label>
            <button
              className={`test-mic-button ${isMicTesting ? 'active' : ''}`}
              onClick={onMicTestToggle}
              disabled={disabled}
            >
              {isMicTesting ? '⏹ Stop Test' : '🎤 Test Mic'}
            </button>
          </div>
          <div className="audio-level-meter">
            <div className="level-label">
              {!isMicTesting && <span className="hint">Click Test Mic, then drag the red line to set threshold</span>}
              {isMicTesting && <span className="hint">Drag the red line to where your claps peak</span>}
            </div>
            <div
              className="level-bar-container interactive"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const updateThreshold = (clientX: number) => {
                  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                  // Convert position to sensitivity: position = threshold * 30
                  // threshold = 0.005 + (1 - sens) * 0.145
                  // So: x = (0.005 + (1 - sens) * 0.145) * 30
                  // x/30 = 0.005 + (1 - sens) * 0.145
                  // (x/30 - 0.005) / 0.145 = 1 - sens
                  // sens = 1 - (x/30 - 0.005) / 0.145
                  const sens = Math.max(0, Math.min(1, 1 - (x / 30 - 0.005) / 0.145));
                  onMicSensitivityChange(sens);
                };
                updateThreshold(e.clientX);

                const onMouseMove = (e: MouseEvent) => updateThreshold(e.clientX);
                const onMouseUp = () => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            >
              <div
                className="level-bar"
                style={{ width: `${audioLevel * 100}%` }}
              />
              <div
                className="threshold-marker draggable"
                style={{ left: `${Math.min(100, (0.005 + (1 - micSensitivity) * 0.145) * 30 * 100)}%` }}
                title="Drag to set threshold"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

