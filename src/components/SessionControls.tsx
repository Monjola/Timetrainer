/**
 * SessionControls - Start/Stop buttons and session status
 */

import type { SessionState } from '../types';

interface SessionControlsProps {
  state: SessionState;
  currentBeat: number;
  totalBeats: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function SessionControls({
  state,
  currentBeat,
  totalBeats,
  onStart,
  onStop,
  onReset
}: SessionControlsProps) {
  const getProgress = () => {
    if (state !== 'running') return 0;
    return ((currentBeat + 1) / totalBeats) * 100;
  };

  return (
    <div className="session-controls">
      {state === 'idle' && (
        <button className="control-button start" onClick={onStart}>
          <span className="button-icon">▶</span>
          Start Training
        </button>
      )}

      {state === 'countdown' && (
        <button className="control-button stop" onClick={onStop}>
          <span className="button-icon">■</span>
          Cancel
        </button>
      )}

      {state === 'running' && (
        <>
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${getProgress()}%` }}
              />
            </div>
            <span className="progress-text">
              Beat {currentBeat + 1} / {totalBeats}
            </span>
          </div>
          
          <button className="control-button stop" onClick={onStop}>
            <span className="button-icon">■</span>
            Stop
          </button>
        </>
      )}

      {state === 'finished' && (
        <button className="control-button reset" onClick={onReset}>
          <span className="button-icon">↺</span>
          New Session
        </button>
      )}
    </div>
  );
}

