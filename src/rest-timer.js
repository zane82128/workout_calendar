const clamp = (input, max) => Math.max(0, Math.min(max, Math.floor(Number(input) || 0)));
export const restConfig = (data) => ({ minutes: clamp(data.restTimerMinutes ?? 1, 99), seconds: clamp(data.restTimerSeconds ?? 30, 59) });
export function remaining(data, now = Date.now()) {
  const config = restConfig(data);
  const base = Number.isFinite(data.restTimerRemainingSeconds) ? data.restTimerRemainingSeconds : config.minutes * 60 + config.seconds;
  const elapsed = data.restTimerRunning ? Math.max(0, Math.floor((now - data.restTimerStartedAt) / 1000)) : 0;
  return Math.max(0, base - elapsed);
}
export const timerLabel = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function createRestTimer({ store, render, message, failure }) {
  let tickId, audio, alarmId, alarmEnd, highlightEnd, highlightUntil = 0, frozen = false;
  function clearHighlight() { clearTimeout(highlightEnd); highlightUntil = 0; }
  function highlight() { clearHighlight(); highlightUntil = Date.now() + 10000; highlightEnd = setTimeout(update, 10000); }
  const voices = new Set();
  const playing = () => alarmId !== undefined;
  function stopAlarm() {
    clearInterval(alarmId); clearTimeout(alarmEnd); alarmId = undefined; alarmEnd = undefined;
    for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    voices.clear();
  }
  async function unlock() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audio ||= new AudioCtor();
    if (audio.state === 'suspended') await audio.resume();
  }
  function alarm() {
    stopAlarm();
    if (!audio || audio.state !== 'running') return;
    const burst = () => {
      const now = audio.currentTime;
      for (const offset of [0, 0.28, 0.56]) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.frequency.value = 880; osc.connect(gain); gain.connect(audio.destination);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
        voices.add(osc);
        osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); };
        osc.start(now + offset); osc.stop(now + offset + 0.22);
      }
    };
    burst(); alarmId = setInterval(burst, 1200);
    alarmEnd = setTimeout(() => { stopAlarm(); update(); }, 60000);
  }
  function update() {
    if (frozen) return;
    try {
      let data = store.read();
      if (data.restTimerRunning && remaining(data) === 0) {
        let completed = false;
        data = store.transaction((latest) => {
          if (latest.restTimerRunning && remaining(latest) === 0) {
            latest.restTimerRunning = false; latest.restTimerRemainingSeconds = 0; completed = true;
          }
        });
        if (completed) { message('休息結束'); alarm(); highlight(); }
      }
      render(data, playing(), Date.now() < highlightUntil);
    } catch (error) { failure(error); }
  }
  function start() {
    clearHighlight();
    stopAlarm();
    // Audio unlock must originate in a gesture; failure must not prevent timing.
    unlock().catch(() => message('此瀏覽器暫時無法播放鈴聲'));
    try {
      store.transaction((data) => {
        if (data.restTimerRunning) return;
        const { minutes, seconds } = restConfig(data);
        if (!(minutes * 60 + seconds)) throw new Error('請先設定休息時間');
        if (!(data.restTimerRemainingSeconds > 0)) data.restTimerRemainingSeconds = minutes * 60 + seconds;
        data.restTimerRunning = true; data.restTimerStartedAt = Date.now();
      });
      update();
    } catch (error) { failure(error); }
  }
  function pause() {
    stopAlarm();
    try {
      store.transaction((data) => { data.restTimerRemainingSeconds = remaining(data); data.restTimerRunning = false; });
      update();
    } catch (error) { failure(error); }
  }
  function configure(minutes, seconds) {
    try {
      store.transaction((data) => {
        if (data.restTimerRunning) return;
        data.restTimerMinutes = clamp(minutes, 99); data.restTimerSeconds = clamp(seconds, 59);
        data.restTimerRemainingSeconds = data.restTimerMinutes * 60 + data.restTimerSeconds;
      });
      stopAlarm(); update();
    } catch (error) { failure(error); }
  }
  function reset() {
    clearHighlight();
    stopAlarm();
    try {
      store.transaction((data) => {
        const { minutes, seconds } = restConfig(data);
        data.restTimerRunning = false;
        data.restTimerRemainingSeconds = minutes * 60 + seconds;
        data.restTimerStartedAt = null;
      });
      update();
    } catch (error) { failure(error); }
  }
  function freeze(value) {
    frozen = value;
    if (value) stopAlarm(); else update();
  }
  tickId = setInterval(update, 1000);
  update();
  return { start, pause, reset, configure, update, freeze, playing, dispose: () => { clearInterval(tickId); stopAlarm(); clearHighlight(); } };
}
