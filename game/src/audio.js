// Every sound is synthesised with WebAudio: no audio files, no network.
// The context is created on the first user gesture; until then every call
// is a no-op, so the title screen and the screenshot scenes stay silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let windGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  /** A slow forest round: wooden flute over a low root note. */
  const MELODY = [392, 0, 440, 523, 0, 440, 392, 0, 330, 0, 392, 440, 0, 523, 587, 0];
  const BASS = [98, 0, 0, 0, 110, 0, 0, 0, 98, 0, 0, 0, 131, 0, 0, 0];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.1;
      musicGain.connect(master);
      windGain = ctx.createGain();
      windGain.gain.value = 0.0;
      windGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0, dest = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(dest ?? master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  function scheduleMusic() {
    if (!ctx || muted) return;
    const beat = 0.42;
    const note = MELODY[musicStep % MELODY.length];
    const bass = BASS[musicStep % BASS.length];
    if (note) tone(note, beat * 1.1, 'sine', 0.16, 0, 0, musicGain);
    if (bass) tone(bass, beat * 2.2, 'triangle', 0.2, 0, 0, musicGain);
    musicStep += 1;
    musicTimer = window.setTimeout(scheduleMusic, beat * 1000);
  }

  function startWind() {
    if (!ctx || !windGain) return;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    source.connect(filter);
    filter.connect(windGain);
    source.start();
    windGain.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
  }

  return {
    /** Call from any user gesture: unlocks sound, wind and the theme. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!musicTimer) {
        scheduleMusic();
        startWind();
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted && musicTimer) {
        window.clearTimeout(musicTimer);
        musicTimer = null;
      } else if (!muted && ctx && !musicTimer) {
        scheduleMusic();
      }
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** A seed pressed into soil: a soft wooden thock. */
    plant() {
      tone(190, 0.12, 'triangle', 0.22, 0, 90);
      noise(0.06, 0.1, 900);
    },
    shoot() {
      tone(740, 0.05, 'square', 0.045, 0, 380);
    },
    spray() {
      noise(0.12, 0.05, 1400);
    },
    kill() {
      tone(420, 0.12, 'sine', 0.12, 0, 120);
      noise(0.08, 0.08, 1000);
    },
    explosion() {
      noise(0.3, 0.25, 500);
      tone(110, 0.3, 'sine', 0.2, 0, 40);
    },
    treeHurt() {
      tone(140, 0.3, 'sawtooth', 0.2, 0, 50);
      noise(0.12, 0.12, 700);
    },
    towerLost() {
      tone(300, 0.25, 'triangle', 0.14, 0, 90);
    },
    coin() {
      tone(1180, 0.07, 'sine', 0.09);
      tone(1568, 0.09, 'sine', 0.07, 0.05);
    },
    waveHorn() {
      tone(196, 0.5, 'triangle', 0.2, 0, 196);
      tone(294, 0.5, 'triangle', 0.16, 0.12, 294);
    },
    waveClear() {
      [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, i * 0.08));
    },
    draftChime() {
      [784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, i * 0.09));
    },
    bossRoar() {
      tone(82, 0.9, 'sawtooth', 0.24, 0, 41);
      tone(123, 0.7, 'sawtooth', 0.16, 0.1, 62);
    },
    upgrade() {
      [659, 880, 1175].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, i * 0.06));
    },
    denied() {
      tone(160, 0.14, 'square', 0.1, 0, 110);
    },
    victory() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.32, 'triangle', 0.15, i * 0.12));
    },
    defeat() {
      [330, 294, 262, 196].forEach((f, i) => tone(f, 0.45, 'sawtooth', 0.11, i * 0.18));
    },
  };
}
