# Execution Plan: Schedule Rest Countdown Timer

## Goal
- Add a rest countdown timer under `Session Timer` on Schedule page.
- Timer supports minute/second configuration, countdown start/pause, and alarm when reaching zero.
- Alarm should be routed through normal browser audio output (headphone-compatible).

## Scope
1. UI
- Add a new `Rest Timer` block below session timer.
- Include:
  - minutes input
  - seconds input
  - countdown display text
  - start button
  - pause button

2. State / Persistence
- Extend local state and `localStorage` schema with rest-timer fields:
  - configured minutes
  - configured seconds
  - remaining seconds
  - running flag
  - last start timestamp

3. Timer Engine
- Use timestamp-based countdown for accuracy.
- Reuse the existing 1-second scheduler tick to render both session timer and rest timer.
- Handle lifecycle:
  - start: begin countdown (or resume)
  - pause: freeze remaining seconds
  - complete: stop timer at `00:00`, trigger alarm

4. Alarm
- Use Web Audio API oscillator tone sequence (no external asset).
- Resume/initialize `AudioContext` on user interaction path (`Start`) for autoplay compatibility.
- On completion, play alarm pattern via browser output (works with system headphone output routing).

5. UI Labeling Update
- Keep old labels unchanged.
- Add logical labels for new rest timer components in `tools/ui-map.config.json`.
- Regenerate `docs/ui_component_maps/*_annotated.png`.

6. Documentation
- Update `README.md`:
  - feature list
  - schedule naming terms
  - storage schema additions
- Update `develop_log.md`:
  - implementation record
  - storage/model note
  - UI mapping update mention

## Validation Checklist
- Schedule page shows rest timer block below session timer.
- Minutes/seconds input updates countdown target.
- Start begins countdown; Pause freezes countdown.
- Countdown reaches `00:00` and plays alarm.
- Alarm and timer behavior do not break existing schedule interactions.
- `npm run ui:maps` succeeds and images regenerate.
