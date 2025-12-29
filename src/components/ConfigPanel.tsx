/**
 * ConfigPanel - Settings for BPM, duration, and input method
 */

import type { InputMethod, SessionConfig } from '../types';
import { InputHandler } from '../core/InputHandler';

interface ConfigPanelProps {
  config: SessionConfig;
  onChange: (config: SessionConfig) => void;
  disabled?: boolean;
  micSensitivity: number;
  onMicSensitivityChange: (value: number) => void;
  audioLevel: number;
}

export function ConfigPanel({ 
  config, 
  onChange, 
  disabled, 
  micSensitivity, 
  onMicSensitivityChange,
  audioLevel 
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

  const getDurationInSeconds = () => {
    return ((config.durationBeats / config.bpm) * 60).toFixed(1);
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

      {config.inputMethod === 'audio' && (
        <div className="config-section mic-settings">
          <label htmlFor="sensitivity">Mic Sensitivity</label>
          <div className="sensitivity-control">
            <span className="sensitivity-label">Low</span>
            <input
              id="sensitivity"
              type="range"
              min="0"
              max="100"
              value={micSensitivity * 100}
              onChange={(e) => onMicSensitivityChange(parseInt(e.target.value) / 100)}
              className="sensitivity-slider"
            />
            <span className="sensitivity-label">High</span>
          </div>
          <div className="audio-level-meter">
            <div className="level-label">Input Level</div>
            <div className="level-bar-container">
              <div 
                className="level-bar" 
                style={{ width: `${audioLevel * 100}%` }}
              />
              <div 
                className="threshold-marker" 
                style={{ left: `${(1 - micSensitivity) * 100}%` }}
                title="Detection threshold"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

