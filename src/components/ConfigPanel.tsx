/**
 * ConfigPanel - Settings for BPM, duration, and input method
 */

import type { InputMethod, SessionConfig, MetronomeSoundType, TapSoundType } from '../types';
import { InputHandler } from '../core/InputHandler';

interface ConfigPanelProps {
  config: SessionConfig;
  onChange: (config: SessionConfig) => void;
  disabled?: boolean;
  micSensitivity: number;
  onMicSensitivityChange: (value: number) => void;
  audioLevel: number;
  isMicTesting: boolean;
  onMicTestToggle: () => void;
}

export function ConfigPanel({ 
  config, 
  onChange, 
  disabled, 
  micSensitivity, 
  onMicSensitivityChange,
  audioLevel,
  isMicTesting,
  onMicTestToggle
}: ConfigPanelProps) {
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bpm = Math.max(20, Math.min(300, parseInt(e.target.value) || 60));
    onChange({ ...config, bpm });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const beats = Math.max(4, Math.min(500, parseInt(e.target.value) || 16));
    onChange({ ...config, durationBeats: beats });
  };

  const handleMethodChange = (method: InputMethod) => {
    onChange({ ...config, inputMethod: method });
  };

  const handleMetronomeSoundChange = (sound: MetronomeSoundType) => {
    onChange({ ...config, metronomeSound: sound });
  };

  const handleTapSoundChange = (sound: TapSoundType) => {
    onChange({ ...config, tapSound: sound });
  };

  const getDurationInSeconds = () => {
    return ((config.durationBeats / config.bpm) * 60).toFixed(1);
  };

  const metronomeSounds: { type: MetronomeSoundType; label: string; emoji: string }[] = [
    { type: 'click', label: 'Click', emoji: '🔔' },
    { type: 'beep', label: 'Beep', emoji: '📢' },
    { type: 'wood', label: 'Wood', emoji: '🪵' },
    { type: 'hihat', label: 'Hi-hat', emoji: '🥁' },
  ];

  const tapSounds: { type: TapSoundType; label: string; emoji: string }[] = [
    { type: 'click', label: 'Click', emoji: '🔔' },
    { type: 'beep', label: 'Beep', emoji: '📢' },
    { type: 'drum', label: 'Drum', emoji: '🥁' },
    { type: 'wood', label: 'Wood', emoji: '🪵' },
  ];

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
            min="4"
            max="100"
            value={config.durationBeats}
            onChange={handleDurationChange}
            disabled={disabled}
          />
          <input
            type="number"
            min="4"
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

      <div className="config-section sound-settings">
        <div className="sound-row">
          <label>Metronome Sound</label>
          <div className="sound-buttons">
            {metronomeSounds.map(({ type, label, emoji }) => (
              <button
                key={type}
                className={`sound-button ${config.metronomeSound === type ? 'active' : ''}`}
                onClick={() => handleMetronomeSoundChange(type)}
                disabled={disabled}
                title={label}
              >
                <span className="sound-emoji">{emoji}</span>
                <span className="sound-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {config.inputMethod !== 'audio' && (
          <div className="sound-row">
            <label>Tap Sound</label>
            <div className="sound-buttons">
              {tapSounds.map(({ type, label, emoji }) => (
                <button
                  key={type}
                  className={`sound-button ${config.tapSound === type ? 'active' : ''}`}
                  onClick={() => handleTapSoundChange(type)}
                  disabled={disabled}
                  title={label}
                >
                  <span className="sound-emoji">{emoji}</span>
                  <span className="sound-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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

