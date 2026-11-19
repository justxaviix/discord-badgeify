// shit sound
// idk its fuck you sound ig
const CUSTOM_SOUND_FILES = [
  "assets/sounds/complete.mp3",
  "assets/sounds/complete.wav",
  "assets/sounds/complete.ogg"
];

// an bitch boy sound
const VOICE_FILE = "assets/sounds/voice.mp3";
const VOICE_REPEAT = 1;
const VOICE_DELAY_MS = 2600; 

let audioContext;

async function getContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") await audioContext.resume();
  return audioContext;
}

async function tryPlayCustomFile() {
  for (const file of CUSTOM_SOUND_FILES) {
    const url = chrome.runtime.getURL(file);
    try {
      const head = await fetch(url, { method: "GET" });
      if (!head.ok) continue;
      const audio = new Audio(url);
      audio.volume = 1;
      await audio.play();
      return true;
    } catch {
      // if sound didnt play fuck ur self
    }
  }
  return false;
}

function tone(ctx, { type, from, to, start, duration, volume }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.03);
  gain.gain.setValueAtTime(volume, start + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
  return osc;
}

async function playSynthSound() {
  const ctx = await getContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;

  // womp womp
  const notes = [
    { from: 311, to: 294, d: 0.32 },
    { from: 294, to: 277, d: 0.32 },
    { from: 277, to: 262, d: 0.32 },
    { from: 262, to: 196, d: 0.9 }
  ];
  let t = t0;
  for (const n of notes) {
    tone(ctx, { type: "sawtooth", from: n.from, to: n.to, start: t, duration: n.d, volume: 0.22 });
    t += n.d + 0.04;
  }

  // idk that code 
  const buzz = ctx.createOscillator();
  const wobble = ctx.createOscillator();
  const wobbleGain = ctx.createGain();
  const out = ctx.createGain();
  buzz.type = "square";
  buzz.frequency.setValueAtTime(95, t);
  buzz.frequency.exponentialRampToValueAtTime(60, t + 0.8);
  wobble.type = "square";
  wobble.frequency.value = 28;
  wobbleGain.gain.value = 0.2;
  out.gain.setValueAtTime(0.2, t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  wobble.connect(wobbleGain);
  wobbleGain.connect(out.gain);
  buzz.connect(out);
  out.connect(ctx.destination);
  buzz.start(t);
  wobble.start(t);
  buzz.stop(t + 0.9);
  wobble.stop(t + 0.9);
}

async function playVoiceViaContext() {
  const ctx = await getContext();
  if (!ctx) throw new Error("no AudioContext");
  const res = await fetch(chrome.runtime.getURL(VOICE_FILE));
  if (!res.ok) throw new Error(`voice file fetch failed: ${res.status}`);
  const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
  await new Promise((resolve) => {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.onended = resolve;
    src.start();
  });
}

function playVoiceViaElement() {
  return new Promise((resolve, reject) => {
    const audio = new Audio(chrome.runtime.getURL(VOICE_FILE));
    audio.volume = 1;
    audio.onended = resolve;
    audio.onerror = () => reject(new Error("audio element error"));
    audio.play().catch(reject);
  });
}

async function playVoice() {
  for (let i = 0; i < VOICE_REPEAT; i++) {
    try {
      await playVoiceViaContext();
    } catch (error) {
      console.warn("[Badgeify] Voice via AudioContext failed, trying <audio>:", error);
      try {
        await playVoiceViaElement();
      } catch (error2) {
        console.warn("[Badgeify] Voice playback failed:", error2);
        return;
      }
    }
  }
}

async function playCompletionSound() {
  const customPlayed = await tryPlayCustomFile();
  if (!customPlayed) await playSynthSound();
  setTimeout(() => playVoice().catch((e) => console.warn("[Badgeify] Voice error:", e)), customPlayed ? 1200 : VOICE_DELAY_MS);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "BADGEIFY_PLAY_SUCCESS_SOUND") {
    playCompletionSound().catch((error) => {
      console.warn("[Badgeify] Could not play completion sound:", error);
    });
    sendResponse({ ok: true }); // lets the worker know the sound really started
  }
});
