# Project Agent Log (agent.md)

> [!IMPORTANT]
> This file is a project-wide log intended for AI agents to understand the history, context, and evolution of the codebase.
> **Instructions for AI Agents**:
> 1.  **Read this file** at the start of every session to get up to speed.
> 2.  **Update this file** at the end of every significant task with a summary of what you've done.
> 3.  Maintain a chronological order of major features and logical components.
> 4.  Cite the relevant `implementation_plan.md`, `task.md`, and `walkthrough.md` artifacts from the session's brain directory if applicable.

---

## Project Overview
TimeTrainer is a high-performance musical timing training application built with React, TypeScript, and the Web Audio API. It measures timing precision (offsets in milliseconds) against a programmable metronome/drum machine.

---

## Development History

### Phase 1: Core Engine & Drum Machine Overhaul
**Status**: Completed (2026-01-03)
**Key Features**:
- **Drum Machine Matrix**: A grid-based pattern editor where all sounds are visible simultaneously.
- **Improved Presets**: Defaults shifted to "Simple Click" using woodblock sounds.
- **Audio Precision**: Refactored `MetronomeEngine` for robust scheduling and low-latency feedback.
- **Simplified UI**: Removed complex toggles in favor of a clean, always-accessible configuration.

### Phase 2: Analysis & Playback
**Status**: Completed (2026-01-03)
**Key Features**:
- **Control Chart (Live & Review)**: 
    - Real-time plotting of timing offsets.
    - Dynamic Control Limits (±3σ) that adjust as the user plays.
    - Green zone indicator for professional-level precision (±25ms).
- **Audio Playback Engine**: 
    - Reconstructs session audio from recorded offsets.
    - Interactive seek and play/pause.
- **Looping & Dynamic Stats**:
    - Trim handles on the chart allow setting a loop region.
    - Histogram and Six Sigma calculations update dynamically based on the loop selection.

### Phase 3: Session History & Filtering
**Status**: Completed (2026-01-03)
**Key Features**:
- **Persistent History**: Sessions are automatically saved to `localStorage`.
- **History List & Graph**: 
    - A dedicated view to see all past attempts.
    - A progress chart plotting Standard Deviation and Mean Offset over time.
- **Advanced Filtering**:
    - "Last X Sessions" slider.
    - Filters for Input Method (Mic/Keyboard/MIDI), BPM range, and Beat count.
- **Historical Review**: 
    - Clicking any entry in the history table loads its full original results state (Chart, Stats, and Recording).
    - "Back to List" navigation for seamless transition between history and review.

---

## Repository Structure & Core Components
- `src/core/`: Logic engines (`MetronomeEngine`, `InputHandler`, `SessionManager`, `PlaybackEngine`, `HistoryManager`).
- `src/components/`: UI components (`ControlChart`, `ResultsChart`, `HistoryList`, `HistoryFilters`).
- `src/types/`: TypeScript definitions across the app.
- `src/App.tsx`: Main application orchestrator.
