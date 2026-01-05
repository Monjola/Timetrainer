/**
 * PlaybackEngine - Handles playback of recorded sessions
 * 
 * Reconstructs the session audio by scheduling sounds for:
 * 1. The metronome beats (from config)
 * 2. The user's inputs (from offsets)
 * 
 * Supports:
 * - Play/Pause
 * - Seeking
 * - Looping (start/end points)
 */

import type { SessionResult, DrumSoundType } from '../types';
import { metronomeEngine } from './MetronomeEngine';
import { getBeatsPerMeasure } from './PatternUtils';

export interface PlaybackState {
    isPlaying: boolean;
    currentTime: number; // Current playback time in seconds (relative to session start)
    totalTime: number;
    loopStart: number;
    loopEnd: number;
}

export class PlaybackEngine {
    private session: SessionResult | null = null;
    private audioContext: AudioContext | null = null;

    // Playback state
    private isPlaying: boolean = false;
    private playbackStartTime: number = 0; // When playback started (AudioContext time)
    private seekOffset: number = 0; // Where we accepted to start playing (seconds)

    // Loop points (seconds)
    private loopStart: number = 0;
    private loopEnd: number = 0;

    // Scheduler
    private schedulerInterval: number | null = null;
    private nextScheduleTime: number = 0; // Next time to schedule events for
    private readonly SCHEDULE_AHEAD_TIME = 0.1;
    private readonly SCHEDULER_INTERVAL = 25;

    // Events to play
    private metronomeEvents: Array<{ time: number; sound: DrumSoundType }> = [];
    private inputEvents: Array<{ time: number; sound: DrumSoundType }> = [];

    // Callback for UI updates
    private onTimeUpdate: ((time: number) => void) | null = null;
    private onStateChange: ((isPlaying: boolean) => void) | null = null;

    constructor() {
        this.audioContext = metronomeEngine.getAudioContext();
    }

    loadSession(session: SessionResult): void {
        this.session = session;
        this.audioContext = metronomeEngine.getAudioContext();
        this.stop();

        // Calculate session duration
        // We use the last event time (metronome or input) plus a buffer
        const beatDuration = 60 / session.config.bpm;
        const totalBeats = session.config.durationBeats;
        const totalDuration = totalBeats * beatDuration;

        this.loopStart = 0;
        this.loopEnd = totalDuration;
        this.seekOffset = 0;

        this.precomputeEvents(session);
    }

    /**
     * Pre-compute all sound events for the session
     * This makes seeking and looping much easier than real-time generation
     */
    private precomputeEvents(session: SessionResult): void {
        this.metronomeEvents = [];
        this.inputEvents = [];

        const { bpm, beatPattern, durationBeats, tapSound } = session.config;
        const beatDuration = 60 / bpm;
        const subdivisionDuration = beatDuration / beatPattern.subdivisionsPerBeat;
        const beatsPerMeasure = getBeatsPerMeasure(beatPattern.timeSignature);
        const totalSubdivisions = durationBeats * beatPattern.subdivisionsPerBeat;

        // 1. Generate Metronome Events
        // Determine sound mapping based on simple config sound type
        // This mimics MetronomeEngine's internal logic roughly, or uses the pattern sounds directly
        // Ideally we would inspect the session to know exactly what played, but reconstructing from config is standard

        for (let i = 0; i < totalSubdivisions; i++) {
            const time = i * subdivisionDuration;

            // Find position in pattern
            const measureSubdivision = i % (beatsPerMeasure * beatPattern.subdivisionsPerBeat);
            const sounds = beatPattern.grid[measureSubdivision] || [];

            // If the pattern has explicit sounds, use them
            // If it's a generated pattern (like click), we might need to map 'click' to 'click_high' etc.
            // However, the `impl` of `MetronomeEngine` uses `scheduleClick` which switches on `soundType`.
            // We will simplify: If the pattern has generic sounds, we map them.

            if (sounds.length > 0) {
                sounds.forEach(sound => {
                    this.metronomeEvents.push({ time, sound });
                });
            }
        }

        // 2. Generate User Input Events
        session.offsets.forEach(offset => {
            // Calculate absolute time relative to session start using the grid + offset
            // We use the recorded beatIndex and subdivisionIndex as the 'perfect' reference point
            const beatReferenceTime = offset.beatIndex * beatDuration;
            const subdivisionReferenceTime = offset.subdivisionIndex * subdivisionDuration;
            const inputTime = beatReferenceTime + subdivisionReferenceTime + (offset.offsetMs / 1000);

            if (tapSound !== 'none') {
                this.inputEvents.push({
                    time: inputTime,
                    sound: tapSound
                });
            }
        });

        // Sort events by time for efficient scheduling
        this.metronomeEvents.sort((a, b) => a.time - b.time);
        this.inputEvents.sort((a, b) => a.time - b.time);
    }

    play(): void {
        if (this.isPlaying || !this.session || !this.audioContext) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.playbackStartTime = this.audioContext.currentTime - this.seekOffset;
        this.nextScheduleTime = this.seekOffset;

        this.schedulerInterval = window.setInterval(() => this.scheduler(), this.SCHEDULER_INTERVAL);

        this.onStateChange?.(true);
    }

    pause(): void {
        if (!this.isPlaying) return;

        this.isPlaying = false;

        // Store current position
        if (this.audioContext) {
            // Let's rely on the visual time mainly:
            const currentLoopTime = this.getCurrentTime();
            this.seekOffset = currentLoopTime;
        }

        if (this.schedulerInterval !== null) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }

        this.onStateChange?.(false);
    }

    stop(): void {
        this.pause();
        this.seekOffset = this.loopStart;
        this.onTimeUpdate?.(this.loopStart);
    }

    seek(time: number): void {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();

        // Clamp to loop
        this.seekOffset = Math.max(this.loopStart, Math.min(this.loopEnd, time));
        this.onTimeUpdate?.(this.seekOffset);

        if (wasPlaying) this.play();
    }

    setLoop(start: number, end: number): void {
        this.loopStart = start;
        this.loopEnd = end;

        // If current time is outside new loop, seek to start
        const current = this.getCurrentTime();
        if (current < start || current > end) {
            this.seek(start);
        }
    }

    setCallbacks(
        onTimeUpdate: (time: number) => void,
        onStateChange: (isPlaying: boolean) => void
    ): void {
        this.onTimeUpdate = onTimeUpdate;
        this.onStateChange = onStateChange;
    }

    getCurrentTime(): number {
        if (!this.isPlaying || !this.audioContext) return this.seekOffset;

        const elapsed = this.audioContext.currentTime - this.playbackStartTime;
        return Math.max(this.loopStart, Math.min(this.loopEnd, elapsed)); // Naive fallback
    }

    private scheduler(): void {
        if (!this.audioContext || !this.isPlaying) return;

        const currentTime = this.audioContext.currentTime;
        let lookaheadWindowEnd = currentTime + this.SCHEDULE_AHEAD_TIME - this.playbackStartTime;

        if (this.nextScheduleTime >= this.loopEnd) {
            this.nextScheduleTime = this.loopStart;
            // Adjust playback start time so that NOW maps to the new wrapped time
            this.playbackStartTime = currentTime - this.loopStart;
            // Recalculate lookahead since base changed
            lookaheadWindowEnd = currentTime + this.SCHEDULE_AHEAD_TIME - this.playbackStartTime;
        }

        const targetTime = Math.min(lookaheadWindowEnd, this.loopEnd);

        if (targetTime > this.nextScheduleTime) {
            this.scheduleRange(this.nextScheduleTime, targetTime);
            this.nextScheduleTime = targetTime;
        }

        this.onTimeUpdate?.(this.nextScheduleTime);
    }

    private scheduleRange(startTime: number, endTime: number): void {
        if (!this.audioContext) return;

        // Metronome
        this.metronomeEvents.forEach(event => {
            if (event.time >= startTime && event.time < endTime) {
                const playAt = this.playbackStartTime + event.time;
                metronomeEngine.scheduleDrumSound(playAt, event.sound);
            }
        });

        // Inputs
        this.inputEvents.forEach(event => {
            if (event.time >= startTime && event.time < endTime) {
                const playAt = this.playbackStartTime + event.time;
                metronomeEngine.scheduleDrumSound(playAt, event.sound);
            }
        });
    }

    dispose(): void {
        this.stop();
    }
}

export const playbackEngine = new PlaybackEngine();
