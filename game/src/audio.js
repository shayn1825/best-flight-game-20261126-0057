// Synthesised sound: no audio files, everything is an oscillator or
// filtered noise built by WebAudio at first interaction. The engine hum
// follows the throttle, the wind follows the speed.

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };

  audio.start = function start() {
    if (audio.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.context = new Ctx();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.context.destination);

      // Engine: a low sawtooth plus a detuned square, through a lowpass.
      const filter = audio.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.context.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc = audio.context.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 58;
      audio.engineOsc2 = audio.context.createOscillator();
      audio.engineOsc2.type = 'square';
      audio.engineOsc2.frequency.value = 116;
      const osc2Gain = audio.context.createGain();
      osc2Gain.gain.value = 0.35;
      audio.engineOsc.connect(filter);
      audio.engineOsc2.connect(osc2Gain);
      osc2Gain.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      audio.engineOsc2.start();

      // Wind: looped noise through a bandpass that opens with speed.
      const length = audio.context.sampleRate * 2;
      const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      audio.windSource = audio.context.createBufferSource();
      audio.windSource.buffer = buffer;
      audio.windSource.loop = true;
      audio.windFilter = audio.context.createBiquadFilter();
      audio.windFilter.type = 'bandpass';
      audio.windFilter.frequency.value = 700;
      audio.windFilter.Q.value = 0.6;
      audio.windGain = audio.context.createGain();
      audio.windGain.gain.value = 0;
      audio.windSource.connect(audio.windFilter);
      audio.windFilter.connect(audio.windGain);
      audio.windGain.connect(audio.master);
      audio.windSource.start();

      audio.started = true;
    } catch (error) {
      // Sound is garnish: a browser without WebAudio still plays fine.
      audio.started = false;
    }
  };

  audio.update = function update(throttle, speed, flying) {
    if (!audio.started || !audio.context) return;
    const now = audio.context.currentTime;
    const engineLevel = audio.muted ? 0 : flying ? 0.05 + throttle * 0.11 : 0.02;
    audio.engineGain.gain.setTargetAtTime(engineLevel, now, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(52 + throttle * 62, now, 0.1);
    audio.engineOsc2.frequency.setTargetAtTime(104 + throttle * 124, now, 0.1);
    const windLevel = audio.muted ? 0 : Math.min(0.16, Math.max(0, (speed - 18) / 90) * 0.2);
    audio.windGain.gain.setTargetAtTime(windLevel, now, 0.15);
    audio.windFilter.frequency.setTargetAtTime(500 + speed * 14, now, 0.15);
  };

  function blip(frequency, duration, type, level) {
    if (!audio.started || !audio.context || audio.muted) return;
    const now = audio.context.currentTime;
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  audio.ringChime = function ringChime() {
    blip(880, 0.35, 'sine', 0.22);
    setTimeout(() => blip(1318, 0.4, 'sine', 0.18), 90);
  };

  audio.alarm = function alarm() {
    blip(220, 0.18, 'square', 0.1);
  };

  audio.thud = function thud() {
    blip(70, 0.3, 'sine', 0.3);
  };

  audio.fanfare = function fanfare() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => blip(freq, 0.5, 'triangle', 0.2), i * 130);
    });
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    return audio.muted;
  };

  return audio;
}
