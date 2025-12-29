/**
 * InputIndicator - Visual feedback for beats and inputs
 */

import { useEffect, useState } from 'react';
import type { TimingOffset } from '../types';

interface InputIndicatorProps {
  currentBeat: number;
  countIn: { current: number; total: number } | null;
  lastInput: TimingOffset | null;
  isRunning: boolean;
  isCountingIn: boolean;
}

export function InputIndicator({ 
  currentBeat, 
  countIn, 
  lastInput, 
  isRunning, 
  isCountingIn 
}: InputIndicatorProps) {
  const [beatFlash, setBeatFlash] = useState(false);
  const [inputFlash, setInputFlash] = useState(false);
  const [inputColor, setInputColor] = useState<'early' | 'late' | 'perfect'>('perfect');

  // Flash on beat (during running)
  useEffect(() => {
    if (isRunning && currentBeat >= 0) {
      setBeatFlash(true);
      const timer = setTimeout(() => setBeatFlash(false), 100);
      return () => clearTimeout(timer);
    }
  }, [currentBeat, isRunning]);

  // Flash on count-in
  useEffect(() => {
    if (isCountingIn && countIn) {
      setBeatFlash(true);
      const timer = setTimeout(() => setBeatFlash(false), 100);
      return () => clearTimeout(timer);
    }
  }, [countIn, isCountingIn]);

  // Flash on input
  useEffect(() => {
    if (lastInput) {
      setInputFlash(true);
      
      // Determine color based on offset
      const offset = lastInput.offsetMs;
      if (Math.abs(offset) < 20) {
        setInputColor('perfect');
      } else if (offset < 0) {
        setInputColor('early');
      } else {
        setInputColor('late');
      }

      const timer = setTimeout(() => setInputFlash(false), 150);
      return () => clearTimeout(timer);
    }
  }, [lastInput]);

  // Idle state
  if (!isRunning && !isCountingIn) {
    return (
      <div className="input-indicator idle">
        <div className="indicator-text">
          Press Start to begin training
        </div>
      </div>
    );
  }

  // Count-in state (show even if countIn data hasn't arrived yet)
  if (isCountingIn) {
    const countNum = countIn?.current ?? 0;
    const total = countIn?.total ?? 4;
    
    return (
      <div className="input-indicator counting-in">
        <div className="count-in-header">COUNT IN</div>
        <div className={`beat-indicator count-in ${beatFlash ? 'flash' : ''}`}>
          <div className="beat-number">{countNum || '...'}</div>
        </div>
        <div className="count-in-progress">
          {Array.from({ length: total }, (_, i) => (
            <div 
              key={i} 
              className={`count-dot ${i < countNum ? 'filled' : ''}`}
            />
          ))}
        </div>
        <div className="count-in-label">
          Get ready to tap!
        </div>
      </div>
    );
  }

  // Running state
  return (
    <div className="input-indicator running">
      <div className={`beat-indicator ${beatFlash ? 'flash' : ''}`}>
        <div className="beat-number">{currentBeat + 1}</div>
      </div>
      
      <div className={`input-feedback ${inputFlash ? `flash ${inputColor}` : ''}`}>
        {lastInput && (
          <div className="offset-display">
            <span className={`offset-value ${inputColor}`}>
              {lastInput.offsetMs > 0 ? '+' : ''}{lastInput.offsetMs.toFixed(1)}ms
            </span>
            <span className="offset-label">
              {Math.abs(lastInput.offsetMs) < 20 ? 'Perfect!' :
               lastInput.offsetMs < 0 ? 'Early' : 'Late'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
