/**
 * TimeTrainer - Musical Timing Training App
 * 
 * Train your timing consistency by playing along with a metronome
 * and analyzing your timing accuracy.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { SessionConfig, SessionState, SessionResult, TimingOffset, HistoricalSession } from './types';
import { sessionManager } from './core/SessionManager';
import { inputHandler } from './core/InputHandler';
import { metronomeEngine } from './core/MetronomeEngine';
import { playbackEngine } from './core/PlaybackEngine';
import { StatsCalculator } from './core/StatsCalculator';
import { historyManager } from './core/HistoryManager';
import { createDefaultPattern } from './core/PatternUtils';
import { ConfigPanel } from './components/ConfigPanel';
import { SessionControls } from './components/SessionControls';
import { InputIndicator } from './components/InputIndicator';
import { ResultsChart } from './components/ResultsChart';
import { ControlChart } from './components/ControlChart';
import { HistoryList } from './components/HistoryList';
import { HistoryChart } from './components/HistoryChart';
import { HistoryFilters, type HistoryFilterState } from './components/HistoryFilters';
import './App.css';

function App() {
  // Session configuration
  const [config, setConfig] = useState<SessionConfig>({
    bpm: 100,
    durationBeats: 75,
    inputMethod: 'keyboard',
    metronomeSound: 'click',
    tapSound: 'wood_high',
    beatPattern: createDefaultPattern('4/4')
  });

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [countIn, setCountIn] = useState<{ current: number; total: number } | null>(null);
  const [lastInput, setLastInput] = useState<TimingOffset | null>(null);
  const [sessionOffsets, setSessionOffsets] = useState<TimingOffset[]>([]); // Full history
  const [, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'practice' | 'history'>('practice');
  const [history, setHistory] = useState(historyManager.getHistory());

  const [filters, setFilters] = useState<HistoryFilterState>({
    limit: 50,
    inputMethod: 'all',
    minBpm: 40,
    maxBpm: 250,
    minBeats: 0
  });

  const filteredHistory = useMemo(() => {
    let filtered = history.filter(s => {
      const matchInput = filters.inputMethod === 'all' || s.inputMethod === filters.inputMethod;
      const matchBpm = s.bpm >= filters.minBpm && s.bpm <= filters.maxBpm;
      const matchBeats = s.durationBeats >= filters.minBeats;
      return matchInput && matchBpm && matchBeats;
    });

    // Sort by date (newest first) then take last X
    // Note: The history stored is usually chronological, but let's be safe.
    // We want the most recent ones for the graph.
    return filtered.slice(-filters.limit);
  }, [history, filters]);

  // Playback & Review State
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    loopStart: 0,
    loopEnd: 0,
    totalDuration: 0
  });

  // Microphone settings
  const [micSensitivity, setMicSensitivity] = useState(0.7);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // --- Effects ---

  // Update mic sensitivity
  useEffect(() => {
    inputHandler.setAudioSensitivity(micSensitivity);
  }, [micSensitivity]);

  // Stop mic preview when switching away from audio
  useEffect(() => {
    if (config.inputMethod !== 'audio' && isMicTesting) {
      inputHandler.stopMicPreview();
      setIsMicTesting(false);
    }
  }, [config.inputMethod, isMicTesting]);

  // Update sound types
  useEffect(() => {
    metronomeEngine.setSoundType(config.metronomeSound);
  }, [config.metronomeSound]);

  useEffect(() => {
    inputHandler.setTapSoundType(config.tapSound);
  }, [config.tapSound]);

  // Audio level callback
  useEffect(() => {
    inputHandler.setAudioLevelCallback(setAudioLevel);
    return () => inputHandler.setAudioLevelCallback(null);
  }, []);

  // Session Manager Callbacks
  useEffect(() => {
    sessionManager.setCallbacks({
      onStateChange: (state) => {
        setSessionState(state);
        inputHandler.setSessionActive(state === 'countdown' || state === 'running');

        if (state === 'idle') {
          setCurrentBeat(-1);
          setLastInput(null);
          setCountIn(null);
          setSessionOffsets([]);
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
        setSessionOffsets(prev => [...prev, offset]);
      },
      onComplete: (sessionResult) => {
        setResult(sessionResult);
        // Stats are calculated dynamically below

        // Initialize Playback
        playbackEngine.loadSession(sessionResult);
        const beatDuration = 60 / sessionResult.config.bpm;
        const duration = sessionResult.config.durationBeats * beatDuration;

        setPlaybackState({
          isPlaying: false,
          currentTime: 0,
          loopStart: 0,
          loopEnd: duration,
          totalDuration: duration
        });

        // Setup Playback listeners
        playbackEngine.setCallbacks(
          (time) => setPlaybackState(prev => ({ ...prev, currentTime: time })),
          (isPlaying) => setPlaybackState(prev => ({ ...prev, isPlaying }))
        );

        // Save to History
        const stats = StatsCalculator.calculate(sessionResult.offsets);
        const assessment = StatsCalculator.assessSkillLevel(stats, sessionResult.config.bpm);

        historyManager.addSession({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          bpm: sessionResult.config.bpm,
          durationBeats: sessionResult.config.durationBeats,
          inputMethod: sessionResult.config.inputMethod,
          meanOffset: stats.mean,
          stdDev: stats.standardDeviation,
          precisionRating: assessment.consistencyTitle,
          timingFeel: assessment.offsetTitle,
          result: sessionResult
        });

        // Update history state AFTER adding so it reflects immediately
        setHistory(historyManager.getHistory());
      }
    });
  }, []);

  // --- Handlers ---

  const handleStart = useCallback(async () => {
    if (isMicTesting) {
      inputHandler.stopMicPreview();
      setIsMicTesting(false);
    }
    if (isPreviewing) {
      metronomeEngine.stopPreview();
      setIsPreviewing(false);
    }

    setError(null);
    setResult(null);
    setSessionOffsets([]);
    playbackEngine.stop(); // Ensure playback is stopped

    try {
      await sessionManager.start(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setSessionState('idle');
    }
  }, [config, isMicTesting, isPreviewing]);

  const handleStop = useCallback(() => {
    sessionManager.stop();
  }, []);

  const handleReset = useCallback(() => {
    sessionManager.reset();
    playbackEngine.stop();
    setResult(null);
    setLastInput(null);
    setSessionOffsets([]);
    setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const handleClearHistory = useCallback(() => {
    if (window.confirm('Are you sure you want to clear your entire practice history?')) {
      historyManager.clearHistory();
      setHistory([]);
    }
  }, []);

  const handleLoadSession = useCallback((historical: HistoricalSession) => {
    if (!historical.result) {
      alert('This session does not have detailed data available for review.');
      return;
    }

    const { result } = historical;

    // Set basic state
    setConfig(result.config);
    setSessionOffsets(result.offsets);
    setSessionState('finished');
    setResult(result);
    setLastInput(null);
    setCurrentBeat(-1);

    // Load into playback engine
    playbackEngine.loadSession(result);
    const beatDuration = 60 / result.config.bpm;
    const duration = result.config.durationBeats * beatDuration;

    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      loopStart: 0,
      loopEnd: duration,
      totalDuration: duration
    });

    // We don't need to set callbacks again as they are already set in useEffect
  }, []);

  const handleMicTestToggle = useCallback(async () => {
    if (isMicTesting) {
      inputHandler.stopMicPreview();
      setIsMicTesting(false);
    } else {
      try {
        await inputHandler.startMicPreview();
        setIsMicTesting(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to access microphone');
      }
    }
  }, [isMicTesting]);

  const handlePreviewToggle = useCallback(async () => {
    if (isPreviewing) {
      metronomeEngine.stopPreview();
      setIsPreviewing(false);
    } else {
      try {
        await metronomeEngine.initialize();
        metronomeEngine.startPreview(config.beatPattern, config.bpm);
        setIsPreviewing(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start preview');
      }
    }
  }, [isPreviewing, config.beatPattern, config.bpm]);

  // --- Playback Handlers ---

  const togglePlayback = useCallback(() => {
    if (playbackState.isPlaying) {
      playbackEngine.pause();
    } else {
      playbackEngine.play();
    }
  }, [playbackState.isPlaying]);

  const handleSeek = useCallback((time: number) => {
    playbackEngine.seek(time);
    setPlaybackState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const handleLoopChange = useCallback((start: number, end: number) => {
    playbackEngine.setLoop(start, end);
    setPlaybackState(prev => ({ ...prev, loopStart: start, loopEnd: end }));
  }, []);

  // --- Derived State ---

  const filteredStats = useMemo(() => {
    // If running, we use all offsets (Control Chart updates continuously)
    if (sessionState !== 'finished') {
      return StatsCalculator.calculate(sessionOffsets);
    }

    // In Review Mode, 'ResultsChart' (histogram) depends on Loop Range
    const beatDuration = 60 / config.bpm;
    const filtered = sessionOffsets.filter(o => {
      const t = o.beatIndex * beatDuration;
      return t >= playbackState.loopStart && t <= playbackState.loopEnd;
    });
    return StatsCalculator.calculate(filtered);
  }, [sessionOffsets, sessionState, playbackState.loopStart, playbackState.loopEnd, config.bpm]);

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

        {/* Configuration & Input Indicator (Hidden during review) */}
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
                isMicTesting={isMicTesting}
                onMicTestToggle={handleMicTestToggle}
                isPreviewing={isPreviewing}
                onPreviewToggle={handlePreviewToggle}
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

        {/* Real-time Control Chart (Visible during run) OR Review Control Chart */}
        {(sessionState === 'running' || sessionState === 'finished') && (
          <section className="control-chart-section">
            <div className="section-header-row">
              <h2>{sessionState === 'finished' ? 'Session Timeline' : 'Live Analysis'}</h2>
              {sessionState === 'finished' && (
                <button className="back-to-history" onClick={handleReset}>
                  Back to List
                </button>
              )}
            </div>
            <ControlChart
              offsets={sessionOffsets}
              bpm={config.bpm}
              isRunning={sessionState === 'running'}
              isPlaying={playbackState.isPlaying}
              currentTime={sessionState === 'running' ? (currentBeat * (60 / config.bpm)) : playbackState.currentTime}
              totalDuration={sessionState === 'running' ? (config.durationBeats * (60 / config.bpm)) : playbackState.totalDuration}
              loopStart={playbackState.loopStart}
              loopEnd={playbackState.loopEnd}
              onSeek={handleSeek}
              onLoopChange={handleLoopChange}
            />
          </section>
        )}

        <section className="controls-section">
          {sessionState === 'finished' ? (
            <div className="review-controls">
              <button onClick={togglePlayback} className={`play-button ${playbackState.isPlaying ? 'active' : ''}`}>
                {playbackState.isPlaying ? '⏸ Pause' : '▶ Play Recording'}
              </button>
              <button onClick={handleReset} className="reset-button">
                New Session
              </button>
            </div>
          ) : (
            <SessionControls
              state={sessionState}
              currentBeat={currentBeat}
              totalBeats={config.durationBeats}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
            />
          )}
        </section>

        {sessionState === 'finished' && filteredStats && (
          <section className="results-section">
            <h2>Detailed Analysis {playbackState.loopEnd < playbackState.totalDuration && '(Loop Region)'}</h2>
            <ResultsChart stats={filteredStats} bpm={config.bpm} />
          </section>
        )}

        {sessionState === 'idle' && (
          <section className="history-section">
            <div className="history-view-header">
              <h2>{view === 'practice' ? 'How to Use' : 'Performance History'}</h2>
              <div className="view-toggle">
                <button
                  className={`toggle-button ${view === 'practice' ? 'active' : ''}`}
                  onClick={() => setView('practice')}
                >
                  Instructions
                </button>
                <button
                  className={`toggle-button ${view === 'history' ? 'active' : ''}`}
                  onClick={() => setView('history')}
                >
                  History
                </button>
              </div>
            </div>

            {view === 'practice' ? (
              <div className="instructions-section">
                <ol>
                  <li>Set your desired tempo (BPM) and session length</li>
                  <li>Choose your input method (Keyboard, Mic, MIDI)</li>
                  <li>Press Start and play along with the metronome</li>
                  <li>Watch the live Control Chart to see your consistency</li>
                  <li>Review your session with audio playback and analysis tools</li>
                </ol>
              </div>
            ) : (
              <div className="history-view">
                <HistoryFilters
                  filters={filters}
                  onChange={setFilters}
                  maxSessions={history.length}
                />
                <div className="history-chart-wrapper">
                  <HistoryChart history={filteredHistory} />
                </div>
                <HistoryList
                  history={filteredHistory}
                  onClear={handleClearHistory}
                  onSelectSession={handleLoadSession}
                />
              </div>
            )}
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
