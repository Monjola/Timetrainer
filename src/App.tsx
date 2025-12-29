/**
 * TimeTrainer - Musical Timing Training App
 * 
 * Train your timing consistency by playing along with a metronome
 * and analyzing your timing accuracy.
 */

import { useState, useCallback, useEffect } from 'react';
import type { SessionConfig, SessionState, SessionResult, TimingOffset, SessionStats } from './types';
import { sessionManager } from './core/SessionManager';
import { inputHandler } from './core/InputHandler';
import { StatsCalculator } from './core/StatsCalculator';
import { ConfigPanel } from './components/ConfigPanel';
import { SessionControls } from './components/SessionControls';
import { InputIndicator } from './components/InputIndicator';
import { ResultsChart } from './components/ResultsChart';
import './App.css';

function App() {
  // Session configuration
  const [config, setConfig] = useState<SessionConfig>({
    bpm: 100,
    durationBeats: 32,
    inputMethod: 'keyboard'
  });

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [countIn, setCountIn] = useState<{ current: number; total: number } | null>(null);
  const [lastInput, setLastInput] = useState<TimingOffset | null>(null);
  const [, setResult] = useState<SessionResult | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Microphone settings
  const [micSensitivity, setMicSensitivity] = useState(0.7); // Default to fairly sensitive
  const [audioLevel, setAudioLevel] = useState(0);

  // Update mic sensitivity when it changes
  useEffect(() => {
    inputHandler.setAudioSensitivity(micSensitivity);
  }, [micSensitivity]);

  // Set up audio level callback for visual feedback
  useEffect(() => {
    inputHandler.setAudioLevelCallback(setAudioLevel);
    return () => inputHandler.setAudioLevelCallback(null);
  }, []);

  // Set up session manager callbacks
  useEffect(() => {
    sessionManager.setCallbacks({
      onStateChange: (state) => {
        setSessionState(state);
        if (state === 'idle') {
          setCurrentBeat(-1);
          setLastInput(null);
          setCountIn(null);
        }
        if (state === 'running') {
          setCountIn(null);
        }
      },
      onCountIn: (current, total) => {
        setCountIn({ current, total });
      },
      onBeat: (beatIndex) => {
        setCurrentBeat(beatIndex);
      },
      onInput: (offset) => {
        setLastInput(offset);
      },
      onComplete: (sessionResult) => {
        setResult(sessionResult);
        const sessionStats = StatsCalculator.calculate(sessionResult.offsets);
        setStats(sessionStats);
      }
    });
  }, []);

  // Handle start
  const handleStart = useCallback(async () => {
    setError(null);
    setResult(null);
    setStats(null);
    
    try {
      await sessionManager.start(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setSessionState('idle');
    }
  }, [config]);

  // Handle stop
  const handleStop = useCallback(() => {
    sessionManager.stop();
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    sessionManager.reset();
    setResult(null);
    setStats(null);
    setLastInput(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>TimeTrainer</h1>
        <p className="tagline">Train your timing consistency</p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {sessionState !== 'finished' && (
          <>
            <section className="config-section">
              <ConfigPanel 
                config={config} 
                onChange={setConfig}
                disabled={sessionState === 'running' || sessionState === 'countdown'}
                micSensitivity={micSensitivity}
                onMicSensitivityChange={setMicSensitivity}
                audioLevel={audioLevel}
              />
            </section>

            <section className="indicator-section">
              <InputIndicator 
                currentBeat={currentBeat}
                countIn={countIn}
                lastInput={lastInput}
                isRunning={sessionState === 'running'}
                isCountingIn={sessionState === 'countdown'}
              />
            </section>
          </>
        )}

        <section className="controls-section">
          <SessionControls
            state={sessionState}
            currentBeat={currentBeat}
            totalBeats={config.durationBeats}
            onStart={handleStart}
            onStop={handleStop}
            onReset={handleReset}
          />
        </section>

        {sessionState === 'finished' && stats && (
          <section className="results-section">
            <h2>Session Results</h2>
            <ResultsChart stats={stats} />
          </section>
        )}

        {sessionState === 'idle' && (
          <section className="instructions-section">
            <h2>How to Use</h2>
            <ol>
              <li>Set your desired tempo (BPM) and session length</li>
              <li>Choose your input method:
                <ul>
                  <li><strong>Keyboard/Click:</strong> Press any key or click to tap along</li>
                  <li><strong>Microphone:</strong> Clap or play an instrument</li>
                  <li><strong>MIDI:</strong> Play any note on your MIDI controller</li>
                </ul>
              </li>
              <li>Press Start and play along with the metronome</li>
              <li>After the session, analyze your timing consistency</li>
            </ol>
            <div className="tips">
              <h3>Reading Results</h3>
              <p><strong>Mean (μ):</strong> Positive = dragging (late), Negative = pushing (early)</p>
              <p><strong>Standard Deviation (σ):</strong> Lower = more consistent timing</p>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Use headphones for best results • Low latency audio via Web Audio API</p>
      </footer>
    </div>
  );
}

export default App;
