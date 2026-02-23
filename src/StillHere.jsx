import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════════
// SUPABASE — real messages between users
// ══════════════════════════════════════════════════
const SUPA_URL = "https://ibwfjjtrrrebrhauzdglu.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlid2ZqanRycmVicmhhdXpkZ2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDEwNTksImV4cCI6MjA4NzE3NzA1OX0.Kv2SJfHx5hGG3ZHPRJ4WlV2t_wZBxP3gYCDgRq-0jeE";

const supaFetch = async (path, options = {}) => {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const saveMessage = async ({ text, country, lang }) => {
  // Basic moderation — block if too short, too long, or contains obvious slurs
  if (!text || text.length < 2 || text.length > 200) return;
  const blocked = ["hate","kill","die","fuck","shit","nazi","nigger","faggot"];
  if (blocked.some(w => text.toLowerCase().includes(w))) return;
  await supaFetch("/messages", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({ text, country, lang }),
  });
};

const loadMessages = async (lang) => {
  try {
    const rows = await supaFetch(
      `/messages?select=text,country,lang&flagged=eq.false&order=created_at.desc&limit=60`
    );
    if (!rows?.length) return [];
    const samelang = rows.filter(r => r.lang === lang);
    return (samelang.length >= 3 ? samelang : rows)
      .sort(() => Math.random() - 0.5);
  } catch(e) { return []; }
};

// ══════════════════════════════════════════════════
// SOUND — ambient drone, very quiet
// ══════════════════════════════════════════════════

// ══════════════════════════════════════════════════
// AMBIENT DRONE — very quiet background hum
// ══════════════════════════════════════════════════
const startAmbience = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 8);
    master.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.setValueAtTime(174, ctx.currentTime);
    osc.connect(master); osc.start();
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "sine"; osc2.frequency.setValueAtTime(261, ctx.currentTime);
    g2.gain.setValueAtTime(0.006, ctx.currentTime);
    osc2.connect(g2); g2.connect(master); osc2.start();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine"; lfo.frequency.setValueAtTime(0.06, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.010, ctx.currentTime);
    lfo.connect(lfoGain); lfoGain.connect(master.gain); lfo.start();
    const chime = (freq = 528, vol = 0.040) => {
      const o = ctx.createOscillator(); const env = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(freq, ctx.currentTime);
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.012);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4);
      o.connect(env); env.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 4.5);
    };
    return {
      chimeReceive: () => { [396, 528, 639].forEach((f, i) => setTimeout(() => chime(f, 0.034), i * 700)); },
      chimeSend:    () => { chime(528, 0.046); setTimeout(() => chime(792, 0.028), 400); },
      ctx,
    };
  } catch(e) { return null; }
};

// ══════════════════════════════════════════════════════════════════════
// AMBIENT LOOP SOUNDS — 12 types, warm & light, no darkness
// ══════════════════════════════════════════════════════════════════════

// 1. Child giggle
const playChildGiggle = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const master = audioCtx.createGain(); master.gain.setValueAtTime(0.08, t); master.connect(audioCtx.destination);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const bt = t + i * (0.13 + Math.random() * 0.06);
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.10, audioCtx.sampleRate);
    const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bpf = audioCtx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 1400 + Math.random() * 400; bpf.Q.value = 9;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, bt); env.gain.linearRampToValueAtTime(1, bt + 0.008); env.gain.exponentialRampToValueAtTime(0.001, bt + 0.09);
    src.connect(bpf); bpf.connect(env); env.connect(master);
    src.start(bt); src.stop(bt + 0.11);
  }
  setTimeout(() => { try { master.disconnect(); } catch(e) {} }, 1200);
};

// 2. Warm laugh
const playWarmLaugh = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const master = audioCtx.createGain(); master.gain.setValueAtTime(0.09, t); master.connect(audioCtx.destination);
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const bt = t + i * (0.22 + Math.random() * 0.08);
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.17, audioCtx.sampleRate);
    const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bpf = audioCtx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 700 + Math.random() * 150; bpf.Q.value = 6;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, bt); env.gain.linearRampToValueAtTime(1, bt + 0.014); env.gain.exponentialRampToValueAtTime(0.001, bt + 0.16);
    src.connect(bpf); bpf.connect(env); env.connect(master);
    src.start(bt); src.stop(bt + 0.19);
  }
  setTimeout(() => { try { master.disconnect(); } catch(e) {} }, 1400);
};

// 3. Baby coo
const playBabyCoo = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const freq = 520 + Math.random() * 180; const dur = 0.5 + Math.random() * 0.5;
  const osc = audioCtx.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t); osc.frequency.linearRampToValueAtTime(freq * 1.15, t + dur * 0.5); osc.frequency.linearRampToValueAtTime(freq * 1.05, t + dur);
  const vib = audioCtx.createOscillator(); const vg = audioCtx.createGain();
  vib.frequency.value = 7; vg.gain.value = 10;
  vib.connect(vg); vg.connect(osc.frequency); vib.start(t); vib.stop(t + dur);
  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.060, t + 0.06); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(env); env.connect(audioCtx.destination); osc.start(t); osc.stop(t + dur + 0.05);
};

// 4. Joy bell (C-E-G major chord)
const playJoyBell = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [523, 659, 784].forEach((freq, i) => {
    const nt = t + i * 0.28;
    const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq, nt);
    const osc2 = audioCtx.createOscillator(); osc2.type = "sine"; osc2.frequency.setValueAtTime(freq * 2.01, nt);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.016, nt); osc2.connect(g2);
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, nt); env.gain.linearRampToValueAtTime(0.050 - i * 0.01, nt + 0.01); env.gain.exponentialRampToValueAtTime(0.001, nt + 1.8);
    osc.connect(env); g2.connect(env); env.connect(audioCtx.destination);
    osc.start(nt); osc.stop(nt + 2.0); osc2.start(nt); osc2.stop(nt + 2.0);
  });
};

// 5. Happy melody (do-mi-sol-do)
const playHappyMelody = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [261, 330, 392, 523].forEach((freq, i) => {
    const nt = t + i * 0.22;
    const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq, nt);
    if (i === 3) { const vib = audioCtx.createOscillator(); const vg = audioCtx.createGain(); vib.frequency.value = 5; vg.gain.value = 4; vib.connect(vg); vg.connect(osc.frequency); vib.start(nt); vib.stop(nt + 0.8); }
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, nt); env.gain.linearRampToValueAtTime(0.040, nt + 0.015); env.gain.exponentialRampToValueAtTime(0.001, nt + (i === 3 ? 0.9 : 0.18));
    osc.connect(env); env.connect(audioCtx.destination); osc.start(nt); osc.stop(nt + (i === 3 ? 1.0 : 0.22));
  });
};

// 6. Do-ré-mi scale (full octave)
const playDoReMi = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3].forEach((freq, i) => {
    const nt = t + i * 0.19;
    const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq, nt);
    if (i === 7) { const vib = audioCtx.createOscillator(); const vg = audioCtx.createGain(); vib.frequency.value = 5.5; vg.gain.value = 5; vib.connect(vg); vg.connect(osc.frequency); vib.start(nt); vib.stop(nt + 0.7); }
    const o2 = audioCtx.createOscillator(); o2.type = "sine"; o2.frequency.setValueAtTime(freq * 2, nt);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.013, nt); o2.connect(g2);
    const dur = i === 7 ? 0.85 : 0.16;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, nt); env.gain.linearRampToValueAtTime(0.036, nt + 0.01); env.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    osc.connect(env); g2.connect(env); env.connect(audioCtx.destination);
    osc.start(nt); osc.stop(nt + dur + 0.05); o2.start(nt); o2.stop(nt + dur + 0.05);
  });
};

// 7. Water drop (plucked string feel)
const playWaterDrop = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const freq = 800 + Math.random() * 400;
  const osc = audioCtx.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.6, t); osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.055, t + 0.004); env.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(env); env.connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.6);
};

// 8. Soft wind chime (3 random high notes)
const playWindChime = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const base = [1047, 1175, 1319, 1480, 1568];
  const picks = [...base].sort(() => Math.random() - 0.5).slice(0, 3);
  picks.forEach((freq, i) => {
    const nt = t + i * (0.15 + Math.random() * 0.25);
    const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq, nt);
    const osc2 = audioCtx.createOscillator(); osc2.type = "sine"; osc2.frequency.setValueAtTime(freq * 2.756, nt);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.012, nt); osc2.connect(g2);
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, nt); env.gain.linearRampToValueAtTime(0.038, nt + 0.008); env.gain.exponentialRampToValueAtTime(0.001, nt + 1.4);
    osc.connect(env); g2.connect(env); env.connect(audioCtx.destination);
    osc.start(nt); osc.stop(nt + 1.5); osc2.start(nt); osc2.stop(nt + 1.5);
  });
};

// 9. Distant piano note
const playPianoNote = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const notes = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3];
  const freq = notes[Math.floor(Math.random() * notes.length)];
  [1, 2, 3, 4.2].forEach((mul, i) => {
    const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq * mul, t);
    const vol = [0.045, 0.020, 0.010, 0.005][i];
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + 0.007); env.gain.exponentialRampToValueAtTime(0.001, t + 1.8 - i * 0.2);
    osc.connect(env); env.connect(audioCtx.destination); osc.start(t); osc.stop(t + 2.0);
  });
};

// 10. Soft typewriter tap
const playTypewriter = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const taps = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < taps; i++) {
    const bt = t + i * (0.10 + Math.random() * 0.08);
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.03, audioCtx.sampleRate);
    const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const hp = audioCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2000;
    const env = audioCtx.createGain(); env.gain.setValueAtTime(0.06, bt); env.gain.exponentialRampToValueAtTime(0.001, bt + 0.03);
    src.connect(hp); hp.connect(env); env.connect(audioCtx.destination);
    src.start(bt); src.stop(bt + 0.04);
  }
};

// 11. Marimba single note
const playMarimba = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const freqs = [523, 587, 659, 698, 784, 880];
  const freq = freqs[Math.floor(Math.random() * freqs.length)];
  [1, 3, 5].forEach((mul, i) => {
    const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq * mul, t);
    const env = audioCtx.createGain();
    const vol = [0.05, 0.015, 0.006][i];
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vol, t + 0.005); env.gain.exponentialRampToValueAtTime(0.001, t + 0.5 - i * 0.1);
    osc.connect(env); env.connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.6);
  });
};

// 12. Kalimba tine (two gentle notes)
const playKalimba = (audioCtx) => {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const pairs = [[523, 659],[587, 740],[440, 554],[392, 494]];
  const [f1, f2] = pairs[Math.floor(Math.random() * pairs.length)];
  [[f1, 0], [f2, 0.18]].forEach(([freq, off]) => {
    const nt = t + off;
    [1, 2.756, 5.4].forEach((mul, i) => {
      const osc = audioCtx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq * mul, nt);
      const env = audioCtx.createGain(); const vol = [0.042, 0.012, 0.004][i];
      env.gain.setValueAtTime(0, nt); env.gain.linearRampToValueAtTime(vol, nt + 0.006); env.gain.exponentialRampToValueAtTime(0.001, nt + 1.2 - i * 0.15);
      osc.connect(env); env.connect(audioCtx.destination); osc.start(nt); osc.stop(nt + 1.3);
    });
  });
};

// ── Ambient loop picker — 12 types weighted ──
const SOUND_TYPES = [
  "giggle","giggle","giggle","giggle",
  "laugh","laugh","laugh",
  "baby","baby",
  "bell","bell","bell",
  "doremi","doremi","doremi",
  "melody","melody",
  "water","water","water",
  "chime","chime","chime",
  "piano","piano","piano",
  "typewriter","typewriter",
  "marimba","marimba","marimba",
  "kalimba","kalimba","kalimba",
];
const pickSoundEvent = () => SOUND_TYPES[Math.floor(Math.random() * SOUND_TYPES.length)];

// ══════════════════════════════════════════════════════════════════════
// NOTIFICATION SOUNDS — 45 synthetic sounds, all eras, all phones
// Nokia · iPhone · Samsung · BlackBerry · WhatsApp · Telegram · Discord
// Signal · Snapchat · WeChat · Line · Sony · Motorola · LG · Xiaomi
// Pager · Chiptune · Gameboy · Windows · Mac · Soft ding · Tribal bead
// ══════════════════════════════════════════════════════════════════════
const PHONE_NOTIFS = [

  // 1. iPhone tri-tone (classic, ascending)
  (ctx) => {
    const t = ctx.currentTime;
    [[1046.5, 0], [1318.5, 0.10], [1568, 0.20]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.030, t + off + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.12);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.14);
    });
  },

  // 2. iMessage "swoosh" slide
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.14);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.032, t + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.18);
  },

  // 3. Samsung double ding
  (ctx) => {
    const t = ctx.currentTime;
    [[880, 0], [1108, 0.14]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.setValueAtTime(f * 1.5, t + off);
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.009, t + off); o2.connect(g2);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.033, t + off + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.18);
      o.connect(e); g2.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.20); o2.start(t + off); o2.stop(t + off + 0.20);
    });
  },

  // 4. WhatsApp soft pop
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(1200, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.038, t + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.10);
  },

  // 5. Nokia 3310 classic (square wave, E-A-D)
  (ctx) => {
    const t = ctx.currentTime;
    [[659.3, 0], [880, 0.16], [1174.7, 0.30]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600;
      o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.016, t + off + 0.012); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.14);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.16);
    });
  },

  // 6. Nokia 5110 two beep
  (ctx) => {
    const t = ctx.currentTime;
    [[784, 0], [988, 0.13]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
      o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.015, t + off + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.11);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.13);
    });
  },

  // 7. Nokia descending three notes
  (ctx) => {
    const t = ctx.currentTime;
    [[1047, 0], [880, 0.15], [659, 0.30]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500;
      o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.014, t + off + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.13);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.15);
    });
  },

  // 8. Google Pixel / Android one bell
  (ctx) => {
    const t = ctx.currentTime;
    [0, 0.07].forEach((off, i) => {
      const f = [1047, 1319][i];
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.026, t + off + 0.009); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.22);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.24);
    });
  },

  // 9. Telegram ding (long ring, high)
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(1760, t);
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.setValueAtTime(3520, t);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.007, t); o2.connect(g2);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.028, t + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(e); g2.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.30); o2.start(t); o2.stop(t + 0.30);
  },

  // 10. BlackBerry double-click
  (ctx) => {
    const t = ctx.currentTime;
    [[440, 0], [440, 0.09]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.028, t + off + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.07);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.08);
    });
  },

  // 11. Japanese keitai cute double beep
  (ctx) => {
    const t = ctx.currentTime;
    [[1568, 0], [1760, 0.10]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.024, t + off + 0.007); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.10);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.12);
    });
  },

  // 12. Huawei 4-ascending pips
  (ctx) => {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const nt = t + i * 0.08;
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, nt);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, nt); e.gain.linearRampToValueAtTime(0.020, nt + 0.006); e.gain.exponentialRampToValueAtTime(0.001, nt + 0.07);
      o.connect(e); e.connect(ctx.destination); o.start(nt); o.stop(nt + 0.09);
    });
  },

  // 13. Motorola flip (descending two-tone)
  (ctx) => {
    const t = ctx.currentTime;
    [[1047, 0], [784, 0.13]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.026, t + off + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.14);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.16);
    });
  },

  // 14. Sony Ericsson T610 (three even beeps)
  (ctx) => {
    const t = ctx.currentTime;
    [0, 0.14, 0.28].forEach((off) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(1319, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.022, t + off + 0.007); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.10);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.12);
    });
  },

  // 15. LG rising chirp
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1400, t + 0.18);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.028, t + 0.02); e.gain.setValueAtTime(0.028, t + 0.14); e.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.22);
  },

  // 16. Xiaomi / MIUI two-note pop
  (ctx) => {
    const t = ctx.currentTime;
    [[1047, 0], [1319, 0.08]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.025, t + off + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.13);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.15);
    });
  },

  // 17. OnePlus / Oxygen OS clean single
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(1568, t);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.030, t + 0.007); env.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    o.connect(env); env.connect(ctx.destination); o.start(t); o.stop(t + 0.22);
  },

  // 18. Signal soft blip
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1100, t + 0.06);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.026, t + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.12);
  },

  // 19. Discord pop (low to mid)
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(400, t); o.frequency.exponentialRampToValueAtTime(800, t + 0.05);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.035, t + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.14);
  },

  // 20. Slack pop (medium, warm)
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(660, t);
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.setValueAtTime(990, t + 0.05);
    [o, o2].forEach((osc, i) => {
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + i * 0.05); e.gain.linearRampToValueAtTime(0.025, t + i * 0.05 + 0.007); e.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.14);
      osc.connect(e); e.connect(ctx.destination); osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.16);
    });
  },

  // 21. WeChat / Line rising double
  (ctx) => {
    const t = ctx.currentTime;
    [[659, 0], [880, 0.10]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.024, t + off + 0.007); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.13);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.15);
    });
  },

  // 22. Snapchat soft swoosh down
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(1600, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.028, t + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.17);
  },

  // 23. Viber bubble pop
  (ctx) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.04); o.frequency.exponentialRampToValueAtTime(700, t + 0.09);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.033, t + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.15);
  },

  // 24. Old pager beep (flat monotone)
  (ctx) => {
    const t = ctx.currentTime;
    [0, 0.22, 0.44].forEach((off) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
      o.frequency.setValueAtTime(1000, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.014, t + off + 0.005); e.gain.setValueAtTime(0.014, t + off + 0.14); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.16);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.17);
    });
  },

  // 25. Chiptune Game Boy 8-bit blip
  (ctx) => {
    const t = ctx.currentTime;
    [[440, 0], [587, 0.08], [784, 0.16]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.012, t + off + 0.004); e.gain.setValueAtTime(0.012, t + off + 0.06); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.08);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.09);
    });
  },

  // 26. Chiptune NES-style 4-note riff
  (ctx) => {
    const t = ctx.currentTime;
    [[523, 0], [659, 0.07], [784, 0.14], [1047, 0.21]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2000;
      o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.010, t + off + 0.004); e.gain.setValueAtTime(0.010, t + off + 0.05); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.07);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.08);
    });
  },

  // 27. Windows XP notification
  (ctx) => {
    const t = ctx.currentTime;
    [[1046.5, 0], [880, 0.12], [1046.5, 0.22]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.026, t + off + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.16);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.18);
    });
  },

  // 28. macOS "Tink"
  (ctx) => {
    const t = ctx.currentTime;
    [1, 2.76, 5.4].forEach((mul, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(1600 * mul, t);
      const vol = [0.030, 0.010, 0.004][i];
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t + 0.18 - i * 0.03);
      o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.20);
    });
  },

  // 29. Soft temple bell (metallic shimmer)
  (ctx) => {
    const t = ctx.currentTime;
    const freq = 440;
    [1, 2.756, 5.4, 8.93].forEach((mul, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq * mul, t);
      const vol = [0.038, 0.016, 0.007, 0.003][i];
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + 1.5 - i * 0.18);
      o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 1.6);
    });
  },

  // 30. Tibetan singing bowl start
  (ctx) => {
    const t = ctx.currentTime;
    const freq = 320;
    [1, 2.7, 5.3].forEach((mul, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq * mul, t);
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 5; lg.gain.value = 1.5;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.8);
      const vol = [0.040, 0.012, 0.005][i];
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.018); e.gain.exponentialRampToValueAtTime(0.001, t + 1.8 - i * 0.2);
      o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 2.0);
    });
  },

  // 31. Wind chime two notes
  (ctx) => {
    const t = ctx.currentTime;
    [[1319, 0], [1760, 0.20]].forEach(([f, off]) => {
      [1, 2.756].forEach((mul, i) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * mul, t + off);
        const vol = [0.030, 0.009][i];
        const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(vol, t + off + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + off + 1.0);
        o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 1.1);
      });
    });
  },

  // 32. Soft wooden knock
  (ctx) => {
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 300; bp.Q.value = 3;
    const e = ctx.createGain(); e.gain.setValueAtTime(0.10, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(bp); bp.connect(e); e.connect(ctx.destination); src.start(t); src.stop(t + 0.09);
  },

  // 33. Soft coin tap (bright pluck)
  (ctx) => {
    const t = ctx.currentTime;
    [1, 3.8, 7.2].forEach((mul, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(1200 * mul, t);
      const vol = [0.032, 0.010, 0.004][i];
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.003); e.gain.exponentialRampToValueAtTime(0.001, t + 0.22 - i * 0.04);
      o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.25);
    });
  },

  // 34. Old dial phone ring (two pulses)
  (ctx) => {
    const t = ctx.currentTime;
    [0, 0.30].forEach((off) => {
      [1, 3].forEach((mul) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(440 * mul, t + off);
        const g = ctx.createGain(); g.gain.setValueAtTime(mul === 1 ? 0.020 : 0.007, t + off);
        // AM ring
        const ring = ctx.createOscillator(); ring.type = "sine"; ring.frequency.setValueAtTime(25, t + off);
        const rg = ctx.createGain(); rg.gain.setValueAtTime(0.020, t + off);
        ring.connect(rg); rg.connect(g.gain); ring.start(t + off); ring.stop(t + off + 0.22);
        o.connect(g); g.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.22);
      });
    });
  },

  // 35. 90s Motorola StarTac (square stutter)
  (ctx) => {
    const t = ctx.currentTime;
    [[523, 0], [523, 0.08], [659, 0.20], [659, 0.28]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "square";
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200;
      o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.012, t + off + 0.006); e.gain.setValueAtTime(0.012, t + off + 0.06); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.08);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.09);
    });
  },

  // 36. Early Alcatel/budget phone (sine+detune)
  (ctx) => {
    const t = ctx.currentTime;
    [[880, 0], [932, 0.005], [988, 0.14]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.022, t + off + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.15);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.17);
    });
  },

  // 37. Soft raindrop on glass
  (ctx) => {
    const t = ctx.currentTime;
    const drops = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < drops; i++) {
      const nt = t + i * (0.08 + Math.random() * 0.12);
      const f = 900 + Math.random() * 600;
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f * 1.3, nt); o.frequency.exponentialRampToValueAtTime(f, nt + 0.04);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, nt); e.gain.linearRampToValueAtTime(0.022, nt + 0.003); e.gain.exponentialRampToValueAtTime(0.001, nt + 0.30);
      o.connect(e); e.connect(ctx.destination); o.start(nt); o.stop(nt + 0.32);
    }
  },

  // 38. Marimba 3-note ascending
  (ctx) => {
    const t = ctx.currentTime;
    [[523, 0], [659, 0.13], [784, 0.26]].forEach(([f, off]) => {
      [1, 3, 5].forEach((mul, i) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * mul, t + off);
        const vol = [0.040, 0.012, 0.005][i];
        const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(vol, t + off + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.5 - i * 0.1);
        o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.6);
      });
    });
  },

  // 39. Gentle harp pluck
  (ctx) => {
    const t = ctx.currentTime;
    const notes = [[392, 0], [494, 0.10], [587, 0.20], [784, 0.30]];
    notes.forEach(([f, off]) => {
      [1, 2, 4, 8].forEach((mul, i) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * mul, t + off);
        const vol = [0.030, 0.012, 0.005, 0.002][i];
        const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(vol, t + off + 0.006); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.8 - i * 0.1);
        o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.9);
      });
    });
  },

  // 40. Glass harmonica shimmer
  (ctx) => {
    const t = ctx.currentTime;
    [880, 1108, 1320].forEach((f, i) => {
      const nt = t + i * 0.15;
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, nt);
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = 3;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(nt); lfo.stop(nt + 0.8);
      [1, 2, 3].forEach((mul, j) => {
        const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.setValueAtTime(f * mul, nt);
        const vol = [0.025, 0.010, 0.004][j];
        const e = ctx.createGain(); e.gain.setValueAtTime(0, nt); e.gain.linearRampToValueAtTime(vol, nt + 0.020); e.gain.exponentialRampToValueAtTime(0.001, nt + 0.8);
        o2.connect(e); e.connect(ctx.destination); o2.start(nt); o2.stop(nt + 0.85);
      });
    });
  },

  // 41. Korean/Chinese pop ring (pentatonic 3 notes)
  (ctx) => {
    const t = ctx.currentTime;
    [[523, 0], [659, 0.12], [784, 0.24]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + off);
      const vib = ctx.createOscillator(); const vg = ctx.createGain();
      vib.frequency.value = 8; vg.gain.value = 6;
      vib.connect(vg); vg.connect(o.frequency); vib.start(t + off); vib.stop(t + off + 0.2);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.028, t + off + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.22);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.24);
    });
  },

  // 42. African talking drum tap
  (ctx) => {
    const t = ctx.currentTime;
    [[200, 0], [240, 0.14], [180, 0.28]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f * 1.8, t + off); o.frequency.exponentialRampToValueAtTime(f, t + off + 0.06);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.040, t + off + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.18);
      o.connect(e); e.connect(ctx.destination); o.start(t + off); o.stop(t + off + 0.20);
    });
  },

  // 43. Indian tabla tap pair
  (ctx) => {
    const t = ctx.currentTime;
    [[280, 0], [220, 0.12]].forEach(([f, off]) => {
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(f * 2, t + off); o.frequency.exponentialRampToValueAtTime(f, t + off + 0.08);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * 0.3 * (1 - j / d.length);
      const ns = ctx.createBufferSource(); ns.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 4;
      ns.connect(bp);
      const mix = ctx.createGain(); mix.gain.setValueAtTime(0.018, t + off);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t + off); e.gain.linearRampToValueAtTime(0.036, t + off + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + off + 0.22);
      o.connect(e); bp.connect(mix); mix.connect(e); e.connect(ctx.destination);
      o.start(t + off); o.stop(t + off + 0.24); ns.start(t + off); ns.stop(t + off + 0.09);
    });
  },

  // 44. Soft xylophone note
  (ctx) => {
    const t = ctx.currentTime;
    const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
    const f = notes[Math.floor(Math.random() * notes.length)];
    [1, 3, 5, 7].forEach((mul, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f * mul, t);
      const vol = [0.042, 0.016, 0.007, 0.003][i];
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + 0.45 - i * 0.07);
      o.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 0.50);
    });
  },

  // 45. Ancient clay bell (warm, muffled, earthen)
  (ctx) => {
    const t = ctx.currentTime;
    const freq = 350;
    [1, 2.4, 4.1, 6.3].forEach((mul, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq * mul, t);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      const vol = [0.038, 0.014, 0.006, 0.002][i];
      const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + 0.010); e.gain.exponentialRampToValueAtTime(0.001, t + 1.0 - i * 0.12);
      o.connect(lp); lp.connect(e); e.connect(ctx.destination); o.start(t); o.stop(t + 1.1);
    });
  },

];

// Pick a random phone notification sound
const playPhoneNotif = (audioCtx) => {
  if (!audioCtx) return;
  try { PHONE_NOTIFS[Math.floor(Math.random() * PHONE_NOTIFS.length)](audioCtx); } catch(e) {}
};

// ══════════════════════════════════════════════════
// COUNTRIES
// ══════════════════════════════════════════════════
const COUNTRIES = [
  "Afghanistan","Algeria","Argentina","Australia","Austria","Bangladesh",
  "Belgium","Bolivia","Brazil","Cambodia","Cameroon","Canada","Chile","China",
  "Colombia","Congo","Côte d'Ivoire","Croatia","Czech Republic","Denmark",
  "Ecuador","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece",
  "Guatemala","Haiti","Hungary","India","Indonesia","Iran","Iraq","Ireland",
  "Israel","Italy","Japan","Jordan","Kenya","Lebanon","Libya","Madagascar",
  "Malaysia","Mali","Mexico","Morocco","Mozambique","Nepal","Netherlands",
  "New Zealand","Nigeria","Norway","Pakistan","Palestine","Peru","Philippines",
  "Poland","Portugal","Romania","Russia","Rwanda","Saudi Arabia","Senegal",
  "South Africa","South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland",
  "Syria","Taiwan","Tanzania","Thailand","Tunisia","Turkey","Uganda","Ukraine",
  "United Kingdom","United States","Uruguay","Venezuela","Vietnam","Yemen","Zimbabwe",
].sort();

// ══════════════════════════════════════════════════
// RECEIVE STREAMS — per language
// Rules: always positive, never dark undertones,
// fluent natural sentences, warm & encouraging.
// ══════════════════════════════════════════════════
const RECEIVE_STREAMS = {
  en: [
    { text: "your skin is not a problem. it is history, beauty, and strength.", from: "Accra" },
    { text: "the colour of your skin has never determined your value. not for a single second.", from: "São Paulo" },
    { text: "the world told you that you didn't belong. the world was wrong.", from: "Johannesburg" },
    { text: "your culture is not inferior. it is ancient and beautiful and yours.", from: "Hanoi" },
    { text: "the hatred others carry is their burden, not a verdict on you.", from: "Beirut" },
    { text: "no one's bias can erase your dignity.", from: "Kingston" },
    { text: "you have the right to exist fully, without apology.", from: "Lagos" },
    { text: "you have always had the right to take up space in this world.", from: "Toronto" },
    { text: "who you love is not a mistake.", from: "Amsterdam" },
    { text: "you are whole, just as you are.", from: "Stockholm" },
    { text: "your identity is not a phase, a choice, or something to fix. it is you.", from: "Berlin" },
    { text: "the shame they put on you was never yours to carry.", from: "Cape Town" },
    { text: "there are people in this world who will love you exactly as you are.", from: "Tokyo" },
    { text: "you deserve love that doesn't come with conditions.", from: "Lisbon" },
    { text: "your heart knows who it is. that knowledge is sacred.", from: "Buenos Aires" },
    { text: "you are not alone in this. there is a whole community that sees you.", from: "Paris" },
    { text: "somewhere in the world right now, someone is sending you warmth.", from: "Seoul" },
    { text: "you are someone worth knowing, worth loving, worth finding.", from: "Dublin" },
    { text: "the right people are still on their way to you.", from: "Nairobi" },
    { text: "even in silence, you are held by more love than you can see.", from: "Oslo" },
    { text: "one day you will find your people. they are looking for you too.", from: "Montréal" },
    { text: "you are in someone's thoughts right now, even if you don't know it.", from: "Warsaw" },
    { text: "everything kind that has ever been said about you — that is the truth.", from: "Athens" },
    { text: "everything you have been through has shaped someone remarkable.", from: "Mumbai" },
    { text: "you are not what they called you.", from: "Chicago" },
    { text: "you are so much more than any single chapter of your life.", from: "Edinburgh" },
    { text: "you have always deserved to be treated with gentleness and respect.", from: "Geneva" },
    { text: "your mind deserves as much care as your body.", from: "Melbourne" },
    { text: "every step you take, however small, is real progress.", from: "Helsinki" },
    { text: "you have more strength in you than you have ever had to show.", from: "Mexico City" },
    { text: "every day you choose to keep going is an act of courage.", from: "Vancouver" },
    { text: "your feelings are valid. every single one of them.", from: "Cairo" },
    { text: "asking for help is one of the bravest things a person can do.", from: "Bogotá" },
    { text: "you are allowed to not be okay. and you are allowed to get better.", from: "Istanbul" },
    { text: "your body is not a problem to solve.", from: "New Delhi" },
    { text: "your body deserves kindness, exactly as it is.", from: "Casablanca" },
    { text: "your worth has nothing to do with your size or your shape.", from: "Auckland" },
    { text: "being between two worlds is not being lost. it is being vast.", from: "Dakar" },
    { text: "your accent is not a flaw. it is proof of every world you carry inside you.", from: "Abidjan" },
    { text: "you don't have to choose between where you're from and where you are.", from: "Vienna" },
    { text: "leaving everything behind to build something new takes extraordinary courage.", from: "Copenhagen" },
    { text: "you don't have to perform happiness to deserve kindness.", from: "Tunis" },
    { text: "you are not a burden. you never were.", from: "Santiago" },
    { text: "one person's rejection is not the verdict on your life.", from: "Karachi" },
    { text: "you have shown up for yourself every single day. that is everything.", from: "Lagos" },
    { text: "being kind in a cruel world is not naivety. it is strength.", from: "Rome" },
    { text: "you are not behind. you are on your own path.", from: "Kuala Lumpur" },
    { text: "your softness is not a weakness to fix. it is a gift.", from: "Prague" },
    { text: "you are growing, even when you can't feel it.", from: "Rabat" },
    { text: "rest is not giving up. rest is how you keep going.", from: "Seoul" },
    { text: "you don't have to earn your right to exist.", from: "Lima" },
    { text: "someone is quietly proud of how far you've come.", from: "Osaka" },
    { text: "you don't need to be perfect to be loved.", from: "Reykjavik" },
    { text: "your value as a person is complete and unconditional.", from: "Nairobi" },
    { text: "hardship is not who you are. it is the chapter you are in.", from: "Dhaka" },
    { text: "you are seen, you are heard, and you matter.", from: "Boston" },
    { text: "your story is still being written. the best chapters haven't come yet.", from: "Jakarta" },
    { text: "I am glad you exist.", from: "Warsaw" },
    { text: "you are loved in ways you may never fully know.", from: "Lagos" },
    { text: "small steps are still steps. you are still moving forward.", from: "Addis Ababa" },
    { text: "I hope today holds at least one beautiful thing for you.", from: "Kyoto" },
  ],
  fr: [
    { text: "ta peau n'est pas un problème. c'est de l'histoire, de la beauté, de la force.", from: "Abidjan" },
    { text: "la couleur de ta peau n'a jamais déterminé ta valeur. pas une seule seconde.", from: "São Paulo" },
    { text: "le monde t'a dit que tu n'avais pas ta place ici. le monde avait tort.", from: "Johannesburg" },
    { text: "ta culture n'est pas inférieure. elle est ancienne, belle et elle t'appartient.", from: "Hanoï" },
    { text: "la haine que les autres portent est leur fardeau, pas un verdict sur toi.", from: "Beyrouth" },
    { text: "aucun préjugé ne peut effacer ta dignité.", from: "Kingston" },
    { text: "tu as le droit d'exister pleinement, sans t'excuser.", from: "Lagos" },
    { text: "tu as toujours eu le droit de prendre ta place dans ce monde.", from: "Toronto" },
    { text: "qui tu aimes n'est pas une erreur.", from: "Amsterdam" },
    { text: "tu es entier(e), exactement tel(le) que tu es.", from: "Stockholm" },
    { text: "ton identité n'est pas une phase, un choix, ni quelque chose à corriger. c'est toi.", from: "Berlin" },
    { text: "la honte qu'ils t'ont imposée n'a jamais été la tienne.", from: "Le Cap" },
    { text: "il y a des gens dans ce monde qui t'aimeront exactement comme tu es.", from: "Tokyo" },
    { text: "tu mérites un amour qui ne vient pas avec des conditions.", from: "Lisbonne" },
    { text: "ton cœur sait qui il est. cette certitude est sacrée.", from: "Buenos Aires" },
    { text: "tu n'es pas seul(e). il existe toute une communauté qui te voit.", from: "Montréal" },
    { text: "quelque part dans le monde, quelqu'un t'envoie de la chaleur en ce moment.", from: "Séoul" },
    { text: "tu es quelqu'un qui mérite d'être connu(e), aimé(e), trouvé(e).", from: "Dublin" },
    { text: "les bonnes personnes sont encore en chemin vers toi.", from: "Nairobi" },
    { text: "même dans le silence, tu es porté(e) par plus d'amour que tu ne le vois.", from: "Oslo" },
    { text: "un jour tu trouveras ta tribu. elle te cherche aussi.", from: "Dakar" },
    { text: "tu es dans les pensées de quelqu'un en ce moment, même si tu ne le sais pas.", from: "Varsovie" },
    { text: "tout ce qui a été dit de beau sur toi — c'est ça, la vérité.", from: "Athènes" },
    { text: "tout ce que tu as traversé a façonné quelqu'un de remarquable.", from: "Mumbai" },
    { text: "tu n'es pas ce qu'ils t'ont appelé(e).", from: "Chicago" },
    { text: "tu es bien plus que n'importe quel chapitre de ta vie.", from: "Édimbourg" },
    { text: "tu as toujours mérité d'être traité(e) avec douceur et respect.", from: "Genève" },
    { text: "ton esprit mérite autant de soin que ton corps.", from: "Melbourne" },
    { text: "chaque pas que tu fais, aussi petit soit-il, est un vrai progrès.", from: "Helsinki" },
    { text: "tu as en toi plus de force que tu n'as jamais eu à montrer.", from: "Mexico" },
    { text: "chaque jour où tu choisis de continuer est un acte de courage.", from: "Vancouver" },
    { text: "tes émotions sont valides. toutes, sans exception.", from: "Le Caire" },
    { text: "demander de l'aide est l'un des actes les plus courageux qui soit.", from: "Bogotá" },
    { text: "tu as le droit de ne pas aller bien. et tu as le droit d'aller mieux.", from: "Istanbul" },
    { text: "ton corps n'est pas un problème à résoudre.", from: "New Delhi" },
    { text: "ton corps mérite d'être traité avec douceur, tel qu'il est.", from: "Casablanca" },
    { text: "ta valeur n'a rien à voir avec ta taille ou ton apparence.", from: "Auckland" },
    { text: "être entre deux mondes, ce n'est pas être perdu(e). c'est être vaste.", from: "Abidjan" },
    { text: "ton accent n'est pas un défaut. c'est la preuve de chaque monde que tu portes en toi.", from: "Tunis" },
    { text: "tu n'as pas à choisir entre d'où tu viens et où tu es.", from: "Vienne" },
    { text: "tout quitter pour construire quelque chose de nouveau demande un courage extraordinaire.", from: "Copenhague" },
    { text: "tu n'as pas à simuler la joie pour mériter la bienveillance.", from: "Rabat" },
    { text: "tu n'es pas un fardeau. tu ne l'as jamais été.", from: "Santiago" },
    { text: "le refus d'une personne n'est pas le verdict sur ta vie.", from: "Karachi" },
    { text: "tu t'es présenté(e) pour toi-même chaque jour. c'est tout ce qui compte.", from: "Lagos" },
    { text: "être doux(ce) dans un monde cruel n'est pas de la naïveté. c'est de la force.", from: "Rome" },
    { text: "tu n'es pas en retard. tu es sur ton propre chemin.", from: "Kuala Lumpur" },
    { text: "ta douceur n'est pas un défaut à corriger. c'est un don.", from: "Prague" },
    { text: "tu grandis, même quand tu ne le ressens pas.", from: "Rabat" },
    { text: "se reposer n'est pas abandonner. c'est ainsi qu'on continue.", from: "Séoul" },
    { text: "tu n'as pas à mériter ton droit d'exister.", from: "Lima" },
    { text: "quelqu'un est discrètement fier(ère) du chemin parcouru.", from: "Osaka" },
    { text: "tu n'as pas besoin d'être parfait(e) pour être aimé(e).", from: "Reykjavik" },
    { text: "ta valeur en tant que personne est entière et inconditionnelle.", from: "Nairobi" },
    { text: "la difficulté n'est pas qui tu es. c'est juste le chapitre dans lequel tu es.", from: "Dhaka" },
    { text: "tu es vu(e), tu es entendu(e), et tu comptes.", from: "Boston" },
    { text: "ton histoire s'écrit encore. les meilleurs chapitres ne sont pas encore arrivés.", from: "Jakarta" },
    { text: "je suis heureux(se) que tu existes.", from: "Varsovie" },
    { text: "tu es aimé(e) d'une façon que tu ne mesures peut-être pas.", from: "Lagos" },
    { text: "les petits pas sont quand même des pas. tu avances.", from: "Addis-Abeba" },
    { text: "j'espère qu'aujourd'hui contient au moins une belle chose pour toi.", from: "Kyoto" },
  ],
  de: [
    { text: "deine Haut ist kein Problem. Sie ist Geschichte, Schönheit und Stärke.", from: "Accra" },
    { text: "die Farbe deiner Haut hat niemals deinen Wert bestimmt. Keine einzige Sekunde.", from: "São Paulo" },
    { text: "die Welt hat dir gesagt, du gehörst nicht dazu. Die Welt hat sich geirrt.", from: "Johannesburg" },
    { text: "deine Kultur ist nicht minderwertig. Sie ist uralt, wunderschön und dein.", from: "Hanoi" },
    { text: "der Hass, den andere tragen, ist ihre Last, kein Urteil über dich.", from: "Beirut" },
    { text: "kein Vorurteil kann deine Würde auslöschen.", from: "Kingston" },
    { text: "du hast das Recht, vollständig zu existieren, ohne dich zu entschuldigen.", from: "Lagos" },
    { text: "wen du liebst, ist kein Fehler.", from: "Amsterdam" },
    { text: "du bist vollständig, genau so wie du bist.", from: "Stockholm" },
    { text: "deine Identität ist keine Phase, keine Wahl, nichts zum Reparieren. Sie bist du.", from: "Berlin" },
    { text: "die Scham, die sie dir auferlegt haben, war nie deine.", from: "Kapstadt" },
    { text: "es gibt Menschen auf der Welt, die dich genau so lieben werden, wie du bist.", from: "Tokio" },
    { text: "du verdienst Liebe, die keine Bedingungen kennt.", from: "Lissabon" },
    { text: "dein Herz weiß, wer es ist. Diese Gewissheit ist heilig.", from: "Buenos Aires" },
    { text: "du bist nicht allein. Es gibt eine ganze Gemeinschaft, die dich sieht.", from: "Paris" },
    { text: "irgendwo auf der Welt schickt dir gerade jemand Wärme.", from: "Seoul" },
    { text: "du bist jemand, der es wert ist, gekannt, geliebt und gefunden zu werden.", from: "Dublin" },
    { text: "die richtigen Menschen sind noch auf dem Weg zu dir.", from: "Nairobi" },
    { text: "auch im Schweigen wirst du von mehr Liebe gehalten, als du sehen kannst.", from: "Oslo" },
    { text: "eines Tages findest du deine Menschen. Sie suchen auch nach dir.", from: "Dakar" },
    { text: "alles Freundliche, das je über dich gesagt wurde — das ist die Wahrheit.", from: "Athen" },
    { text: "du hast etwas Schweres überlebt. Das ist nicht nichts. Das ist alles.", from: "Mumbai" },
    { text: "du bist nicht das, was sie dich genannt haben.", from: "Chicago" },
    { text: "du bist nicht so viel mehr als jedes einzelne Kapitel deines Lebens.", from: "Edinburgh" },
    { text: "du hast immer verdient, mit Sanftheit und Respekt behandelt zu werden.", from: "Genf" },
    { text: "dein Geist verdient genauso viel Fürsorge wie dein Körper.", from: "Melbourne" },
    { text: "jeder Schritt, den du machst, egal wie klein, ist echter Fortschritt.", from: "Helsinki" },
    { text: "du hast mehr Kraft in dir, als du je zeigen musstest.", from: "Mexiko-Stadt" },
    { text: "jeder Tag, an dem du dich entscheidest weiterzumachen, ist ein Akt des Mutes.", from: "Vancouver" },
    { text: "deine Gefühle sind berechtigt. Alle miteinander.", from: "Kairo" },
    { text: "um Hilfe zu bitten ist eine der mutigsten Dinge, die ein Mensch tun kann.", from: "Bogotá" },
    { text: "du darfst nicht in Ordnung sein. Und du darfst es besser werden.", from: "Istanbul" },
    { text: "dein Körper ist kein Problem, das gelöst werden muss.", from: "Neu-Delhi" },
    { text: "dein Körper verdient Fürsorge und Freundlichkeit, genau so wie er ist.", from: "Casablanca" },
    { text: "dein Wert hat nichts mit deiner Größe oder deinem Aussehen zu tun.", from: "Auckland" },
    { text: "zwischen zwei Welten zu sein bedeutet nicht, verloren zu sein. Es bedeutet, weit zu sein.", from: "Dakar" },
    { text: "dein Akzent ist kein Fehler. Er ist der Beweis für jede Welt, die du in dir trägst.", from: "Tunis" },
    { text: "du musst nicht zwischen deiner Herkunft und deinem jetzigen Ort wählen.", from: "Wien" },
    { text: "alles hinter sich zu lassen, um etwas Neues aufzubauen, erfordert außergewöhnlichen Mut.", from: "Kopenhagen" },
    { text: "du musst keine Freude vorspielen, um Güte zu verdienen.", from: "Rabat" },
    { text: "du bist keine Last. Das warst du nie.", from: "Santiago" },
    { text: "du bist jeden Tag für dich selbst erschienen. Das ist alles.", from: "Lagos" },
    { text: "sanft zu sein in einer grausamen Welt ist keine Naivität. Es ist Stärke.", from: "Rom" },
    { text: "du bist nicht zurück. Du bist auf deinem eigenen Weg.", from: "Kuala Lumpur" },
    { text: "deine Sanftheit ist kein Fehler, den es zu beheben gilt. Sie ist ein Geschenk.", from: "Prag" },
    { text: "du wächst, auch wenn du es nicht spüren kannst.", from: "Rabat" },
    { text: "ruhe ist kein Aufgeben. Es ist, wie man weitermacht.", from: "Seoul" },
    { text: "du musst dein Recht zu existieren nicht verdienen.", from: "Lima" },
    { text: "jemand ist still stolz auf alles, was du bisher geschafft hast.", from: "Osaka" },
    { text: "du musst nicht perfekt sein, um geliebt zu werden.", from: "Reykjavik" },
    { text: "du wirst gesehen, gehört, und du bist wichtig.", from: "Boston" },
    { text: "deine Geschichte wird noch geschrieben. Die besten Kapitel kommen noch.", from: "Jakarta" },
    { text: "ich bin froh, dass du existierst.", from: "Warschau" },
    { text: "du wirst auf eine Weise geliebt, die du vielleicht nicht vollständig kennst.", from: "Lagos" },
    { text: "kleine Schritte sind immer noch Schritte. Du bewegst dich vorwärts.", from: "Addis Abeba" },
    { text: "ich hoffe, dein Tag hält mindestens eine schöne Sache für dich bereit.", from: "Kyoto" },
  ],
  it: [
    { text: "la tua pelle non è un problema. è storia, bellezza e forza.", from: "Accra" },
    { text: "il colore della tua pelle non ha mai determinato il tuo valore. neanche per un secondo.", from: "São Paulo" },
    { text: "il mondo ti ha detto che non appartieni qui. il mondo aveva torto.", from: "Johannesburg" },
    { text: "la tua cultura non è inferiore. è antica, bella e tua.", from: "Hanoi" },
    { text: "l'odio che gli altri portano è il loro fardello, non un verdetto su di te.", from: "Beirut" },
    { text: "nessun pregiudizio può cancellare la tua dignità.", from: "Lagos" },
    { text: "hai il diritto di esistere pienamente, senza scusarti.", from: "Kingston" },
    { text: "chi ami non è un errore.", from: "Amsterdam" },
    { text: "sei intero(a), esattamente come sei.", from: "Stoccolma" },
    { text: "la tua identità non è una fase, una scelta, né qualcosa da correggere. sei tu.", from: "Berlino" },
    { text: "la vergogna che ti hanno imposto non è mai stata tua.", from: "Città del Capo" },
    { text: "ci sono persone in questo mondo che ti ameranno esattamente come sei.", from: "Tokyo" },
    { text: "meriti un amore che non viene con condizioni.", from: "Lisbona" },
    { text: "il tuo cuore sa chi è. quella certezza è sacra.", from: "Buenos Aires" },
    { text: "non sei solo(a). esiste un'intera comunità che ti vede.", from: "Parigi" },
    { text: "da qualche parte nel mondo, qualcuno ti sta mandando calore in questo momento.", from: "Seul" },
    { text: "sei qualcuno che vale la pena conoscere, amare, trovare.", from: "Dublino" },
    { text: "le persone giuste sono ancora in cammino verso di te.", from: "Nairobi" },
    { text: "anche nel silenzio, sei sorretto(a) da più amore di quanto riesci a vedere.", from: "Oslo" },
    { text: "un giorno troverai la tua gente. sta cercando anche te.", from: "Dakar" },
    { text: "tutto ciò che è stato detto di bello su di te — quella è la verità.", from: "Atene" },
    { text: "tutto ciò che hai attraversato ha plasmato qualcuno di straordinario.", from: "Mumbai" },
    { text: "non sei ciò che ti hanno chiamato(a).", from: "Chicago" },
    { text: "non sei ciò che ti è successo.", from: "Edimburgo" },
    { text: "hai sempre meritato di essere trattato(a) con dolcezza e rispetto.", from: "Ginevra" },
    { text: "la tua mente merita tante cure quanto il tuo corpo.", from: "Melbourne" },
    { text: "ogni passo che fai, anche piccolo, è un progresso reale.", from: "Helsinki" },
    { text: "hai dentro di te più forza di quanta tu abbia mai dovuto mostrare.", from: "Città del Messico" },
    { text: "ogni giorno in cui scegli di andare avanti è un atto di coraggio.", from: "Vancouver" },
    { text: "le tue emozioni sono valide. tutte quante.", from: "Il Cairo" },
    { text: "chiedere aiuto è una delle cose più coraggiose che una persona possa fare.", from: "Bogotá" },
    { text: "hai il diritto di non stare bene. e hai il diritto di migliorare.", from: "Istanbul" },
    { text: "il tuo corpo non è un problema da risolvere.", from: "Nuova Delhi" },
    { text: "il tuo corpo merita gentilezza, esattamente com'è.", from: "Casablanca" },
    { text: "il tuo valore non ha nulla a che fare con la tua taglia o la tua forma.", from: "Auckland" },
    { text: "essere tra due mondi non significa essere perduto(a). significa essere vasto(a).", from: "Dakar" },
    { text: "il tuo accento non è un difetto. è la prova di ogni mondo che porti dentro di te.", from: "Tunisi" },
    { text: "non devi scegliere tra da dove vieni e dove sei.", from: "Vienna" },
    { text: "non devi fingere felicità per meritare gentilezza.", from: "Rabat" },
    { text: "non sei un peso. non lo sei mai stato(a).", from: "Santiago" },
    { text: "ti sei presentato(a) per te stesso(a) ogni giorno. questo è tutto.", from: "Lagos" },
    { text: "essere gentile in un mondo crudele non è ingenuità. è forza.", from: "Roma" },
    { text: "non sei indietro. sei sul tuo percorso.", from: "Kuala Lumpur" },
    { text: "la tua dolcezza non è un difetto da correggere. è un dono.", from: "Praga" },
    { text: "stai crescendo, anche quando non riesci a sentirlo.", from: "Rabat" },
    { text: "riposarsi non è arrendersi. è il modo in cui si va avanti.", from: "Seul" },
    { text: "non devi guadagnarti il diritto di esistere.", from: "Lima" },
    { text: "qualcuno è in silenzio orgoglioso(a) di quanto sei arrivato(a).", from: "Osaka" },
    { text: "non devi essere perfetto(a) per essere amato(a).", from: "Reykjavik" },
    { text: "sei visto(a), sei ascoltato(a), e conti.", from: "Boston" },
    { text: "la tua storia si sta ancora scrivendo. i capitoli migliori non sono ancora arrivati.", from: "Giacarta" },
    { text: "sono felice che tu esista.", from: "Varsavia" },
    { text: "sei amato(a) in modi che forse non conosci pienamente.", from: "Lagos" },
    { text: "i piccoli passi sono comunque passi. stai ancora andando avanti.", from: "Addis Abeba" },
    { text: "spero che oggi contenga almeno una cosa bella per te.", from: "Kyoto" },
  ],
  es: [
    { text: "tu piel no es un problema. es historia, belleza y fuerza.", from: "Accra" },
    { text: "el color de tu piel nunca ha determinado tu valor. ni un solo segundo.", from: "São Paulo" },
    { text: "el mundo te dijo que no pertenecías aquí. el mundo estaba equivocado.", from: "Johannesburgo" },
    { text: "tu cultura no es inferior. es antigua, bella y tuya.", from: "Hanói" },
    { text: "el odio que otros cargan es su carga, no un veredicto sobre ti.", from: "Beirut" },
    { text: "ningún prejuicio puede borrar tu dignidad.", from: "Kingston" },
    { text: "tienes derecho a existir completamente, sin disculparte.", from: "Lagos" },
    { text: "siempre has tenido el derecho de ocupar tu lugar en este mundo.", from: "Toronto" },
    { text: "a quien amas no es un error.", from: "Amsterdam" },
    { text: "eres completo(a), exactamente como eres.", from: "Estocolmo" },
    { text: "tu identidad no es una fase, una elección, ni algo que arreglar. eres tú.", from: "Berlín" },
    { text: "la vergüenza que te impusieron nunca fue tuya.", from: "Ciudad del Cabo" },
    { text: "hay personas en este mundo que te amarán exactamente como eres.", from: "Tokio" },
    { text: "mereces un amor que no viene con condiciones.", from: "Lisboa" },
    { text: "tu corazón sabe quién es. esa certeza es sagrada.", from: "Buenos Aires" },
    { text: "no estás solo(a). existe toda una comunidad que te ve.", from: "París" },
    { text: "en algún lugar del mundo, alguien te está enviando calor ahora mismo.", from: "Seúl" },
    { text: "eres alguien que vale la pena conocer, amar y encontrar.", from: "Dublín" },
    { text: "las personas indicadas todavía están en camino hacia ti.", from: "Nairobi" },
    { text: "incluso en el silencio, estás sostenido(a) por más amor del que puedes ver.", from: "Oslo" },
    { text: "un día encontrarás a tus personas. también te están buscando.", from: "Dakar" },
    { text: "todo lo amable que se ha dicho de ti — esa es la verdad.", from: "Atenas" },
    { text: "todo lo que has vivido ha formado a alguien extraordinario.", from: "Mumbai" },
    { text: "no eres lo que te llamaron.", from: "Chicago" },
    { text: "no eres lo que te pasó.", from: "Edimburgo" },
    { text: "siempre has merecido ser tratado(a) con gentileza y respeto.", from: "Ginebra" },
    { text: "tu mente merece tanto cuidado como tu cuerpo.", from: "Melbourne" },
    { text: "cada paso que das, por pequeño que sea, es un progreso real.", from: "Helsinki" },
    { text: "tienes dentro de ti más fuerza de la que has tenido que mostrar.", from: "Ciudad de México" },
    { text: "cada día que eliges seguir adelante es un acto de valentía.", from: "Vancouver" },
    { text: "tus sentimientos son válidos. todos y cada uno de ellos.", from: "El Cairo" },
    { text: "pedir ayuda es una de las cosas más valientes que puede hacer una persona.", from: "Bogotá" },
    { text: "tienes derecho a no estar bien. y tienes derecho a mejorar.", from: "Estambul" },
    { text: "tu cuerpo no es un problema que resolver.", from: "Nueva Delhi" },
    { text: "tu cuerpo merece amabilidad, exactamente como es.", from: "Casablanca" },
    { text: "tu valor no tiene nada que ver con tu talla o tu forma.", from: "Auckland" },
    { text: "estar entre dos mundos no significa estar perdido(a). significa ser vasto(a).", from: "Dakar" },
    { text: "tu acento no es un defecto. es la prueba de cada mundo que llevas dentro.", from: "Túnez" },
    { text: "no tienes que elegir entre de dónde vienes y dónde estás.", from: "Viena" },
    { text: "dejarlo todo para construir algo nuevo requiere un valor extraordinario.", from: "Copenhague" },
    { text: "no tienes que fingir alegría para merecer bondad.", from: "Rabat" },
    { text: "no eres una carga. nunca lo fuiste.", from: "Santiago" },
    { text: "te has presentado para ti mismo(a) cada día. eso es todo.", from: "Lagos" },
    { text: "ser amable en un mundo cruel no es ingenuidad. es fortaleza.", from: "Roma" },
    { text: "no estás atrasado(a). estás en tu propio camino.", from: "Kuala Lumpur" },
    { text: "tu suavidad no es un defecto que arreglar. es un don.", from: "Praga" },
    { text: "estás creciendo, aunque no puedas sentirlo.", from: "Rabat" },
    { text: "descansar no es rendirse. es cómo se sigue adelante.", from: "Seúl" },
    { text: "no tienes que ganarte tu derecho a existir.", from: "Lima" },
    { text: "alguien está calladamente orgulloso(a) de lo lejos que has llegado.", from: "Osaka" },
    { text: "no tienes que ser perfecto(a) para ser amado(a).", from: "Reykjavik" },
    { text: "eres visto(a), escuchado(a) e importante.", from: "Boston" },
    { text: "tu historia todavía se está escribiendo. los mejores capítulos aún no han llegado.", from: "Yakarta" },
    { text: "me alegra que existas.", from: "Varsovia" },
    { text: "eres amado(a) de maneras que quizás no conoces del todo.", from: "Lagos" },
    { text: "los pasos pequeños siguen siendo pasos. sigues avanzando.", from: "Addis Abeba" },
    { text: "espero que hoy contenga al menos una cosa hermosa para ti.", from: "Kioto" },
  ],
  pt: [
    { text: "sua pele não é um problema. é história, beleza e força.", from: "Accra" },
    { text: "a cor da sua pele nunca determinou seu valor. nem por um segundo.", from: "São Paulo" },
    { text: "o mundo disse que você não pertencia aqui. o mundo estava errado.", from: "Joanesburgo" },
    { text: "sua cultura não é inferior. é antiga, linda e sua.", from: "Hanói" },
    { text: "o ódio que os outros carregam é o fardo deles, não um veredicto sobre você.", from: "Beirute" },
    { text: "nenhum preconceito pode apagar sua dignidade.", from: "Kingston" },
    { text: "você tem o direito de existir plenamente, sem se desculpar.", from: "Lagos" },
    { text: "você sempre teve o direito de ocupar seu espaço neste mundo.", from: "Toronto" },
    { text: "quem você ama não é um erro.", from: "Amsterdã" },
    { text: "você é inteiro(a), exatamente como é.", from: "Estocolmo" },
    { text: "sua identidade não é uma fase, uma escolha, nem algo a corrigir. é você.", from: "Berlim" },
    { text: "a vergonha que te impuseram nunca foi sua.", from: "Cidade do Cabo" },
    { text: "há pessoas neste mundo que vão te amar exatamente como você é.", from: "Tóquio" },
    { text: "você merece amor que não vem com condições.", from: "Lisboa" },
    { text: "seu coração sabe quem é. essa certeza é sagrada.", from: "Buenos Aires" },
    { text: "você não está sozinho(a). existe toda uma comunidade que te vê.", from: "Paris" },
    { text: "em algum lugar do mundo, alguém está te mandando calor agora mesmo.", from: "Seul" },
    { text: "você é alguém que vale a pena conhecer, amar e encontrar.", from: "Dublin" },
    { text: "as pessoas certas ainda estão a caminho de você.", from: "Nairobi" },
    { text: "mesmo no silêncio, você é sustentado(a) por mais amor do que consegue ver.", from: "Oslo" },
    { text: "um dia você vai encontrar a sua tribo. ela também está te procurando.", from: "Dakar" },
    { text: "tudo de gentil que já foi dito sobre você — essa é a verdade.", from: "Atenas" },
    { text: "tudo o que você viveu moldou alguém extraordinário.", from: "Mumbai" },
    { text: "você não é o que te chamaram.", from: "Chicago" },
    { text: "você não é o que aconteceu com você.", from: "Edimburgo" },
    { text: "você sempre mereceu ser tratado(a) com gentileza e respeito.", from: "Genebra" },
    { text: "sua mente merece tanto cuidado quanto seu corpo.", from: "Melbourne" },
    { text: "cada passo que você dá, por menor que seja, é um progresso real.", from: "Helsinki" },
    { text: "você tem dentro de si mais força do que já precisou mostrar.", from: "Cidade do México" },
    { text: "cada dia que você escolhe continuar é um ato de coragem.", from: "Vancouver" },
    { text: "seus sentimentos são válidos. todos eles.", from: "Cairo" },
    { text: "pedir ajuda é uma das coisas mais corajosas que uma pessoa pode fazer.", from: "Bogotá" },
    { text: "você tem o direito de não estar bem. e tem o direito de melhorar.", from: "Istambul" },
    { text: "seu corpo não é um problema a resolver.", from: "Nova Delhi" },
    { text: "seu corpo merece gentileza, exatamente como é.", from: "Casablanca" },
    { text: "seu valor não tem nada a ver com seu tamanho ou sua forma.", from: "Auckland" },
    { text: "estar entre dois mundos não é estar perdido(a). é ser vasto(a).", from: "Dakar" },
    { text: "seu sotaque não é um defeito. é a prova de cada mundo que você carrega dentro de si.", from: "Tunis" },
    { text: "você não precisa escolher entre de onde vem e onde está.", from: "Viena" },
    { text: "deixar tudo para trás para construir algo novo exige uma coragem extraordinária.", from: "Copenhague" },
    { text: "você não precisa fingir alegria para merecer bondade.", from: "Rabat" },
    { text: "você não é um fardo. nunca foi.", from: "Santiago" },
    { text: "você se apresentou para si mesmo(a) todos os dias. isso é tudo.", from: "Lagos" },
    { text: "ser gentil num mundo cruel não é ingenuidade. é força.", from: "Roma" },
    { text: "você não está atrasado(a). está no seu próprio caminho.", from: "Kuala Lumpur" },
    { text: "sua gentileza não é um defeito a corrigir. é um dom.", from: "Praga" },
    { text: "você está crescendo, mesmo quando não consegue sentir isso.", from: "Rabat" },
    { text: "descansar não é desistir. é como se continua.", from: "Seul" },
    { text: "você não precisa merecer seu direito de existir.", from: "Lima" },
    { text: "alguém está em silêncio orgulhoso(a) de até onde você chegou.", from: "Osaka" },
    { text: "você não precisa ser perfeito(a) para ser amado(a).", from: "Reykjavik" },
    { text: "você é visto(a), ouvido(a) e importante.", from: "Boston" },
    { text: "sua história ainda está sendo escrita. os melhores capítulos ainda não chegaram.", from: "Jacarta" },
    { text: "fico feliz que você exista.", from: "Varsóvia" },
    { text: "você é amado(a) de formas que talvez não conheça completamente.", from: "Lagos" },
    { text: "passos pequenos ainda são passos. você ainda está avançando.", from: "Adis Abeba" },
    { text: "espero que hoje tenha pelo menos uma coisa bonita para você.", from: "Kyoto" },
  ],
  ar: [
    { text: "بشرتك ليست مشكلة. إنها تاريخ وجمال وقوة.", from: "أكرا" },
    { text: "لون بشرتك لم يحدد قيمتك قط. ولا لثانية واحدة.", from: "ساو باولو" },
    { text: "قال لك العالم إنك لا تنتمي هنا. كان العالم مخطئاً.", from: "جوهانسبرغ" },
    { text: "ثقافتك ليست أدنى. إنها عريقة وجميلة وخاصة بك.", from: "هانوي" },
    { text: "الكراهية التي يحملها الآخرون هي عبؤهم، وليست حكماً عليك.", from: "بيروت" },
    { text: "لا يمكن لأي تحيز أن يمحو كرامتك.", from: "كينغستون" },
    { text: "لديك الحق في الوجود الكامل، دون اعتذار.", from: "لاغوس" },
    { text: "لطالما كان لديك الحق في أن تأخذ مكانك في هذا العالم.", from: "تورنتو" },
    { text: "من تحب(ين) ليس خطأً.", from: "أمستردام" },
    { text: "أنت مكتمل(ة) تماماً كما أنت.", from: "ستوكهولم" },
    { text: "هويتك ليست مرحلة ولا اختياراً ولا شيئاً يحتاج إصلاحاً. إنها أنت.", from: "برلين" },
    { text: "الخزي الذي أُلقي عليك لم يكن لك يوماً.", from: "كيب تاون" },
    { text: "هناك أشخاص في هذا العالم سيحبونك بالضبط كما أنت.", from: "طوكيو" },
    { text: "تستحق(ين) حباً لا يأتي بشروط.", from: "لشبونة" },
    { text: "قلبك يعرف من هو. هذا اليقين مقدس.", from: "بوينس آيرس" },
    { text: "لست وحدك(ِ). هناك مجتمع كامل يراك.", from: "باريس" },
    { text: "في مكان ما في العالم، شخص يرسل لك الدفء الآن.", from: "سيول" },
    { text: "أنت شخص يستحق أن يُعرف، أن يُحَب، أن يُجَد.", from: "دبلن" },
    { text: "الأشخاص المناسبون لا يزالون في طريقهم إليك.", from: "نيروبي" },
    { text: "حتى في الصمت، أنت محمول(ة) بحب أكثر مما تستطيع رؤيته.", from: "أوسلو" },
    { text: "يوماً ما ستجد أهلك. إنهم يبحثون عنك أيضاً.", from: "داكار" },
    { text: "كل ما قيل عنك بلطف ومحبة — ذلك هو الحقيقة.", from: "أثينا" },
    { text: "كل ما مررت به شكّل شخصاً استثنائياً.", from: "مومباي" },
    { text: "لست ما نعتوك به.", from: "شيكاغو" },
    { text: "أنت أكثر بكثير من أي لحظة واحدة في حياتك.", from: "إدنبرة" },
    { text: "لطالما استحققت أن تُعامَل بلطف واحترام.", from: "جنيف" },
    { text: "عقلك يستحق نفس القدر من الرعاية التي يستحقها جسدك.", from: "ملبورن" },
    { text: "كل خطوة تخطوها، مهما كانت صغيرة، هي تقدم حقيقي.", from: "هلسنكي" },
    { text: "في داخلك قوة أكبر مما احتجت إلى إظهاره.", from: "مكسيكو سيتي" },
    { text: "كل يوم تختار فيه المضي قدماً هو فعل من أفعال الشجاعة.", from: "فانكوفر" },
    { text: "مشاعرك صحيحة. كلها دون استثناء.", from: "القاهرة" },
    { text: "طلب المساعدة من أشجع ما يمكن لإنسان أن يفعله.", from: "بوغوتا" },
    { text: "يحق لك أن لا تكون بخير. ويحق لك أن تتحسن.", from: "إسطنبول" },
    { text: "جسدك ليس مشكلة تحتاج إلى حل.", from: "نيو دلهي" },
    { text: "جسدك يستحق اللطف والعناية، تماماً كما هو اليوم.", from: "الدار البيضاء" },
    { text: "قيمتك لا علاقة لها بحجمك أو مظهرك.", from: "أوكلاند" },
    { text: "أن تكون بين عالمين لا يعني أنك ضائع(ة). يعني أنك واسع(ة).", from: "داكار" },
    { text: "لكنتك ليست عيباً. إنها دليل على كل عالم تحمله بداخلك.", from: "تونس" },
    { text: "لا يجب أن تختار بين من أين أتيت وأين أنت الآن.", from: "فيينا" },
    { text: "أن تترك كل شيء لتبني شيئاً جديداً يتطلب شجاعة استثنائية.", from: "كوبنهاغن" },
    { text: "لا يجب أن تتظاهر بالسعادة لتستحق اللطف.", from: "الرباط" },
    { text: "لست عبئاً. لم تكن كذلك قط.", from: "سانتياغو" },
    { text: "لقد حضرت لنفسك كل يوم. هذا كل شيء.", from: "لاغوس" },
    { text: "أن تكون لطيفاً(ة) في عالم قاسٍ ليس سذاجة. إنه قوة.", from: "روما" },
    { text: "لست متأخراً(ة). أنت على مسارك الخاص.", from: "كوالالمبور" },
    { text: "دفء روحك ليس عيباً. إنه هبة.", from: "براغ" },
    { text: "أنت تنمو، حتى حين لا تشعر بذلك.", from: "الرباط" },
    { text: "الراحة ليست استسلاماً. إنها الطريقة التي تستمر بها.", from: "سيول" },
    { text: "لا يجب أن تكسب حقك في الوجود.", from: "ليما" },
    { text: "شخص ما فخور(ة) بهدوء بمدى ما وصلت إليه.", from: "أوساكا" },
    { text: "لا يجب أن تكون مثالياً(ة) لتُحَب.", from: "ريكيافيك" },
    { text: "أنت مرئي(ة)، مسموع(ة)، وتهم(ين).", from: "بوسطن" },
    { text: "قصتك لا تزال تُكتب. الفصول الأفضل لم تأتِ بعد.", from: "جاكرتا" },
    { text: "يسعدني أنك موجود(ة).", from: "وارسو" },
    { text: "أنت محبوب(ة) بطرق ربما لا تعرفها تماماً.", from: "لاغوس" },
    { text: "الخطوات الصغيرة لا تزال خطوات. لا تزال تتقدم.", from: "أديس أبابا" },
    { text: "أتمنى أن يحتوي يومك على شيء جميل واحد على الأقل.", from: "كيوتو" },
  ],
};

// ══════════════════════════════════════════════════
// GIVE MESSAGES — only light, warmth, encouragement
// No dark undertones. No references to hard nights.
// Every sentence must feel like sunshine.
// ══════════════════════════════════════════════════
const GIVE_MSGS = {
  en: [
    // — belonging & love —
    "Someone loves you. Right now, in this moment.",
    "I don't know you. I love you anyway.",
    "You already belong here. You don't have to earn it.",
    "You are worthy of love without changing a single thing.",
    "You are not a burden. You never were.",
    "You are enough, exactly as you are. Not a future version. Now.",
    "Someone across the world just thought of you with warmth.",
    "The world is a little brighter because you are in it.",
    "You are someone's favourite person and they haven't told you yet.",
    "Even strangers want you to be okay.",
    "You don't have to perform happiness to deserve kindness.",
    "You are loved in ways you may never fully know.",
    // — loneliness —
    "You are not alone, even when it feels that way.",
    "You are someone worth knowing, worth loving, worth finding.",
    "Somewhere in the world right now, someone is sending you warmth.",
    "Loneliness is not the truth about you. It is just a feeling passing through.",
    "The right people are still on their way to you.",
    "Even in silence, you are held by more love than you can see.",
    "One day you will find your people. They are looking for you too.",
    "You are in someone's thoughts right now, even if you don't know it.",
    // — racism & discrimination —
    "Your skin is not a problem. It is history, beauty, and strength.",
    "The world told you that you didn't belong. The world was wrong.",
    "Your heritage is not a liability. It is your power.",
    "The colour of your skin has never determined your value. Not for a single second.",
    "Racism is a wound inflicted on you. It says nothing true about who you are.",
    "You were never the problem. The prejudice was.",
    "Your culture is not inferior. It is ancient and beautiful and yours.",
    "You have always had the right to take up space in this world.",
    "You are exactly who you are meant to be.",
    "The hatred others carry is their burden, not a verdict on you.",
    "You have the right to exist fully, without apology.",
    "No one's bias can erase your dignity.",
    // — bullying & words that hurt —
    "Everything kind that has ever been said about you — that is the truth.",
    "What others say about you says nothing about who you are.",
    "Your value was never determined by how others treated you.",
    "You were never the problem. The cruelty was theirs alone.",
    "Everything you have been through has shaped someone remarkable.",
    "What others think of you is their story, not yours.",
    "You are not what they called you.",
    "You are so much more than any single moment of your life.",
    "You have always deserved to be treated with gentleness and respect.",
    // — homophobia & LGBTQ+ —
    "Who you love is not a mistake.",
    "You are whole, just as you are.",
    "Loving who you love is one of the most human things there is.",
    "Your identity is not a phase, a choice, or something to fix. It is you.",
    "You deserve love that doesn't come with conditions.",
    "The shame they put on you was never yours to carry.",
    "There are people in this world who will love you exactly as you are. They exist.",
    "Your heart knows who it is. That knowledge is sacred.",
    "You are not alone in this. There is a whole community that sees you.",
    "You deserve to take up space in this world, proudly and completely.",
    // — mental health & inner struggle —
    "Your mind deserves as much care as your body.",
    "Every step you take, however small, is real progress.",
    "You are allowed to not be okay. And you are allowed to get better.",
    "You have more strength in you than you have ever had to show.",
    "Every day you choose to keep going is an act of courage.",
    "Your feelings are valid. Every single one of them.",
    "You are allowed to be gentle with yourself. That is not weakness.",
    "Asking for help is one of the bravest things a person can do.",
    "You are allowed to rest without having to earn it.",
    // — body image —
    "Your body is not a problem to solve or a project to finish.",
    "Your body deserves kindness and care, exactly as it is today.",
    "You are allowed to take up space. All the space you need.",
    "Your worth has nothing to do with your size or your shape.",
    "Your body is yours. It deserves to be treated with care and kindness.",
    "You don't need to change to deserve love.",
    // — immigration & diaspora —
    "Being between two worlds is not being lost. It is being vast.",
    "Your accent is not a flaw. It is proof of every world you carry inside you.",
    "You don't have to choose between where you're from and where you are.",
    "Leaving everything behind to build something new takes extraordinary courage.",
    "Your roots and your new life are both real. Both belong to you.",
    // — poverty & hardship —
    "Your value as a person is complete, exactly as you are.",
    "You are worthy of dignity, always and completely.",
    "Hardship does not define your future. It is just the chapter you are in.",
    // — self-worth & courage —
    "One person's rejection is not the verdict on your life.",
    "Your story is still being written. The best is still ahead.",
    "You have shown up for yourself every single day. That is everything.",
    "The courage you carry quietly is extraordinary.",
    "Being kind in a cruel world is not naivety. It is strength.",
    "You are not behind. You are on your own path.",
    "Every single day, you matter.",
    "Small steps are still steps. You are still moving forward.",
    "Someone is quietly proud of how far you've come.",
    "You don't have to be perfect to be loved.",
    "Rest is not giving up. Rest is how you keep going.",
    "Your softness is not a weakness to fix. It is a gift.",
    "You are growing, even when you can't feel it.",
    "Choosing gentleness, always, is one of the bravest things there is.",
    "I hope today holds at least one beautiful thing for you.",
    "I hope you feel a little lighter after reading this.",
  ],
  fr: [
    // — appartenance & amour —
    "Quelqu'un t'aime. En ce moment précis.",
    "Je ne te connais pas. Je t'aime quand même.",
    "Tu appartiens déjà ici. Tu n'as pas à le mériter.",
    "Tu es digne d'être aimé(e) sans changer quoi que ce soit.",
    "Tu n'es pas un fardeau. Tu ne l'as jamais été.",
    "Tu es entier(e), exactement tel(le) que tu es. Maintenant. Pas plus tard.",
    "Quelqu'un de l'autre côté du monde vient de penser à toi avec tendresse.",
    "Le monde brille un peu plus parce que tu y es.",
    "Tu es la personne préférée de quelqu'un et il ne te l'a pas encore dit.",
    "Même des inconnus veulent que tu ailles bien.",
    "Tu n'as pas à simuler la joie pour mériter la bienveillance.",
    "Tu es aimé(e) d'une façon que tu ne mesures peut-être pas.",
    // — solitude —
    "Tu n'es pas seul(e), même quand il le semble.",
    "Tu es quelqu'un qui mérite d'être connu(e), aimé(e), trouvé(e).",
    "Quelque part dans le monde en ce moment, quelqu'un t'envoie de la chaleur.",
    "La solitude n'est pas la vérité sur toi. C'est juste un sentiment qui traverse.",
    "Les bonnes personnes sont encore en chemin vers toi.",
    "Dans le silence, tu es porté(e) par plus d'amour que tu ne le vois.",
    "Un jour tu trouveras ta tribu. Elle te cherche aussi.",
    "Tu es dans les pensées de quelqu'un en ce moment, même si tu ne le sais pas.",
    // — racisme & discrimination —
    "Ta peau n'est pas un problème. C'est de l'histoire, de la beauté, de la force.",
    "Le monde t'a dit que tu n'avais pas ta place ici. Le monde avait tort.",
    "Ton héritage n'est pas un handicap. C'est ta puissance.",
    "La couleur de ta peau n'a jamais déterminé ta valeur. Pas une seule seconde.",
    "Le racisme est une blessure qu'on t'a infligée. Il ne dit rien de vrai sur qui tu es.",
    "Tu n'as jamais été le problème. Le préjugé, oui.",
    "Ta culture n'est pas inférieure. Elle est ancienne, belle et elle t'appartient.",
    "Tu as toujours eu le droit de prendre ta place dans ce monde.",
    "Tu es exactement qui tu es censé(e) être.",
    "La haine que les autres portent est leur fardeau, pas un verdict sur toi.",
    "Tu as le droit d'exister pleinement, sans t'excuser.",
    "Aucun préjugé ne peut effacer ta dignité.",
    // — harcèlement & mots qui blessent —
    "Tout ce qui a été dit de beau sur toi — c'est ça, la vérité.",
    "Ce que les autres disent de toi ne dit rien sur qui tu es.",
    "Ta valeur n'a jamais été déterminée par la façon dont les autres t'ont traité(e).",
    "Tu n'as jamais été le problème. La cruauté était la leur.",
    "Tout ce que tu as traversé a façonné quelqu'un de remarquable.",
    "Ce que les autres pensent de toi est leur histoire, pas la tienne.",
    "Tu n'es pas ce qu'ils t'ont appelé(e).",
    "Tu es bien plus que n'importe quel moment de ta vie.",
    "Tu as toujours mérité d'être traité(e) avec douceur et respect.",
    // — homophobie & identité LGBTQ+ —
    "Qui tu aimes n'est pas une erreur.",
    "Tu es entier(e), exactement tel(le) que tu es.",
    "Aimer qui tu aimes est l'une des choses les plus humaines qui soit.",
    "Ton identité n'est pas une phase, un choix, ou quelque chose à corriger. C'est toi.",
    "Tu mérites un amour qui ne vient pas avec des conditions.",
    "La honte qu'ils t'ont imposée n'a jamais été la tienne.",
    "Il y a des gens dans ce monde qui t'aimeront exactement comme tu es. Ils existent.",
    "Ton cœur sait qui il est. Cette certitude est sacrée.",
    "Tu n'es pas seul(e). Il existe toute une communauté qui te voit.",
    "Tu mérites de prendre ta place dans ce monde, fièrement et complètement.",
    // — santé mentale & luttes intérieures —
    "Ton esprit mérite autant de soin que ton corps.",
    "Chaque pas que tu fais, aussi petit soit-il, est un vrai progrès.",
    "Tu as le droit de ne pas aller bien. Et tu as le droit d'aller mieux.",
    "Tu as en toi plus de force que tu n'as jamais eu à montrer.",
    "Chaque jour où tu choisis de continuer est un acte de courage.",
    "Tes émotions sont valides. Toutes, sans exception.",
    "Tu as le droit d'être doux(ce) avec toi-même. Ce n'est pas une faiblesse.",
    "Demander de l'aide est l'un des actes les plus courageux qui soit.",
    "Tu as le droit de te reposer sans avoir à le mériter.",
    // — image du corps —
    "Ton corps n'est pas un problème à résoudre.",
    "Ton corps mérite de la bienveillance et du soin, exactement tel qu'il est.",
    "Tu as le droit de prendre de la place. Toute la place dont tu as besoin.",
    "Ta valeur n'a rien à voir avec ta taille ou ton apparence.",
    "Ton corps est le tien. Il mérite d'être traité avec soin et bienveillance.",
    "Tu n'as pas besoin de changer pour mériter d'être aimé(e).",
    // — immigration & diaspora —
    "Être entre deux mondes, ce n'est pas être perdu(e). C'est être vaste.",
    "Ton accent n'est pas un défaut. C'est la preuve de chaque monde que tu portes en toi.",
    "Tu n'as pas à choisir entre d'où tu viens et où tu es.",
    "Tout quitter pour construire quelque chose de nouveau demande un courage extraordinaire.",
    "Tes racines et ta nouvelle vie sont toutes les deux réelles. Elles t'appartiennent toutes les deux.",
    // — estime de soi & courage —
    "Le refus d'une personne n'est pas le verdict sur ta vie.",
    "Ton histoire s'écrit encore. Le meilleur est devant toi.",
    "Tu t'es présenté(e) pour toi-même chaque jour. C'est tout ce qui compte.",
    "Le courage que tu portes discrètement est extraordinaire.",
    "Être doux(ce) dans un monde cruel n'est pas de la naïveté. C'est de la force.",
    "Tu n'es pas en retard. Tu es sur ton propre chemin.",
    "Chaque jour sans exception, tu comptes.",
    "Les petits pas sont quand même des pas. Tu avances.",
    "Quelqu'un est discrètement fier(ère) du chemin parcouru.",
    "Tu n'as pas besoin d'être parfait(e) pour être aimé(e).",
    "Se reposer n'est pas abandonner. C'est ainsi qu'on continue.",
    "Ta douceur n'est pas un défaut à corriger. C'est un don.",
    "Tu grandis, même quand tu ne le ressens pas.",
    "Choisir la douceur, toujours, est l'un des actes les plus courageux qui soit.",
    "J'espère qu'aujourd'hui contient au moins une belle chose pour toi.",
    "J'espère que tu te sens un peu plus léger(ère) après avoir lu ça.",
  ],
  de: [
    // — Zugehörigkeit & Liebe —
    "Jemand liebt dich. Genau jetzt, in diesem Moment.",
    "Ich kenne dich nicht. Ich liebe dich trotzdem.",
    "Du gehörst bereits hierher. Du musst es nicht verdienen.",
    "Du bist es wert, geliebt zu werden, ohne irgendetwas zu ändern.",
    "Du bist keine Last. Das warst du nie.",
    "Du bist genug, genau so wie du bist. Jetzt. Nicht irgendwann.",
    "Jemand auf der anderen Seite der Welt hat gerade an dich gedacht.",
    "Die Welt leuchtet ein bisschen heller, weil du da bist.",
    "Du bist jemandes Lieblingsmensch und sie haben es dir noch nicht gesagt.",
    "Sogar Fremde wollen, dass es dir gut geht.",
    "Du musst keine Freude vorspielen, um Güte zu verdienen.",
    "Du wirst auf eine Weise geliebt, die du vielleicht nicht vollständig weißt.",
    // — Einsamkeit —
    "Du bist nicht allein, auch wenn es sich so anfühlt.",
    "Du bist jemand, der es wert ist, gekannt, geliebt und gefunden zu werden.",
    "Irgendwo auf der Welt schickt dir gerade jemand Wärme.",
    "Einsamkeit ist nicht die Wahrheit über dich. Es ist nur ein Gefühl, das vorbeizieht.",
    "Die richtigen Menschen sind noch auf dem Weg zu dir.",
    "Auch im Schweigen wirst du von mehr Liebe gehalten, als du sehen kannst.",
    "Eines Tages findest du deine Menschen. Sie suchen auch nach dir.",
    // — Rassismus & Diskriminierung —
    "Deine Haut ist kein Problem. Sie ist Geschichte, Schönheit und Stärke.",
    "Die Welt hat dir gesagt, du gehörst nicht dazu. Die Welt hat sich geirrt.",
    "Dein Erbe ist keine Last. Es ist deine Kraft.",
    "Die Farbe deiner Haut hat niemals deinen Wert bestimmt. Keine einzige Sekunde.",
    "Rassismus ist eine Wunde, die man dir zugefügt hat. Er sagt nichts Wahres über dich.",
    "Du warst nie das Problem. Das Vorurteil war es.",
    "Deine Kultur ist nicht minderwertig. Sie ist uralt, wunderschön und dein.",
    "Du hattest immer das Recht, deinen Platz in der Welt einzunehmen.",
    "Du bist genau der Mensch, der du sein sollst.",
    "Der Hass, den andere tragen, ist ihre Last, kein Urteil über dich.",
    "Du hast das Recht, vollständig und ohne Entschuldigung zu existieren.",
    "Kein Vorurteil kann deine Würde auslöschen.",
    // — Mobbing & verletzende Worte —
    "Alles Freundliche, das je über dich gesagt wurde — das ist die Wahrheit.",
    "Was andere über dich sagen, sagt nichts darüber aus, wer du bist.",
    "Dein Wert wurde niemals davon bestimmt, wie andere dich behandelt haben.",
    "Du warst nie das Problem. Die Grausamkeit gehörte ihnen.",
    "Alles, was du durchgemacht hast, hat jemanden Außergewöhnliches geformt.",
    "Was andere über dich denken, ist ihre Geschichte, nicht deine.",
    "Du bist nicht das, was sie dich genannt haben.",
    "Du bist so viel mehr als jeder einzelne Moment deines Lebens.",
    "Du hast immer verdient, mit Sanftheit und Respekt behandelt zu werden.",
    // — Homophobie & LGBTQ+ —
    "Wen du liebst, ist kein Fehler.",
    "Du bist vollständig, genau so wie du bist.",
    "Den zu lieben, den du liebst, ist eines der menschlichsten Dinge überhaupt.",
    "Deine Identität ist keine Phase, keine Wahl, nichts zum Reparieren. Sie bist du.",
    "Du verdienst Liebe, die keine Bedingungen kennt.",
    "Die Scham, die sie dir auferlegt haben, war nie deine.",
    "Es gibt Menschen auf der Welt, die dich genau so lieben werden, wie du bist. Sie existieren.",
    "Dein Herz weiß, wer es ist. Diese Gewissheit ist heilig.",
    "Du bist nicht allein. Es gibt eine ganze Gemeinschaft, die dich sieht.",
    // — psychische Gesundheit —
    "Dein Geist verdient genauso viel Fürsorge wie dein Körper.",
    "Jeder Schritt, den du machst, egal wie klein, ist echter Fortschritt.",
    "Es ist völlig in Ordnung, nicht in Ordnung zu sein. Und du darfst es besser werden.",
    "Du hast mehr Kraft in dir, als du je zeigen musstest.",
    "Jeder Tag, an dem du dich entscheidest weiterzumachen, ist ein Akt des Mutes.",
    "Deine Gefühle sind berechtigt. Alle miteinander.",
    "Du darfst sanft mit dir selbst sein. Das ist keine Schwäche.",
    "Um Hilfe zu bitten ist eine der mutigsten Dinge, die ein Mensch tun kann.",
    // — Körperbild —
    "Dein Körper ist kein Problem, das gelöst werden muss.",
    "Dein Körper verdient Fürsorge und Freundlichkeit, genau so wie er ist.",
    "Du darfst Platz einnehmen. Alles, was du brauchst.",
    "Dein Wert hat nichts mit deiner Größe oder deinem Aussehen zu tun.",
    "Dein Körper gehört dir. Er verdient Fürsorge und Freundlichkeit.",
    // — Einwanderung & Diaspora —
    "Zwischen zwei Welten zu sein bedeutet nicht, verloren zu sein. Es bedeutet, weit zu sein.",
    "Dein Akzent ist kein Fehler. Er ist der Beweis für jede Welt, die du in dir trägst.",
    "Du musst nicht zwischen deiner Herkunft und deinem jetzigen Ort wählen.",
    "Alles hinter sich zu lassen, um etwas Neues aufzubauen, erfordert außergewöhnlichen Mut.",
    // — Selbstwert & Mut —
    "Die Ablehnung einer Person ist kein Urteil über dein Leben.",
    "Deine Geschichte wird noch geschrieben. Das Beste liegt noch vor dir.",
    "Du bist jeden Tag für dich selbst erschienen. Das ist alles.",
    "Der Mut, den du still in dir trägst, ist außergewöhnlich.",
    "Sanft zu sein in einer grausamen Welt ist keine Naivität. Es ist Stärke.",
    "Du bist nicht zurück. Du bist auf deinem eigenen Weg.",
    "An jedem einzelnen Tag bist du wichtig.",
    "Kleine Schritte sind immer noch Schritte. Du bewegst dich vorwärts.",
    "Jemand ist still stolz auf alles, was du bisher geschafft hast.",
    "Du musst nicht perfekt sein, um geliebt zu werden.",
    "Ruhe ist kein Aufgeben. Es ist, wie man weitermacht.",
    "Ich hoffe, dein Tag hält mindestens eine schöne Sache für dich bereit.",
  ],
  it: [
    // — appartenenza & amore —
    "Qualcuno ti ama. Proprio adesso, in questo momento.",
    "Non ti conosco. Ti amo lo stesso.",
    "Appartieni già qui. Non devi guadagnartelo.",
    "Sei degno(a) di amore senza cambiare nulla.",
    "Non sei un peso. Non lo sei mai stato(a).",
    "Sei abbastanza, esattamente come sei. Adesso. Non una versione futura.",
    "Qualcuno dall'altra parte del mondo ha appena pensato a te con calore.",
    "Il mondo brilla un po' di più perché ci sei tu.",
    "Sei la persona preferita di qualcuno e non te l'ha ancora detto.",
    "Anche gli sconosciuti vogliono che tu stia bene.",
    "Non devi fingere felicità per meritare gentilezza.",
    "Sei amato(a) in modi che forse non conosci pienamente.",
    // — solitudine —
    "Non sei solo(a), anche quando sembra così.",
    "Sei qualcuno che vale la pena conoscere, amare, trovare.",
    "Da qualche parte nel mondo, qualcuno ti sta mandando calore in questo momento.",
    "La solitudine non è la verità su di te. È solo un sentimento che passa.",
    "Le persone giuste sono ancora in cammino verso di te.",
    "Anche nel silenzio, sei sorretto(a) da più amore di quanto riesci a vedere.",
    // — razzismo & discriminazione —
    "La tua pelle non è un problema. È storia, bellezza e forza.",
    "Il mondo ti ha detto che non appartieni qui. Il mondo aveva torto.",
    "La tua eredità non è un peso. È il tuo potere.",
    "Il colore della tua pelle non ha mai determinato il tuo valore. Neanche per un secondo.",
    "Il razzismo è una ferita che ti è stata inflitta. Non dice nulla di vero su chi sei.",
    "Non sei mai stato(a) il problema. Il pregiudizio lo era.",
    "La tua cultura non è inferiore. È antica, bella e tua.",
    "Hai sempre avuto il diritto di occupare il tuo spazio nel mondo.",
    "Sei esattamente chi sei destinato(a) ad essere.",
    "L'odio che gli altri portano è il loro fardello, non un verdetto su di te.",
    "Hai il diritto di esistere pienamente, senza scusarti.",
    "Nessun pregiudizio può cancellare la tua dignità.",
    // — bullismo & parole che feriscono —
    "Tutto ciò che è stato detto di bello su di te — quella è la verità.",
    "Quello che gli altri dicono di te non dice nulla di chi sei.",
    "Il tuo valore non è mai stato determinato da come gli altri ti hanno trattato(a).",
    "Non sei mai stato(a) il problema. La crudeltà era loro.",
    "Tutto ciò che hai attraversato ha plasmato qualcuno di straordinario.",
    "Quello che gli altri pensano di te è la loro storia, non la tua.",
    "Non sei ciò che ti hanno chiamato(a).",
    "Sei molto più di qualsiasi singolo momento della tua vita.",
    "Hai sempre meritato di essere trattato(a) con dolcezza e rispetto.",
    // — omofobia & LGBTQ+ —
    "Chi ami non è un errore.",
    "Sei intero(a), esattamente come sei.",
    "Amare chi ami è una delle cose più umane che esistano.",
    "La tua identità non è una fase, una scelta, né qualcosa da correggere. Sei tu.",
    "Meriti un amore che non viene con condizioni.",
    "La vergogna che ti hanno imposto non è mai stata tua.",
    "Ci sono persone in questo mondo che ti ameranno esattamente come sei. Esistono.",
    "Il tuo cuore sa chi è. Quella certezza è sacra.",
    "Non sei solo(a). Esiste un'intera comunità che ti vede.",
    // — salute mentale —
    "La tua mente merita tante cure quanto il tuo corpo.",
    "Ogni passo che fai, anche piccolo, è un progresso reale.",
    "Hai il diritto di non stare bene. E hai il diritto di migliorare.",
    "Hai dentro di te più forza di quanta tu abbia mai dovuto mostrare.",
    "Ogni giorno in cui scegli di andare avanti è un atto di coraggio.",
    "Le tue emozioni sono valide. Tutte quante.",
    "Puoi essere gentile con te stesso(a). Non è debolezza.",
    "Chiedere aiuto è una delle cose più coraggiose che una persona possa fare.",
    // — immagine corporea —
    "Il tuo corpo non è un problema da risolvere.",
    "Il tuo corpo merita gentilezza e cura, esattamente com'è oggi.",
    "Hai il diritto di occupare spazio. Tutto lo spazio di cui hai bisogno.",
    "Il tuo valore non ha nulla a che fare con la tua taglia o la tua forma.",
    "Il tuo corpo è tuo. Merita cura e gentilezza.",
    // — immigrazione & diaspora —
    "Essere tra due mondi non significa essere perduto(a). Significa essere vasto(a).",
    "Il tuo accento non è un difetto. È la prova di ogni mondo che porti dentro di te.",
    "Non devi scegliere tra da dove vieni e dove sei.",
    "Lasciare tutto per costruire qualcosa di nuovo richiede un coraggio straordinario.",
    // — autostima & coraggio —
    "Il rifiuto di una persona non è il verdetto sulla tua vita.",
    "La tua storia si sta ancora scrivendo. Il meglio deve ancora venire.",
    "Ti sei presentato(a) per te stesso(a) ogni giorno. Questo è tutto.",
    "Il coraggio che porti in silenzio è straordinario.",
    "Essere gentile in un mondo crudele non è ingenuità. È forza.",
    "Non sei indietro. Sei sul tuo percorso.",
    "Ogni singolo giorno, conti.",
    "I piccoli passi sono comunque passi. Stai ancora andando avanti.",
    "Qualcuno è in silenzio orgoglioso di quanto sei arrivato(a).",
    "Non devi essere perfetto(a) per essere amato(a).",
    "Riposarsi non è arrendersi. È il modo in cui si va avanti.",
    "Spero che oggi contenga almeno una cosa bella per te.",
  ],
  es: [
    // — pertenencia & amor —
    "Alguien te ama. Ahora mismo, en este momento.",
    "No te conozco. Te amo igual.",
    "Ya perteneces aquí. No tienes que ganártelo.",
    "Mereces ser amado(a) sin cambiar nada.",
    "No eres una carga. Nunca lo fuiste.",
    "Eres suficiente, exactamente como eres. Ahora. No una versión futura.",
    "Alguien al otro lado del mundo acaba de pensar en ti con cariño.",
    "El mundo brilla un poco más porque tú estás en él.",
    "Eres la persona favorita de alguien y todavía no te lo ha dicho.",
    "Incluso extraños quieren que estés bien.",
    "No tienes que fingir alegría para merecer bondad.",
    "Eres amado(a) de maneras que quizás no conoces del todo.",
    // — soledad —
    "No estás solo(a), aunque lo parezca.",
    "Eres alguien que vale la pena conocer, amar y encontrar.",
    "En algún lugar del mundo ahora mismo, alguien te está enviando calor.",
    "La soledad no es la verdad sobre ti. Es solo un sentimiento que pasa.",
    "Las personas indicadas todavía están en camino hacia ti.",
    "Incluso en el silencio, estás sostenido(a) por más amor del que puedes ver.",
    "Un día encontrarás a tus personas. También te están buscando.",
    // — racismo & discriminación —
    "Tu piel no es un problema. Es historia, belleza y fuerza.",
    "El mundo te dijo que no pertenecías aquí. El mundo estaba equivocado.",
    "Tu herencia no es una carga. Es tu poder.",
    "El color de tu piel nunca ha determinado tu valor. Ni un solo segundo.",
    "El racismo es una herida que te infligieron. No dice nada verdadero sobre quién eres.",
    "Nunca fuiste el problema. El prejuicio sí lo era.",
    "Tu cultura no es inferior. Es antigua, bella y tuya.",
    "Siempre has tenido el derecho de ocupar tu lugar en este mundo.",
    "Eres exactamente quien estás destinado(a) a ser.",
    "El odio que otros cargan es su carga, no un veredicto sobre ti.",
    "Tienes derecho a existir completamente, sin disculparte.",
    "Ningún prejuicio puede borrar tu dignidad.",
    // — acoso & palabras que hieren —
    "Todo lo amable que se ha dicho de ti — esa es la verdad.",
    "Lo que otros dicen de ti no dice nada sobre quién eres.",
    "Tu valor nunca fue determinado por cómo otros te trataron.",
    "Nunca fuiste el problema. La crueldad era de ellos.",
    "Todo lo que has vivido ha formado a alguien extraordinario.",
    "Lo que otros piensan de ti es su historia, no la tuya.",
    "No eres lo que te llamaron.",
    "Eres mucho más que cualquier momento de tu vida.",
    "Siempre has merecido ser tratado(a) con gentileza y respeto.",
    // — homofobia & LGBTQ+ —
    "A quien amas no es un error.",
    "Eres completo(a), exactamente como eres.",
    "Amar a quien amas es una de las cosas más humanas que existen.",
    "Tu identidad no es una fase, una elección, ni algo que arreglar. Eres tú.",
    "Mereces un amor que no viene con condiciones.",
    "La vergüenza que te impusieron nunca fue tuya.",
    "Hay personas en este mundo que te amarán exactamente como eres. Existen.",
    "Tu corazón sabe quién es. Esa certeza es sagrada.",
    "No estás solo(a). Existe toda una comunidad que te ve.",
    // — salud mental —
    "Tu mente merece tanto cuidado como tu cuerpo.",
    "Cada paso que das, por pequeño que sea, es un progreso real.",
    "Tienes derecho a no estar bien. Y tienes derecho a mejorar.",
    "Tienes dentro de ti más fuerza de la que has tenido que mostrar.",
    "Cada día que eliges seguir adelante es un acto de valentía.",
    "Tus sentimientos son válidos. Todos y cada uno de ellos.",
    "Puedes ser amable contigo mismo(a). Eso no es debilidad.",
    "Pedir ayuda es una de las cosas más valientes que puede hacer una persona.",
    // — imagen corporal —
    "Tu cuerpo no es un problema que resolver.",
    "Tu cuerpo merece amabilidad y cuidado, exactamente como es hoy.",
    "Tienes derecho a ocupar espacio. Todo el que necesites.",
    "Tu valor no tiene nada que ver con tu talla o tu forma.",
    "Tu cuerpo es tuyo. Merece cuidado y amabilidad.",
    // — inmigración & diáspora —
    "Estar entre dos mundos no significa estar perdido(a). Significa ser vasto(a).",
    "Tu acento no es un defecto. Es la prueba de cada mundo que llevas dentro.",
    "No tienes que elegir entre de dónde vienes y dónde estás.",
    "Dejarlo todo para construir algo nuevo requiere un valor extraordinario.",
    // — autoestima & valentía —
    "El rechazo de una persona no es el veredicto de tu vida.",
    "Tu historia todavía se está escribiendo. Lo mejor está por venir.",
    "Te has presentado para ti mismo(a) cada día. Eso es todo.",
    "El coraje que llevas en silencio es extraordinario.",
    "Ser amable en un mundo cruel no es ingenuidad. Es fortaleza.",
    "No estás atrasado(a). Estás en tu propio camino.",
    "Cada día, sin excepción, importas.",
    "Los pasos pequeños siguen siendo pasos. Sigues avanzando.",
    "Alguien está calladamente orgulloso(a) de lo lejos que has llegado.",
    "No tienes que ser perfecto(a) para ser amado(a).",
    "Descansar no es rendirse. Es cómo se sigue adelante.",
    "Espero que hoy contenga al menos una cosa hermosa para ti.",
  ],
  pt: [
    // — pertencimento & amor —
    "Alguém te ama. Agora mesmo, neste momento.",
    "Não te conheço. Te amo assim mesmo.",
    "Você já pertence aqui. Não precisa merecer.",
    "Você é digno(a) de amor sem mudar nada.",
    "Você não é um fardo. Nunca foi.",
    "Você é suficiente, exatamente como é. Agora. Não uma versão futura.",
    "Alguém do outro lado do mundo acabou de pensar em você com carinho.",
    "O mundo brilha um pouco mais porque você existe.",
    "Você é a pessoa favorita de alguém e ela ainda não te disse.",
    "Até estranhos querem que você esteja bem.",
    "Você não precisa fingir alegria para merecer bondade.",
    "Você é amado(a) de formas que talvez não conheça completamente.",
    // — solidão —
    "Você não está sozinho(a), mesmo quando parece assim.",
    "Você é alguém que vale a pena conhecer, amar e encontrar.",
    "Em algum lugar do mundo agora mesmo, alguém está te mandando calor.",
    "A solidão não é a verdade sobre você. É só um sentimento passageiro.",
    "As pessoas certas ainda estão a caminho de você.",
    "Mesmo no silêncio, você é sustentado(a) por mais amor do que consegue ver.",
    "Um dia você vai encontrar a sua tribo. Ela também está te procurando.",
    // — racismo & discriminação —
    "Sua pele não é um problema. É história, beleza e força.",
    "O mundo disse que você não pertencia aqui. O mundo estava errado.",
    "Sua herança não é um fardo. É o seu poder.",
    "A cor da sua pele nunca determinou seu valor. Nem por um segundo.",
    "O racismo é uma ferida que te infligiram. Ele não diz nada de verdadeiro sobre quem você é.",
    "Você nunca foi o problema. O preconceito era.",
    "Sua cultura não é inferior. É antiga, linda e sua.",
    "Você sempre teve o direito de ocupar seu espaço neste mundo.",
    "Você é exatamente quem deve ser.",
    "O ódio que os outros carregam é o fardo deles, não um veredicto sobre você.",
    "Você tem o direito de existir plenamente, sem se desculpar.",
    "Nenhum preconceito pode apagar sua dignidade.",
    // — bullying & palavras que ferem —
    "Tudo de gentil que já foi dito sobre você — essa é a verdade.",
    "O que os outros dizem sobre você não diz nada sobre quem você é.",
    "Seu valor nunca foi determinado por como os outros te trataram.",
    "Você nunca foi o problema. A crueldade era deles.",
    "Tudo o que você viveu moldou alguém extraordinário.",
    "O que os outros pensam de você é a história deles, não a sua.",
    "Você não é o que te chamaram.",
    "Você é muito mais do que qualquer momento da sua vida.",
    "Você sempre mereceu ser tratado(a) com gentileza e respeito.",
    // — homofobia & LGBTQ+ —
    "Quem você ama não é um erro.",
    "Você é inteiro(a), exatamente como é.",
    "Amar quem você ama é uma das coisas mais humanas que existem.",
    "Sua identidade não é uma fase, uma escolha, nem algo a corrigir. É você.",
    "Você merece amor que não vem com condições.",
    "A vergonha que te impuseram nunca foi sua.",
    "Há pessoas neste mundo que vão te amar exatamente como você é. Elas existem.",
    "Seu coração sabe quem é. Essa certeza é sagrada.",
    "Você não está sozinho(a). Existe toda uma comunidade que te vê.",
    // — saúde mental —
    "Sua mente merece tanto cuidado quanto seu corpo.",
    "Cada passo que você dá, por menor que seja, é um progresso real.",
    "Você tem o direito de não estar bem. E tem o direito de melhorar.",
    "Você tem dentro de si mais força do que já precisou mostrar.",
    "Cada dia que você escolhe continuar é um ato de coragem.",
    "Seus sentimentos são válidos. Todos eles.",
    "Você pode ser gentil(a) consigo mesmo(a). Isso não é fraqueza.",
    "Pedir ajuda é uma das coisas mais corajosas que uma pessoa pode fazer.",
    // — imagem corporal —
    "Seu corpo não é um problema a resolver.",
    "Seu corpo merece gentileza e cuidado, exatamente como ele é hoje.",
    "Você tem o direito de ocupar espaço. Todo o espaço que precisar.",
    "Seu valor não tem nada a ver com seu tamanho ou sua forma.",
    "Seu corpo é seu. Merece cuidado e gentileza.",
    // — imigração & diáspora —
    "Estar entre dois mundos não é estar perdido(a). É ser vasto(a).",
    "Seu sotaque não é um defeito. É a prova de cada mundo que você carrega dentro de si.",
    "Você não precisa escolher entre de onde vem e onde está.",
    "Deixar tudo para trás para construir algo novo exige uma coragem extraordinária.",
    // — autoestima & coragem —
    "A rejeição de uma pessoa não é o veredicto da sua vida.",
    "Sua história ainda está sendo escrita. O melhor ainda está por vir.",
    "Você se apresentou para si mesmo(a) todos os dias. Isso é tudo.",
    "A coragem que você carrega em silêncio é extraordinária.",
    "Ser gentil num mundo cruel não é ingenuidade. É força.",
    "Você não está atrasado(a). Está no seu próprio caminho.",
    "Todos os dias, você importa.",
    "Passos pequenos ainda são passos. Você ainda está avançando.",
    "Alguém está em silêncio orgulhoso(a) de até onde você chegou.",
    "Você não precisa ser perfeito(a) para ser amado(a).",
    "Descansar não é desistir. É como se continua.",
    "Espero que hoje tenha pelo menos uma coisa bonita para você.",
  ],
  ar: [
    // — الانتماء والحب —
    "شخص ما يحبك. الآن، في هذه اللحظة بالذات.",
    "لا أعرفك. أحبك على أي حال.",
    "أنت تنتمي هنا بالفعل. لا تحتاج إلى كسب ذلك.",
    "أنت تستحق الحب دون أن تغيّر شيئاً.",
    "لست عبئاً. لم تكن كذلك قط.",
    "أنت كافٍ تماماً كما أنت. الآن. ليس نسخة مستقبلية.",
    "شخص ما في الجانب الآخر من العالم فكّر فيك للتو بدفء.",
    "العالم يضيء أكثر قليلاً لأنك فيه.",
    "أنت الشخص المفضل لدى أحدهم ولم يخبرك بذلك بعد.",
    "حتى الغرباء يريدون أن تكون بخير.",
    "لا يجب أن تتظاهر بالسعادة لتستحق اللطف.",
    "أنت محبوب(ة) بطرق ربما لا تعرفها تماماً.",
    // — الوحدة —
    "لست وحدك، حتى عندما يبدو الأمر كذلك.",
    "أنت شخص يستحق أن يُعرف، أن يُحَب، أن يُجَد.",
    "في مكان ما في العالم، شخص يرسل لك الدفء الآن.",
    "الوحدة ليست الحقيقة عنك. إنها مجرد شعور عابر.",
    "الأشخاص المناسبون لا يزالون في طريقهم إليك.",
    "حتى في الصمت، أنت محمول(ة) بحب أكثر مما تستطيع رؤيته.",
    "يوماً ما ستجد أهلك. إنهم يبحثون عنك أيضاً.",
    // — العنصرية والتمييز —
    "بشرتك ليست مشكلة. إنها تاريخ وجمال وقوة.",
    "قال لك العالم إنك لا تنتمي هنا. كان العالم مخطئاً.",
    "إرثك ليس عبئاً. إنه قوتك.",
    "لون بشرتك لم يحدد قيمتك قط. ولا لثانية واحدة.",
    "العنصرية جرح أُلحق بك. لا تقول شيئاً حقيقياً عن هويتك.",
    "لم تكن أنت المشكلة قط. التحيز كان هو.",
    "ثقافتك ليست أدنى. إنها عريقة وجميلة وخاصة بك.",
    "لطالما كان لديك الحق في أن تأخذ مكانك في هذا العالم.",
    "أنت بالضبط من يجب أن تكون عليه.",
    "الكراهية التي يحملها الآخرون هي عبؤهم، وليست حكماً عليك.",
    "لديك الحق في الوجود الكامل، دون اعتذار.",
    "لا يمكن لأي تحيز أن يمحو كرامتك.",
    // — التنمر والكلمات المؤلمة —
    "كل ما قيل عنك بلطف ومحبة — ذلك هو الحقيقة.",
    "ما يقوله الآخرون عنك لا يقول شيئاً عن هويتك.",
    "قيمتك لم تتحدد قط بالطريقة التي عاملك بها الآخرون.",
    "لم تكن أنت المشكلة قط. القسوة كانت ملكهم.",
    "كل ما مررت به شكّل شخصاً استثنائياً.",
    "ما يفكر فيه الآخرون عنك هو قصتهم، وليست قصتك.",
    "لست ما نعتوك به.",
    "أنت أكثر بكثير من أي لحظة واحدة في حياتك.",
    "لطالما استحققت أن تُعامَل بلطف واحترام.",
    // — كره المثلية وحقوق مجتمع LGBTQ+ —
    "من تحب(ين) ليس خطأً.",
    "أنت مكتمل(ة) تماماً كما أنت.",
    "أن تحب(ي) من تحب(ين) هو من أكثر الأشياء إنسانية.",
    "هويتك ليست مرحلة ولا اختياراً ولا شيئاً يحتاج إصلاحاً. إنها أنت.",
    "تستحق(ين) حباً لا يأتي بشروط.",
    "الخزي الذي أُلقي عليك لم يكن لك يوماً.",
    "هناك أشخاص في هذا العالم سيحبونك بالضبط كما أنت. إنهم موجودون.",
    "قلبك يعرف من هو. هذا اليقين مقدس.",
    "لست وحدك(ِ). هناك مجتمع كامل يراك.",
    // — الصحة النفسية —
    "عقلك يستحق نفس القدر من الرعاية التي يستحقها جسدك.",
    "كل خطوة تخطوها، مهما كانت صغيرة، هي تقدم حقيقي.",
    "يحق لك أن لا تكون بخير. ويحق لك أن تتحسن.",
    "في داخلك قوة أكبر مما احتجت إلى إظهاره.",
    "كل يوم تختار فيه المضي قدماً هو فعل من أفعال الشجاعة.",
    "مشاعرك صحيحة. كلها دون استثناء.",
    "يمكنك أن تكون لطيفاً(ة) مع نفسك. هذا ليس ضعفاً.",
    "طلب المساعدة من أشجع ما يمكن لإنسان أن يفعله.",
    // — صورة الجسد —
    "جسدك ليس مشكلة تحتاج إلى حل.",
    "جسدك يستحق اللطف والعناية، تماماً كما هو اليوم.",
    "لك الحق في أخذ المساحة. كل المساحة التي تحتاجها.",
    "قيمتك لا علاقة لها بحجمك أو مظهرك.",
    "جسدك لك. يستحق العناية واللطف.",
    // — الهجرة والشتات —
    "أن تكون بين عالمين لا يعني أنك ضائع(ة). يعني أنك واسع(ة).",
    "لكنتك ليست عيباً. إنها دليل على كل عالم تحمله بداخلك.",
    "لا يجب أن تختار بين من أين أتيت وأين أنت الآن.",
    "أن تترك كل شيء لتبني شيئاً جديداً يتطلب شجاعة استثنائية.",
    // — احترام الذات والشجاعة —
    "رفض شخص واحد ليس حكماً على حياتك.",
    "قصتك لا تزال تُكتب. الأفضل لا يزال قادماً.",
    "لقد حضرت لنفسك كل يوم. هذا كل شيء.",
    "الشجاعة التي تحملها بهدوء استثنائية.",
    "أن تكون لطيفاً(ة) في عالم قاسٍ ليس سذاجة. إنه قوة.",
    "لست متأخراً(ة). أنت على مسارك الخاص.",
    "كل يوم، دون استثناء، أنت مهم(ة).",
    "الخطوات الصغيرة لا تزال خطوات. لا تزال تتقدم.",
    "شخص ما فخور(ة) بهدوء بمدى ما وصلت إليه.",
    "لا يجب أن تكون مثالياً(ة) لتُحَب.",
    "الراحة ليست استسلاماً. إنها الطريقة التي تستمر بها.",
    "أتمنى أن يحتوي يومك على شيء جميل واحد على الأقل.",
  ],
};
const LANGS = [
  {code:"en",label:"EN",name:"English"},
  {code:"fr",label:"FR",name:"Français"},
  {code:"de",label:"DE",name:"Deutsch"},
  {code:"it",label:"IT",name:"Italiano"},
  {code:"es",label:"ES",name:"Español"},
  {code:"pt",label:"PT",name:"Português"},
  {code:"ar",label:"عر",name:"العربية"},
];

const UI = {
  en:{ tagline:"here, you will only find love.", enter:"enter",
       door:"tonight you are here to...",
       receive:"Receive love", receiveDesc:"the world will send you something",
       give:"Give love", giveDesc:"to someone you'll never meet",
       step1:"where are you writing from?", step1ph:"choose your country...",
       step2:"choose what you want to send",
       send:"send this love", back:"← back",
       incoming:"the world is sending you love.",
       sentTitle:"your love is gone.",
       sentLine1:"they will never know it was you.",
       sentLine2:"that's what makes it real.",
       from:"from", again:"give again", receiveBtn:"receive",
       giveback:"give back →",
       footer:"no hate is possible here",
       crisis:"if you need support · 988 (US) · 116 123 (UK) · 3114 (FR)",
       total:"acts of love", goal:"goal: one for every human on Earth",
  },
  fr:{ tagline:"ici, tu ne trouveras que de l'amour.", enter:"entrer",
       door:"ce soir tu es ici pour...",
       receive:"Recevoir de l'amour", receiveDesc:"le monde va t'envoyer quelque chose",
       give:"Donner de l'amour", giveDesc:"à quelqu'un que tu ne connaîtras jamais",
       step1:"depuis quel pays tu écris ?", step1ph:"choisis ton pays...",
       step2:"choisis ce que tu veux envoyer",
       send:"envoyer cet amour", back:"← retour",
       incoming:"le monde t'envoie de l'amour.",
       sentTitle:"ton amour est parti.",
       sentLine1:"ils ne sauront jamais que c'est toi.",
       sentLine2:"c'est pour ça que c'est réel.",
       from:"depuis", again:"donner encore", receiveBtn:"recevoir",
       giveback:"donner à mon tour →",
       footer:"aucune haine n'est possible ici",
       crisis:"si tu traverses quelque chose · 3114 (France)",
       total:"actes d'amour", goal:"objectif : un pour chaque humain sur Terre",
  },
  de:{ tagline:"hier findest du nur Liebe.", enter:"eintreten",
       door:"heute Nacht bist du hier um...",
       receive:"Liebe empfangen", receiveDesc:"die Welt wird dir etwas schicken",
       give:"Liebe geben", giveDesc:"an jemanden den du nie kennenlernen wirst",
       step1:"aus welchem Land schreibst du?", step1ph:"Land auswählen...",
       step2:"wähle was du senden möchtest",
       send:"diese Liebe senden", back:"← zurück",
       incoming:"die Welt schickt dir Liebe.",
       sentTitle:"deine Liebe ist gegangen.",
       sentLine1:"sie werden nie wissen dass du es warst.",
       sentLine2:"genau das macht es real.",
       from:"aus", again:"nochmal geben", receiveBtn:"empfangen",
       giveback:"zurückgeben →",
       footer:"kein Hass ist hier möglich",
       crisis:"wenn du Hilfe brauchst · 0800 111 0 111 (DE)",
       total:"Liebesakte", goal:"Ziel: einer für jeden Menschen auf der Erde",
  },
  it:{ tagline:"qui troverai solo amore.", enter:"entra",
       door:"stanotte sei qui per...",
       receive:"Ricevere amore", receiveDesc:"il mondo ti manderà qualcosa",
       give:"Dare amore", giveDesc:"a qualcuno che non incontrerai mai",
       step1:"da quale paese stai scrivendo?", step1ph:"scegli il tuo paese...",
       step2:"scegli cosa vuoi inviare",
       send:"invia questo amore", back:"← indietro",
       incoming:"il mondo ti sta inviando amore.",
       sentTitle:"il tuo amore è partito.",
       sentLine1:"non sapranno mai che sei stato tu.",
       sentLine2:"è per questo che è reale.",
       from:"da", again:"dare ancora", receiveBtn:"ricevere",
       giveback:"dare a mia volta →",
       footer:"nessun odio è possibile qui",
       crisis:"se hai bisogno di aiuto · 800 274 274 (IT)",
       total:"atti d'amore", goal:"obiettivo: uno per ogni essere umano sulla Terra",
  },
  es:{ tagline:"aquí solo encontrarás amor.", enter:"entrar",
       door:"esta noche estás aquí para...",
       receive:"Recibir amor", receiveDesc:"el mundo te enviará algo",
       give:"Dar amor", giveDesc:"a alguien que nunca conocerás",
       step1:"¿desde qué país escribes?", step1ph:"elige tu país...",
       step2:"elige lo que quieres enviar",
       send:"enviar este amor", back:"← volver",
       incoming:"el mundo te está enviando amor.",
       sentTitle:"tu amor se fue.",
       sentLine1:"nunca sabrán que fuiste tú.",
       sentLine2:"eso es lo que lo hace real.",
       from:"desde", again:"dar de nuevo", receiveBtn:"recibir",
       giveback:"dar a mi vez →",
       footer:"ningún odio es posible aquí",
       crisis:"si necesitas apoyo · 024 (ES)",
       total:"actos de amor", goal:"objetivo: uno por cada ser humano en la Tierra",
  },
  pt:{ tagline:"aqui você só encontrará amor.", enter:"entrar",
       door:"esta noite você está aqui para...",
       receive:"Receber amor", receiveDesc:"o mundo vai te enviar algo",
       give:"Dar amor", giveDesc:"para alguém que você nunca conhecerá",
       step1:"de qual país você está escrevendo?", step1ph:"escolha seu país...",
       step2:"escolha o que quer enviar",
       send:"enviar este amor", back:"← voltar",
       incoming:"o mundo está te enviando amor.",
       sentTitle:"seu amor foi embora.",
       sentLine1:"eles nunca saberão que foi você.",
       sentLine2:"é por isso que é real.",
       from:"de", again:"dar novamente", receiveBtn:"receber",
       giveback:"dar de volta →",
       footer:"nenhum ódio é possível aqui",
       crisis:"se precisar de apoio · CVV 188 (BR)",
       total:"atos de amor", goal:"objetivo: um para cada ser humano na Terra",
  },
  ar:{ tagline:"هنا ستجد الحب فقط.", enter:"ادخل",
       door:"الليلة أنت هنا من أجل...",
       receive:"تلقي الحب", receiveDesc:"العالم سيرسل لك شيئاً",
       give:"إعطاء الحب", giveDesc:"لشخص لن تلتقي به أبداً",
       step1:"من أي بلد تكتب؟", step1ph:"اختر بلدك...",
       step2:"اختر ما تريد إرساله",
       send:"أرسل هذا الحب", back:"رجوع ←",
       incoming:"العالم يرسل إليك الحب.",
       sentTitle:"حبك انطلق.",
       sentLine1:"لن يعرفوا أبداً أنك أنت.",
       sentLine2:"هذا ما يجعله حقيقياً.",
       from:"من", again:"إعطاء مجدداً", receiveBtn:"تلقي",
       giveback:"إعطاء بدوري ←",
       footer:"لا يمكن لأي كراهية أن تكون هنا",
       crisis:"إذا كنت بحاجة للمساعدة · خط الدعم النفسي",
       total:"أفعال حب", goal:"الهدف: واحد لكل إنسان على الأرض",
  },
};

// 200 static stars
const STARS = Array.from({length:200},(_,i)=>({
  id:i, x:Math.random()*100, y:Math.random()*100,
  s:Math.random()*1.7+0.3, d:Math.random()*5+2,
  del:Math.random()*7, b:Math.random()*0.5+0.12,
}));

const RECEIVE_STARS = Array.from({length:60},(_,i)=>({
  id:i,
  x:Math.random()*96+2, y:Math.random()*90+2,
  s:Math.random()*3+1.5,
  delay: i * 55,
}));

const rand = a => a[Math.floor(Math.random()*a.length)];

const COUNTER_START = 341892;
const COUNTER_GOAL  = 8000000000;

export default function StillHere() {
  const [screen, setScreen]           = useState("landing");
  const [giveStep, setGiveStep]       = useState(1);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryChosen, setCountryChosen] = useState("");
  const [showDrop, setShowDrop]       = useState(false);
  const [chosenMsg, setChosenMsg]     = useState(null);
  const [lang, setLang]               = useState("en");
  const [msgIdx, setMsgIdx]           = useState(0);
  const [inMsgs, setInMsgs]           = useState([]);
  const [counter, setCounter]         = useState(COUNTER_START);
  const [showLang, setShowLang]       = useState(false);
  const [soundOn, setSoundOn]         = useState(false);
  const [hb1, setHb1]                 = useState(false);
  const [hb2, setHb2]                 = useState(false);
  const [sentCountry, setSentCountry] = useState("");
  const [sentMsg, setSentMsg]         = useState("");
  const [receiveStars, setReceiveStars] = useState([]);
  const [shootingStar, setShootingStar] = useState(null);
  const [legalModal, setLegalModal]     = useState(null);
  const soundRef = useRef(null);
  const inId     = useRef(0);
  const dropRef  = useRef(null);
  const soundTimer = useRef(null);

  const msgs   = GIVE_MSGS[lang] || GIVE_MSGS.en;
  const ui     = UI[lang]        || UI.en;
  const isRTL  = lang === "ar";
  const landingMsgs = GIVE_MSGS.en;

  const filtered = countrySearch.length < 1
    ? COUNTRIES.slice(0, 50)
    : COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).slice(0, 40);

  useEffect(() => {
    const iv = setInterval(() => setMsgIdx(n => (n+1) % landingMsgs.length), 3600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setCounter(n => {
        const increment = Math.floor(Math.random() * 3) + 1;
        return Math.min(n + increment, COUNTER_GOAL);
      });
    }, 400 + Math.random() * 400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const beat = () => {
      setHb1(true); setTimeout(() => setHb1(false), 120);
      setTimeout(() => { setHb2(true); setTimeout(() => setHb2(false), 120); }, 280);
    };
    beat();
    const iv = setInterval(beat, 1400);
    return () => clearInterval(iv);
  }, []);

  const initSound = useCallback(() => {
    if (!soundRef.current) {
      soundRef.current = startAmbience();
      if (soundRef.current) setSoundOn(true);
    }
  }, []);

  // Sound loop — warm organic sounds only: hum, laugh, baby coo
  const startSoundLoop = useCallback(() => {
    const ctx = soundRef.current?.ctx || null;
    const next = () => {
      const type = pickSoundEvent();
      if (type === "giggle") {
        playChildGiggle(ctx);
        soundTimer.current = setTimeout(next, 1800 + Math.random() * 1800);
      } else if (type === "doremi") {
        playDoReMi(ctx);
        soundTimer.current = setTimeout(next, 3500 + Math.random() * 2000);
      } else if (type === "laugh") {
        playWarmLaugh(ctx);
        soundTimer.current = setTimeout(next, 2500 + Math.random() * 2000);
      } else if (type === "baby") {
        playBabyCoo(ctx);
        soundTimer.current = setTimeout(next, 1800 + Math.random() * 1800);
      } else if (type === "bell") {
        playJoyBell(ctx);
        soundTimer.current = setTimeout(next, 3000 + Math.random() * 2000);
      } else {
        playHappyMelody(ctx);
        soundTimer.current = setTimeout(next, 3500 + Math.random() * 2500);
      }
    };
    soundTimer.current = setTimeout(next, 800);
  }, []);

  const stopSoundLoop = useCallback(() => {
    clearTimeout(soundTimer.current);
  }, []);

  useEffect(() => {
    if (screen !== "receive") { stopSoundLoop(); return; }
    if (soundRef.current) soundRef.current.chimeReceive();
    startSoundLoop();

    // ── Two pools: curated messages + real messages sent by users ──
    const curated = RECEIVE_STREAMS[lang] || RECEIVE_STREAMS.en;
    let queue = [];
    let realPool = []; // filled from shared storage

    // Load real messages sent by other users from Supabase
    const loadRealMessages = async () => {
      try {
        realPool = await loadMessages(lang);
      } catch(e) { realPool = []; }
    };
    loadRealMessages();

    const getNext = () => {
      // 30% chance: show a real user message if available
      if (realPool.length > 0 && Math.random() < 0.30) {
        const item = realPool[Math.floor(Math.random() * realPool.length)];
        return { text: item.text, from: item.country || item.from, real: true };
      }
      // Otherwise curated shuffle queue
      if (queue.length === 0) {
        queue = [...curated].sort(() => Math.random() - 0.5);
      }
      return { ...queue.pop(), real: false };
    };

    const shoot = () => {
      const id   = ++inId.current;
      const item = getNext();
      if (soundRef.current?.ctx) playPhoneNotif(soundRef.current.ctx);
      setInMsgs(p => [...p.slice(-5), {
        id, text: item.text, from: item.from, real: item.real,
      }]);
      // Laisser le temps de lire — 18 secondes
      setTimeout(() => setInMsgs(p => p.filter(x => x.id !== id)), 18000);
    };

    // Rythme lent, respirant — chaque message doit atterrir
    shoot();
    setTimeout(shoot, 7000);
    setTimeout(shoot, 14000);
    const iv = setInterval(shoot, 8000);

    // Refresh real messages pool every 30s
    const poolRefresh = setInterval(loadRealMessages, 30000);

    return () => { clearInterval(iv); clearInterval(poolRefresh); stopSoundLoop(); };
  }, [screen, lang]);

  useEffect(() => {
    if (screen !== "receive") { setReceiveStars([]); return; }
    setReceiveStars([]);
    RECEIVE_STARS.forEach(s => {
      setTimeout(() => {
        setReceiveStars(p => [...p, s.id]);
      }, s.delay);
    });
  }, [screen]);

  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Inject Google Fonts link tag
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Playfair+Display:ital,wght@0,300;0,400;1,300;1,400&family=Courier+Prime&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch(e) {} };
  }, []);

  const formatCounter = (n) => {
    if (n >= 1000000000) return (n/1000000000).toFixed(2) + "B";
    if (n >= 1000000)     return (n/1000000).toFixed(1) + "M";
    return n.toLocaleString();
  };

  const progressPct = Math.min((counter / COUNTER_GOAL) * 100, 100);

  const handleEnter = () => { initSound(); setScreen("door"); };

  const selectCountry = c => {
    setCountryChosen(c); setCountrySearch(c); setShowDrop(false);
  };

  const handleNext = () => { if (countryChosen) { setGiveStep(2); setChosenMsg(null); } };

  const triggerShootingStar = () => {
    const id = Date.now();
    const startX = Math.random() * 40;
    const startY = Math.random() * 40;
    setShootingStar({ id, startX, startY });
    setTimeout(() => setShootingStar(null), 2000);
  };

  const handleSend = async () => {
    if (!chosenMsg || !countryChosen) return;
    if (soundRef.current) soundRef.current.chimeSend();
    triggerShootingStar();
    setSentCountry(countryChosen); setSentMsg(chosenMsg);
    setCounter(n => n + 1); setScreen("sent");
    // Save to Supabase so other users can receive this real message
    const msgText = chosenMsg;
    const msgCountry = countryChosen;
    const msgLang = lang;
    setCountrySearch(""); setCountryChosen(""); setChosenMsg(null); setGiveStep(1);
    try {
      await fetch(`${SUPA_URL}/rest/v1/messages`, {
        method: "POST",
        headers: {
          "apikey": SUPA_KEY,
          "Authorization": `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ text: msgText, country: msgCountry, lang: msgLang }),
      });
    } catch(e) { console.error("Supabase save error:", e); }
  };

  const goGive    = () => { setGiveStep(1); setCountrySearch(""); setCountryChosen(""); setChosenMsg(null); setScreen("give"); };
  const goReceive = () => setScreen("receive");
  const goDoor    = () => setScreen("door");

  return (
    <div dir={isRTL?"rtl":"ltr"} onClick={()=>setShowLang(false)} style={{
      minHeight:"100vh",
      background:"linear-gradient(180deg,#050210 0%,#080414 55%,#050210 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      position:"relative",overflow:"hidden",
    }}>
      <style>{`
        *{box-sizing:border-box;}
        @keyframes twinkle{0%,100%{opacity:var(--b);}50%{opacity:calc(var(--b)*2.2);transform:scale(1.4);}}
        @keyframes star-light{0%{opacity:0;transform:scale(0);}40%{opacity:1;transform:scale(2.2);box-shadow:0 0 8px 4px rgba(255,230,150,0.7);}100%{opacity:0.9;transform:scale(1);box-shadow:0 0 5px 2px rgba(255,220,130,0.4);}}
        @keyframes shooting{
          0%{opacity:0;transform:translate(0,0) rotate(35deg) scaleX(0);}
          5%{opacity:1;transform:translate(0,0) rotate(35deg) scaleX(1);}
          95%{opacity:0.7;transform:translate(70vw,40vh) rotate(35deg) scaleX(1);}
          100%{opacity:0;transform:translate(72vw,41vh) rotate(35deg) scaleX(0);}
        }
        @keyframes rise{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes cycle{0%,5%{opacity:0;transform:translateY(8px);}15%,80%{opacity:1;transform:translateY(0);}92%,100%{opacity:0;transform:translateY(-6px);}}
        @keyframes love-in{0%{opacity:0;transform:translateY(12px);}12%{opacity:1;transform:translateY(0);}80%{opacity:1;}100%{opacity:0;transform:translateY(-6px);}}
        @keyframes bloom{0%{opacity:0;transform:scale(0.6);}60%{transform:scale(1.06);}100%{opacity:1;transform:scale(1);}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:0.65;}50%{transform:scale(1.65);opacity:1;}}
        @keyframes act-in{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
        @keyframes soft-border{0%,100%{box-shadow:0 0 0 1px rgba(255,200,120,0.1);}50%{box-shadow:0 0 0 1px rgba(255,200,120,0.22),0 0 22px rgba(255,200,120,0.06);}}
        @keyframes drop-in{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes counter-up{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
        @keyframes tagline-breathe{0%,100%{opacity:0.55;}50%{opacity:0.75;}}

        .door-btn{cursor:pointer;transition:all 0.3s ease;border:none;}
        .door-btn:hover{transform:translateY(-3px) scale(1.02)!important;}
        .door-btn:active{transform:scale(0.97)!important;}
        .back-btn{cursor:pointer;background:none;border:none;transition:opacity 0.2s;}
        .back-btn:hover{opacity:0.6;}
        .msg-btn{cursor:pointer;transition:all 0.15s ease;border:none;}
        .msg-btn:hover{transform:translateY(-1px);}
        .country-item{cursor:pointer;transition:background 0.12s;}
        .country-item:hover{background:rgba(255,200,120,0.12)!important;}
        .lang-item{cursor:pointer;transition:background 0.12s;}
        .lang-item:hover{background:rgba(255,200,120,0.1)!important;}
        input:focus{outline:none;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,200,120,0.18);border-radius:2px;}
      `}</style>

      {/* STATIC STARS */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}>
        {STARS.map(s=>(
          <div key={s.id} style={{
            position:"absolute",left:`${s.x}%`,top:`${s.y}%`,
            width:`${s.s}px`,height:`${s.s}px`,
            borderRadius:"50%",background:"#fffaf0","--b":s.b,
            animation:`twinkle ${s.d}s ease-in-out ${s.del}s infinite`,
          }}/>
        ))}

        {screen==="receive" && RECEIVE_STARS.map(s=>(
          receiveStars.includes(s.id) && (
            <div key={`rx-${s.id}`} style={{
              position:"absolute",
              left:`${s.x}%`,top:`${s.y}%`,
              width:`${s.s}px`,height:`${s.s}px`,
              borderRadius:"50%",
              background:"radial-gradient(circle,rgba(255,248,224,0.5),rgba(255,208,128,0.3))",
              animation:`star-light 1.2s ease forwards`,
              zIndex:2,
              opacity:0.4,
            }}/>
          )
        ))}

        {shootingStar && (
          <div style={{
            position:"fixed",
            left:`${shootingStar.startX}%`,
            top:`${shootingStar.startY}%`,
            width:"120px",height:"2px",
            background:"linear-gradient(90deg, rgba(255,230,150,0) 0%, rgba(255,230,150,0.9) 50%, #fff8e0 100%)",
            borderRadius:"2px",
            zIndex:20,pointerEvents:"none",
            boxShadow:"0 0 6px 2px rgba(255,220,130,0.4)",
            animation:"shooting 1.8s ease-out forwards",
            transformOrigin:"left center",
          }}/>
        )}

        <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:"600px",height:"380px",background:"radial-gradient(ellipse,rgba(140,100,255,0.035) 0%,rgba(255,160,80,0.018) 50%,transparent 70%)",borderRadius:"50%"}}/>
      </div>

      {/* Vignette */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,background:"radial-gradient(ellipse 78% 72% at 50% 48%,transparent 12%,rgba(5,2,16,0.96) 100%)"}}/>

      {/* HEADER */}
      <div style={{position:"fixed",top:0,left:0,right:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 22px",zIndex:30,opacity:0,animation:"rise 2s ease 0.4s forwards"}}>
        <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"3px"}}>
            <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"#dca070",transform:hb1?"scale(1.6)":"scale(1)",boxShadow:hb1?"0 0 8px 3px rgba(220,160,80,0.5)":"none",transition:"all 0.1s ease"}}/>
            <div style={{width:"4px",height:"4px",borderRadius:"50%",background:"#dca070",opacity:0.6,transform:hb2?"scale(1.4)":"scale(1)",transition:"all 0.1s ease"}}/>
          </div>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"13px",color:"rgba(255,200,120,0.28)",letterSpacing:"0.1em"}}>still here</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <button onClick={e=>{e.stopPropagation();if(!soundRef.current){initSound();}else{soundRef.current.ctx.state==="suspended"?soundRef.current.ctx.resume():soundRef.current.ctx.suspend();setSoundOn(v=>!v);}}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Courier Prime',monospace",fontSize:"14px",color:soundOn?"rgba(255,200,120,0.45)":"rgba(255,200,120,0.18)",transition:"color 0.2s"}}>
            {soundOn?"♪":"♩"}
          </button>
          <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowLang(v=>!v)} style={{background:"rgba(255,200,120,0.05)",border:"1px solid rgba(255,200,120,0.1)",borderRadius:"14px",padding:"4px 11px",fontFamily:"'Courier Prime',monospace",fontSize:"10px",letterSpacing:"0.06em",color:"rgba(255,200,120,0.3)",cursor:"pointer",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(255,200,120,0.25)";e.currentTarget.style.color="rgba(255,200,120,0.6)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,200,120,0.1)";e.currentTarget.style.color="rgba(255,200,120,0.3)";}}>
              {LANGS.find(l=>l.code===lang)?.label} ▾
            </button>
            {showLang&&(
              <div style={{position:"absolute",right:0,top:"110%",background:"rgba(8,4,18,0.98)",border:"1px solid rgba(255,200,120,0.1)",borderRadius:"12px",overflow:"hidden",zIndex:50,minWidth:"135px",boxShadow:"0 8px 32px rgba(0,0,0,0.8)",animation:"bloom 0.2s ease forwards"}}>
                {LANGS.map(l=>(
                  <div key={l.code} className="lang-item" onClick={()=>{setLang(l.code);setShowLang(false);}} style={{padding:"10px 15px",fontFamily:"'Cormorant Garamond',serif",fontSize:"15px",color:l.code===lang?"rgba(255,205,120,0.95)":"rgba(255,200,120,0.5)",background:l.code===lang?"rgba(255,200,120,0.07)":"transparent",borderBottom:"1px solid rgba(255,200,120,0.04)"}}>
                    {l.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{position:"relative",zIndex:10,width:"100%",maxWidth:"468px",padding:"0 22px",display:"flex",flexDirection:"column",alignItems:"center"}}>

        {/* LANDING */}
        {screen==="landing"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"40px",textAlign:"center",opacity:0,animation:"rise 2s ease 0.8s forwards"}}>
            <div style={{minHeight:"68px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <p key={msgIdx} style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:300,fontSize:"clamp(22px,4.5vw,40px)",color:"rgba(255,238,205,0.9)",lineHeight:1.25,letterSpacing:"-0.01em",margin:0,textShadow:"0 0 60px rgba(255,200,100,0.1)",animation:"cycle 3.6s ease-in-out infinite"}}>
                {landingMsgs[msgIdx]}
              </p>
            </div>

            <button onClick={handleEnter} className="door-btn" style={{background:"rgba(255,200,100,0.06)",border:"1px solid rgba(255,200,100,0.18)",borderRadius:"60px",padding:"16px 50px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"18px",color:"rgba(255,215,145,0.75)",animation:"soft-border 4s ease-in-out infinite"}}>
              {ui.enter}
            </button>

            {/* COUNTER */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px",width:"100%",maxWidth:"320px"}}>
              <div style={{animation:"counter-up 0.3s ease"}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"clamp(22px,4vw,32px)",color:"rgba(255,215,145,0.7)",letterSpacing:"0.02em"}}>
                  {formatCounter(counter)}
                </span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,200,120,0.3)",marginLeft:"8px"}}>
                  {ui.total}
                </span>
              </div>

              {/* Progress bar toward 8B */}
              <div style={{width:"100%",height:"1px",background:"rgba(255,200,120,0.1)",borderRadius:"1px",overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,rgba(255,200,120,0.3),rgba(255,215,145,0.6))",width:`${progressPct}%`,transition:"width 0.5s ease",borderRadius:"1px"}}/>
              </div>
              <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"11px",color:"rgba(255,215,145,0.2)"}}>
                {ui.goal}
              </span>

              {/* Tagline. same font as "keep going", more visible */}
              <p style={{
                fontFamily:"'Playfair Display',serif",
                fontStyle:"italic",
                fontWeight:300,
                fontSize:"clamp(15px,2.8vw,20px)",
                color:"rgba(255,225,170,0.62)",
                margin:"8px 0 0 0",
                letterSpacing:"0.01em",
                lineHeight:1.4,
                animation:"tagline-breathe 5s ease-in-out infinite",
                textShadow:"0 0 30px rgba(255,200,100,0.08)",
              }}>
                {ui.tagline}
              </p>
            </div>
          </div>
        )}

        {/* DOOR */}
        {screen==="door"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"26px",width:"100%",opacity:0,animation:"rise 0.8s ease forwards"}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,215,150,0.28)",margin:0,animation:"cycle 3.6s ease-in-out infinite"}}>{landingMsgs[msgIdx]}</p>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"16px",color:"rgba(255,215,150,0.26)",margin:0}}>{ui.door}</p>
            <div style={{display:"flex",flexDirection:"column",gap:"11px",width:"100%"}}>
              <button className="door-btn" onClick={goReceive} style={{background:"linear-gradient(135deg,rgba(155,115,255,0.09),rgba(90,60,200,0.04))",border:"1px solid rgba(165,125,255,0.18)",borderRadius:"20px",padding:"26px 24px",display:"flex",alignItems:"center",gap:"18px",textAlign:"left",width:"100%"}}>
                <div style={{width:"48px",height:"48px",flexShrink:0,borderRadius:"50%",background:"rgba(165,125,255,0.1)",border:"1px solid rgba(165,125,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",color:"#a890ff",animation:"pulse 4.5s ease-in-out infinite"}}>✦</div>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"19px",color:"rgba(205,185,255,0.9)",fontWeight:300,marginBottom:"3px"}}>{ui.receive}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"12px",color:"rgba(175,150,230,0.4)"}}>{ui.receiveDesc}</div>
                </div>
              </button>
              <button className="door-btn" onClick={goGive} style={{background:"linear-gradient(135deg,rgba(255,175,75,0.09),rgba(215,125,55,0.04))",border:"1px solid rgba(255,185,95,0.18)",borderRadius:"20px",padding:"26px 24px",display:"flex",alignItems:"center",gap:"18px",textAlign:"left",width:"100%"}}>
                <div style={{width:"48px",height:"48px",flexShrink:0,borderRadius:"50%",background:"rgba(255,175,75,0.1)",border:"1px solid rgba(255,185,95,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",color:"#ffb84a",animation:"pulse 3.8s ease-in-out 0.5s infinite"}}>♡</div>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"19px",color:"rgba(255,210,135,0.9)",fontWeight:300,marginBottom:"3px"}}>{ui.give}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"12px",color:"rgba(220,170,95,0.4)"}}>{ui.giveDesc}</div>
                </div>
              </button>
            </div>
            <p style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",letterSpacing:"0.16em",color:"rgba(255,200,120,0.1)",textTransform:"uppercase",textAlign:"center",margin:0}}>{ui.footer}</p>
          </div>
        )}

        {/* GIVE — STEP 1 */}
        {screen==="give"&&giveStep===1&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"26px",width:"100%",opacity:0,animation:"rise 0.7s ease forwards"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"clamp(16px,3vw,21px)",color:"rgba(255,238,205,0.75)",margin:0,textAlign:"center"}}>{ui.step1}</p>
            <div ref={dropRef} style={{position:"relative",width:"100%"}}>
              <input value={countrySearch} onChange={e=>{setCountrySearch(e.target.value);setCountryChosen("");setShowDrop(true);}} onFocus={()=>setShowDrop(true)} placeholder={ui.step1ph}
                style={{width:"100%",background:"rgba(255,200,120,0.05)",border:`1px solid ${countryChosen?"rgba(255,200,120,0.35)":"rgba(255,200,120,0.18)"}`,borderRadius:"14px",padding:"15px 42px 15px 18px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"17px",color:"rgba(255,235,195,0.85)",caretColor:"#ffb84a",transition:"border 0.2s"}}
                onBlur={e=>e.target.style.borderColor=countryChosen?"rgba(255,200,120,0.35)":"rgba(255,200,120,0.18)"}/>
              {countryChosen&&<div style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",color:"rgba(255,200,120,0.6)",fontSize:"16px"}}>✓</div>}
              {showDrop&&filtered.length>0&&(
                <div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,zIndex:50,background:"rgba(10,5,22,0.98)",border:"1px solid rgba(255,200,120,0.12)",borderRadius:"12px",overflow:"hidden",maxHeight:"220px",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.85)",animation:"drop-in 0.18s ease forwards"}}>
                  {filtered.map(c=>(
                    <div key={c} className="country-item" onMouseDown={e=>{e.preventDefault();selectCountry(c);}} style={{padding:"10px 15px",fontFamily:"'Cormorant Garamond',serif",fontSize:"15px",color:countryChosen===c?"rgba(255,210,130,0.95)":"rgba(255,220,170,0.62)",background:countryChosen===c?"rgba(255,200,120,0.1)":"transparent",borderBottom:"1px solid rgba(255,200,120,0.04)"}}>
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleNext} disabled={!countryChosen} className="door-btn" style={{background:countryChosen?"rgba(255,200,120,0.09)":"rgba(255,200,120,0.03)",border:`1px solid ${countryChosen?"rgba(255,200,120,0.25)":"rgba(255,200,120,0.07)"}`,borderRadius:"50px",padding:"14px 52px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"17px",color:countryChosen?"rgba(255,215,145,0.82)":"rgba(255,200,120,0.2)",cursor:countryChosen?"pointer":"default",animation:countryChosen?"soft-border 4s ease-in-out infinite":"none",transition:"all 0.3s ease"}}>→</button>
            <button className="back-btn" onClick={goDoor} style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,200,120,0.2)"}}>{ui.back}</button>
          </div>
        )}

        {/* GIVE — STEP 2 */}
        {screen==="give"&&giveStep===2&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"18px",width:"100%",opacity:0,animation:"rise 0.7s ease forwards"}}>
            <div style={{textAlign:"center"}}>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,215,150,0.35)",margin:"0 0 3px 0"}}>{ui.step2}</p>
              <p style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",letterSpacing:"0.09em",color:"rgba(255,200,120,0.22)",margin:0}}>{countryChosen}</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px",width:"100%",maxHeight:"375px",overflowY:"auto"}}>
              {msgs.map((m,i)=>(
                <button key={i} className="msg-btn" onClick={()=>setChosenMsg(m)} style={{background:chosenMsg===m?"rgba(255,200,120,0.13)":"rgba(255,200,120,0.04)",border:`1px solid ${chosenMsg===m?"rgba(255,200,120,0.3)":"rgba(255,200,120,0.08)"}`,borderRadius:"10px",padding:"11px 14px",textAlign:isRTL?"right":"left",width:"100%",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"14.5px",color:chosenMsg===m?"rgba(255,235,195,0.92)":"rgba(255,235,195,0.55)",lineHeight:1.4,opacity:0,animation:`act-in 0.3s ease ${i*0.02}s forwards`,transition:"all 0.15s ease"}}>
                  {m}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:"10px",width:"100%",alignItems:"center"}}>
              <button className="back-btn" onClick={()=>setGiveStep(1)} style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,200,120,0.2)",flexShrink:0}}>{ui.back}</button>
              <button onClick={handleSend} disabled={!chosenMsg} className="door-btn" style={{flex:1,background:chosenMsg?"rgba(255,200,120,0.1)":"rgba(255,200,120,0.03)",border:`1px solid ${chosenMsg?"rgba(255,200,120,0.28)":"rgba(255,200,120,0.07)"}`,borderRadius:"50px",padding:"14px 20px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"16px",color:chosenMsg?"rgba(255,215,145,0.85)":"rgba(255,200,120,0.2)",cursor:chosenMsg?"pointer":"default",animation:chosenMsg?"soft-border 4s ease-in-out infinite":"none",transition:"all 0.3s ease"}}>{ui.send}</button>
            </div>
          </div>
        )}

        {/* RECEIVE */}
        {screen==="receive"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"20px",width:"100%",opacity:0,animation:"rise 0.7s ease forwards"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"clamp(13px,2.5vw,15px)",color:"rgba(195,170,255,0.4)",textAlign:"center",margin:0}}>{ui.incoming}</p>
            <div style={{width:"100%",display:"flex",flexDirection:"column",gap:"7px",maxHeight:"400px",overflowY:"auto"}}>
              {inMsgs.map(m=>(
                <div key={m.id} style={{
                  background: m.real
                    ? "linear-gradient(135deg,rgba(30,18,5,0.82),rgba(25,14,4,0.88))"
                    : "linear-gradient(135deg,rgba(12,8,28,0.82),rgba(8,5,22,0.88))",
                  border: m.real
                    ? "1px solid rgba(255,200,120,0.28)"
                    : "1px solid rgba(160,130,255,0.18)",
                  borderRadius:"16px",padding:"18px 20px",opacity:0,
                  animation:"love-in 10s ease forwards",
                  display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",
                  backdropFilter:"blur(12px)",
                  boxShadow: m.real
                    ? "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,200,120,0.08)"
                    : "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(160,130,255,0.06)",
                }}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"18px",color: m.real ? "rgba(255,238,195,0.96)" : "rgba(230,215,255,0.94)",lineHeight:1.65,letterSpacing:"0.01em"}}>
                    {m.text}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px",flexShrink:0}}>
                    {m.real
                      ? <div style={{width:"5px",height:"5px",borderRadius:"50%",background:"rgba(255,200,100,0.8)",boxShadow:"0 0 8px rgba(255,200,100,0.6)",animation:"pulse 2s ease-in-out infinite"}}/>
                      : <div style={{width:"3px",height:"3px",borderRadius:"50%",background:"rgba(160,130,255,0.4)"}}/>
                    }
                    <span style={{fontFamily:"'Courier Prime',monospace",fontSize:"9px",letterSpacing:"0.08em",color: m.real ? "rgba(255,210,140,0.45)" : "rgba(170,150,235,0.32)",whiteSpace:"nowrap"}}>{m.from}</span>
                    {m.real && <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"8px",color:"rgba(255,200,120,0.35)",letterSpacing:"0.06em"}}>message réel</span>}
                  </div>
                </div>
              ))}
              {inMsgs.length===0&&(
                <div style={{textAlign:"center",padding:"40px",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"16px",color:"rgba(160,135,230,0.2)",animation:"pulse 2s ease-in-out infinite"}}>...</div>
              )}
            </div>
            <button onClick={goGive} className="door-btn" style={{background:"rgba(255,190,95,0.07)",border:"1px solid rgba(255,190,95,0.17)",borderRadius:"50px",padding:"12px 32px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"15px",color:"rgba(255,215,140,0.65)"}}>{ui.giveback}</button>
            <button className="back-btn" onClick={goDoor} style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,200,120,0.2)"}}>{ui.back}</button>
          </div>
        )}

        {/* SENT */}
        {screen==="sent"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"32px",textAlign:"center",opacity:0,animation:"rise 0.7s ease forwards"}}>
            <div style={{fontSize:"50px",opacity:0,animation:"bloom 1s ease 0.2s forwards",filter:"drop-shadow(0 0 22px rgba(220,160,80,0.42))"}}>♡</div>
            <div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:300,fontSize:"clamp(20px,4vw,32px)",color:"rgba(255,238,205,0.88)",margin:"0 0 10px 0"}}>{ui.sentTitle}</h2>
              <p style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"16px",color:"rgba(255,210,140,0.5)",margin:"0 0 5px 0",lineHeight:1.5}}>"{sentMsg}"</p>
              <p style={{fontFamily:"'Courier Prime',monospace",fontSize:"10px",letterSpacing:"0.09em",color:"rgba(255,200,120,0.2)",margin:0}}>{ui.from} {sentCountry}</p>
            </div>
            <div style={{background:"rgba(255,200,100,0.04)",border:"1px solid rgba(255,200,100,0.07)",borderRadius:"13px",padding:"17px 22px",maxWidth:"300px"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,235,200,0.42)",margin:0,lineHeight:1.9}}>
                {ui.sentLine1}<br/><span style={{color:"rgba(255,215,140,0.55)"}}>{ui.sentLine2}</span>
              </p>
            </div>
            <div style={{display:"flex",gap:"10px",flexWrap:"wrap",justifyContent:"center"}}>
              <button onClick={goGive} className="door-btn" style={{background:"rgba(255,200,100,0.07)",border:"1px solid rgba(255,200,100,0.14)",borderRadius:"50px",padding:"12px 22px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"15px",color:"rgba(255,215,145,0.68)"}}>{ui.again}</button>
              <button onClick={goReceive} className="door-btn" style={{background:"rgba(155,115,255,0.06)",border:"1px solid rgba(155,115,255,0.13)",borderRadius:"50px",padding:"12px 22px",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:"15px",color:"rgba(195,170,255,0.55)"}}>{ui.receiveBtn}</button>
            </div>
            <button className="back-btn" onClick={goDoor} style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"14px",color:"rgba(255,200,120,0.18)"}}>{ui.back}</button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{position:"fixed",bottom:"13px",left:0,right:0,textAlign:"center",zIndex:20,opacity:0,animation:"rise 3s ease 2s forwards"}}>
        <div style={{pointerEvents:"none",fontFamily:"'Courier Prime',monospace",fontSize:"8.5px",letterSpacing:"0.17em",color:"rgba(255,200,120,0.08)",textTransform:"uppercase"}}>{ui.footer}</div>
        <div style={{pointerEvents:"none",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"11px",color:"rgba(255,200,120,0.07)",marginTop:"3px"}}>{ui.crisis}</div>
        <div style={{marginTop:"8px",display:"flex",justifyContent:"center",gap:"16px"}}>
          <button onClick={()=>setLegalModal("mentions")} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Courier Prime',monospace",fontSize:"8px",letterSpacing:"0.12em",color:"rgba(255,200,120,0.18)",textTransform:"uppercase",textDecoration:"underline",padding:0}}>mentions légales</button>
          <button onClick={()=>setLegalModal("privacy")} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"'Courier Prime',monospace",fontSize:"8px",letterSpacing:"0.12em",color:"rgba(255,200,120,0.18)",textTransform:"uppercase",textDecoration:"underline",padding:0}}>confidentialité</button>
        </div>
      </div>

      {/* LEGAL MODAL */}
      {legalModal && (
        <div onClick={()=>setLegalModal(null)} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(5,3,12,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",backdropFilter:"blur(8px)"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"rgba(12,8,24,0.98)",border:"1px solid rgba(255,200,120,0.12)",borderRadius:"16px",maxWidth:"560px",width:"100%",maxHeight:"80vh",overflowY:"auto",padding:"36px",position:"relative"}}>
            <button onClick={()=>setLegalModal(null)} style={{position:"absolute",top:"16px",right:"20px",background:"none",border:"none",cursor:"pointer",color:"rgba(255,200,120,0.4)",fontSize:"20px",lineHeight:1}}>✕</button>

            {legalModal === "mentions" && (
              <div style={{fontFamily:"'Cormorant Garamond',serif",color:"rgba(255,200,120,0.75)",lineHeight:1.8}}>
                <h2 style={{fontFamily:"'Courier Prime',monospace",fontSize:"11px",letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,200,120,0.4)",marginBottom:"28px"}}>Mentions légales</h2>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>ÉDITEUR DU SITE</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>Ce site est édité à titre personnel, sans activité commerciale.</p>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)",marginTop:"6px"}}>Contact : <a href="mailto:contact@stillhereworld.com" style={{color:"rgba(255,200,120,0.5)"}}>contact@stillhereworld.com</a></p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>HÉBERGEMENT</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>Vercel Inc.<br/>340 Pine Street, Suite 701<br/>San Francisco, CA 94104, USA<br/><a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{color:"rgba(255,200,120,0.5)"}}>vercel.com</a></p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>OBJET DU SITE</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>StillHere est un espace anonyme et gratuit permettant à toute personne d'envoyer et recevoir des messages de bienveillance à travers le monde. Aucun compte utilisateur n'est requis.</p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>MODÉRATION</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>Les messages soumis par les utilisateurs sont filtrés automatiquement. L'éditeur se réserve le droit de supprimer tout contenu inapproprié sans préavis. Tout contenu haineux, discriminatoire ou portant atteinte à la dignité humaine est strictement interdit.</p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>PROPRIÉTÉ INTELLECTUELLE</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>L'ensemble du site (design, code, textes pré-rédigés) est la propriété de l'éditeur. Toute reproduction sans autorisation est interdite.</p>

                <p style={{fontSize:"12px",color:"rgba(255,200,120,0.25)",marginTop:"32px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.08em"}}>Dernière mise à jour : février 2026</p>
              </div>
            )}

            {legalModal === "privacy" && (
              <div style={{fontFamily:"'Cormorant Garamond',serif",color:"rgba(255,200,120,0.75)",lineHeight:1.8}}>
                <h2 style={{fontFamily:"'Courier Prime',monospace",fontSize:"11px",letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,200,120,0.4)",marginBottom:"28px"}}>Politique de confidentialité</h2>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>DONNÉES COLLECTÉES</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>StillHere ne collecte <strong style={{color:"rgba(255,200,120,0.8)"}}>aucune donnée personnelle</strong>. Aucun nom, prénom, adresse email, numéro de téléphone ou toute autre information permettant d'identifier un utilisateur n'est requis ni enregistré.</p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>COOKIES</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>Ce site n'utilise <strong style={{color:"rgba(255,200,120,0.8)"}}>aucun cookie de tracking</strong>, publicitaire ou analytique. Aucun consentement n'est requis. Les seuls cookies techniques présents sont ceux strictement nécessaires au fonctionnement de l'hébergeur Vercel.</p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>MESSAGES ANONYMES</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>Les messages envoyés via StillHere sont entièrement anonymes. Aucune donnée permettant d'identifier l'expéditeur n'est conservée. Les messages peuvent être conservés pour permettre le fonctionnement du service et sont susceptibles d'être supprimés à tout moment.</p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>DONNÉES TECHNIQUES</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>Des données techniques anonymes (pays de connexion, type d'appareil, pages visitées) peuvent être collectées par l'hébergeur Vercel à des fins de performance et de sécurité, conformément à leur propre politique de confidentialité.</p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>VOS DROITS (RGPD)</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>En l'absence de collecte de données personnelles, les droits d'accès, rectification et suppression prévus par le RGPD ne s'appliquent pas. Pour toute question : <a href="mailto:contact@stillhereworld.com" style={{color:"rgba(255,200,120,0.5)"}}>contact@stillhereworld.com</a></p>

                <h3 style={{fontSize:"13px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.1em",color:"rgba(255,200,120,0.5)",marginBottom:"8px",marginTop:"24px"}}>MINEURS</h3>
                <p style={{fontSize:"15px",color:"rgba(255,200,120,0.6)"}}>StillHere ne collectant aucune donnée personnelle, il n'existe pas de restriction d'âge technique. Les contenus du site sont conçus pour être bienveillants et accessibles à tous.</p>

                <p style={{fontSize:"12px",color:"rgba(255,200,120,0.25)",marginTop:"32px",fontFamily:"'Courier Prime',monospace",letterSpacing:"0.08em"}}>Dernière mise à jour : février 2026</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
