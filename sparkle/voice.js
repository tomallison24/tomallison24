'use strict';

// Sparkle Kingdom's voice and sounds.
//
//   say(parts, { who, onPart, onWord })  speaks a question's parts in order (content.js): a string in the
//                                 speaker's natural voice, or the phone's own; { snd: 't' } the letter's
//                                 sound; { rime: 'at' } the end of a word. Resolves when it's done (or
//                                 stopped). who: the one speaking ('narrator', 'owl', 'dragon', 'gemma',
//                                 'bloom'), which picks the natural voice, or the phone voice's pitch.
//   natural                       set by app.js: { ok(), url(who, text, rate), headers() } to ask the family's
//                                 server for natural voices (functions/sparkle/api speak), or null.
//   prefetch(parts, who)          fetches the natural voice for lines about to be said (a chapter's pages).
//   stop()                        stops speaking.
//   unlock()                      call from a tap: an iPhone only lets a page speak after one.
//   sfx(name)                     a little sound made in code (no files): right, again, coin, sparkle,
//                                 fanfare, whoosh, pop, plank, drum.
//   clips: letter sounds a grown-up recorded (Settings), as data: URLs, kept on this phone
//     (localStorage sparkle.clips) and in the family account (app.js syncs them):
//     has(l), set(l, url), all(), load(obj), record() -> { stop(): Promise<url> }, play(l)
//
// Isolated letter sounds are where a phone's voice is weakest: it says letter names well, and /k/ or
// /m/ on its own poorly. With no recording yet, a sound is the voice's best try (SOUND below).
(function (root) {
  const synth = root.speechSynthesis;
  const KEY = 'sparkle.clips';
  let clips = {}; try { clips = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  let rate = 0.9, sounds = true, voice = null, token = 0;

  // the voice's best try at a letter's sound, and at the end of a word, when nothing's recorded
  const SOUND = { s: 'sss', m: 'mmm', f: 'fff', n: 'nnn', l: 'lll', r: 'rrr', z: 'zzz', v: 'vvv', h: 'huh', t: 'tuh', p: 'puh', c: 'kuh', k: 'kuh', b: 'buh',
    d: 'duh', g: 'guh', j: 'juh', w: 'wuh', y: 'yuh', x: 'ks', q: 'kwuh', a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh' };
  const RIME = { og: 'awg', ox: 'ox', eb: 'ebb', eg: 'egg', em: 'em', us: 'uss', ug: 'ugg', ig: 'igg', ap: 'app', at: 'at', an: 'an', ed: 'ed', en: 'en', un: 'un', in: 'in' };
  const PITCH = { owl: 0.85, dragon: 1.25, narrator: 1.08, fairy: 1.35, gemma: 1.35, bloom: 1.35 };
  const SPEAKER = { owl: 'owl', dragon: 'dragon', narrator: 'narrator', fairy: 'bloom', gemma: 'gemma', bloom: 'bloom' };

  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices().filter(v => /^en(-|_)US/i.test(v.lang));
    const score = v => (/premium|enhanced/i.test(v.name) ? 4 : 0) + (/samantha|ava|allison|susan|zoe|nicky/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0] || null;
  }
  if (synth) { voice = pickVoice(); try { synth.addEventListener('voiceschanged', () => { voice = pickVoice(); }); } catch {} }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  // the phone's own voice
  function speakPhone(text, who, onWord) {
    return new Promise(done => {
      if (!synth || !text.trim()) return done();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; if (voice) u.voice = voice;
      u.rate = rate; u.pitch = PITCH[who] || 1.05;
      let over = false; const end = () => { if (!over) { over = true; clearTimeout(t); done(); } };
      u.onend = end; u.onerror = end;
      if (onWord) u.onboundary = e => { if (e.name === 'word' || e.name === undefined) onWord(e.charIndex); };
      // a long fallback: some phones never fire onend
      const t = setTimeout(end, 1500 + text.length * 120 / rate);
      synth.speak(u);
    });
  }

  // ---- natural voices: each sentence made once by the family's server (Google's Chirp 3: HD voices) and kept
  // on this phone (Cache Storage); the phone's voice when there's none (signed out, no key yet, offline) ----
  const VOICES = 'sparkle-voice-v1';
  let natural = null, restUntil = 0, player = null, endPlay = null, unlocked = false;
  const SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  // one audio element, unlocked by a tap: an iPhone plays later sounds on it without one
  const getPlayer = () => player || (player = root.Audio ? new Audio() : null);
  // snd: the letter whose sound this is, so the server says it as that sound (not "s, s, s" for "sss")
  async function clipFor(who, text, snd) {
    if (!natural || Date.now() < restUntil || !natural.ok()) return null;
    const url = natural.url(SPEAKER[who] || 'narrator', text, rate, snd);
    try {
      const box = root.caches ? await caches.open(VOICES).catch(() => null) : null;
      let res = box && await box.match(url);
      if (!res) {
        const ac = new AbortController(), t = setTimeout(() => ac.abort(), 4000);
        try { res = await fetch(url, { headers: natural.headers(), signal: ac.signal }); } finally { clearTimeout(t); }
        // not set up, signed out or failing: the phone's voice for a while, then try again
        if (!res.ok) { if (res.status !== 400 && res.status !== 422) restUntil = Date.now() + (res.status === 503 || res.status === 401 ? 600000 : 60000); return null; }
        if (box) await box.put(url, res.clone()).catch(() => {});
      }
      return URL.createObjectURL(await res.blob());
    } catch { restUntil = Date.now() + 60000; return null; }
  }
  // play it, lighting each word about when it's said (the audio's time shared out by the letters)
  function playNatural(url, text, onWord) {
    return new Promise(done => {
      const a = getPlayer(); if (!a) { URL.revokeObjectURL(url); return done(false); }
      const starts = [...text.matchAll(/\S+/g)].map(m => m.index);
      let over = false, last = -1, played = false;
      const end = () => { if (over) return; over = true; endPlay = null; clearTimeout(t); a.onended = a.onerror = a.ontimeupdate = a.onplaying = null; URL.revokeObjectURL(url); done(played); };
      endPlay = () => { try { a.pause(); } catch {} end(); };
      a.onended = end; a.onerror = end; a.onplaying = () => { played = true; };
      if (onWord) a.ontimeupdate = () => { if (!a.duration || !isFinite(a.duration)) return; const at = a.currentTime / a.duration * text.length, w = starts.filter(i => i <= at).pop();
        if (w !== undefined && w !== last) { last = w; onWord(w); } };
      const t = setTimeout(end, 3000 + text.length * 160);
      a.src = url;
      const p = a.play(); if (p && p.catch) p.catch(end);
    });
  }
  async function speakOne(text, who, onWord, snd) {
    if (!text || !text.trim()) return;
    const me = token, url = await clipFor(who, text, snd);
    if (me !== token) { if (url) URL.revokeObjectURL(url); return; }
    if (url && await playNatural(url, text, onWord)) return;
    if (me === token) await speakPhone(text, who, onWord);
  }
  // fetch lines about to be said, so each page of a chapter starts at once
  function prefetch(parts, who) { for (const p of [].concat(parts || [])) if (typeof p === 'string' && p.trim()) clipFor(who, p).then(u => u && URL.revokeObjectURL(u)); }

  function playClip(url) {
    return new Promise(done => {
      try { const a = getPlayer() || new Audio(); let over = false; const end = () => { if (!over) { over = true; endPlay = null; a.onended = a.onerror = null; done(); } };
        endPlay = () => { try { a.pause(); } catch {} end(); };
        a.onended = a.onerror = end; a.src = url; const p = a.play(); if (p && p.catch) p.catch(end); setTimeout(end, 3000); }
      catch { done(); }
    });
  }
  async function say(parts, opt = {}) {
    stop();
    const me = ++token;
    const list = [].concat(parts || []);
    for (let k = 0; k < list.length; k++) {
      const part = list[k];
      if (me !== token) return;
      if (opt.onPart) opt.onPart(k);
      // a part that's only punctuation ('?', '...', '!') is a pause, not something to read out
      if (typeof part === 'string') { const off = part.length - part.replace(/^[\s.,;:!?…-]+/, '').length, text = part.slice(off);
        if (!/[a-z0-9]/i.test(text)) { await wait(/\.\.|…/.test(part) ? 350 : 120); continue; }
        await speakOne(text, opt.who, opt.onWord ? i => opt.onWord(k, i + off) : null); continue; }
      if (part && part.snd) { if (clips[part.snd]) await playClip(clips[part.snd]); else await speakOne(SOUND[part.snd] || part.snd, opt.who, null, part.snd); await wait(160); continue; }
      if (part && part.rime) { await speakOne(RIME[part.rime] || part.rime, opt.who); continue; }
    }
  }
  function stop() { token++; try { synth && synth.cancel(); } catch {} if (endPlay) endPlay(); }
  let spoke = false;
  function unlock() {
    // once: a silent sentence on every tap took the phone's sound away from the drum and the natural voices
    try { if (synth && !spoke && !synth.speaking) { spoke = true; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch {}
    try { const a = getPlayer(); if (a && !unlocked && !endPlay) { unlocked = true; a.src = SILENT; const p = a.play(); if (p && p.catch) p.catch(() => { unlocked = false; }); } } catch {}
    ctx();
  }

  // ---- sounds made in code ----
  let ac = null;
  // resumed whenever it isn't running: an iPhone's 'interrupted' too, after other sound has played
  function ctx() { try { if (!ac) ac = new (root.AudioContext || root.webkitAudioContext)(); if (ac.state !== 'running') ac.resume().catch(() => {}); } catch { ac = null; } return ac; }
  function tone(freq, at, dur, type = 'sine', vol = 0.18) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    right: () => { tone(784, 0, 0.18, 'triangle'); tone(1047, 0.1, 0.22, 'triangle'); tone(1319, 0.2, 0.3, 'triangle'); },
    again: () => { tone(392, 0, 0.18, 'sine', 0.12); tone(440, 0.14, 0.22, 'sine', 0.12); },
    coin: () => { tone(988, 0, 0.08, 'square', 0.06); tone(1319, 0.07, 0.2, 'square', 0.06); },
    sparkle: () => { for (let i = 0; i < 6; i++) tone(1400 + i * 180, i * 0.05, 0.12, 'sine', 0.06); },
    fanfare: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle', 0.14)); },
    whoosh: () => { [300, 420, 560, 700].forEach((f, i) => tone(f, i * 0.04, 0.12, 'sine', 0.05)); },
    pop: () => tone(660, 0, 0.08, 'sine', 0.12),
    plank: () => { tone(220, 0, 0.1, 'triangle', 0.16); tone(330, 0.04, 0.08, 'triangle', 0.08); },
    drum: () => { tone(150, 0, 0.22, 'sine', 0.35); tone(95, 0.01, 0.28, 'triangle', 0.22); },
    note: n => tone([523, 587, 659, 698, 784, 880, 988, 1047, 1175][n % 9], 0, 0.35, 'triangle', 0.14),
  };
  const sfx = (name, arg) => { if (sounds && SFX[name]) try { SFX[name](arg); } catch {} };

  // ---- recorded letter sounds ----
  const saveClips = () => { try { localStorage.setItem(KEY, JSON.stringify(clips)); } catch {} };
  const toURL = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
  async function record() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => root.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined), bits = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) bits.push(e.data); };
    rec.start();
    const cap = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 2500);   // a sound is short: 2.5 seconds at most
    return { stop: () => new Promise(ok => { rec.onstop = async () => { clearTimeout(cap); stream.getTracks().forEach(t => t.stop()); ok(bits.length ? await toURL(new Blob(bits, { type: rec.mimeType || type || 'audio/mp4' })) : null); };
      if (rec.state === 'recording') rec.stop(); else rec.onstop(); }) };
  }

  root.SparkleVoice = {
    say, stop, unlock, sfx, prefetch, SOUND,
    get natural() { return natural; }, set natural(v) { natural = v || null; restUntil = 0; },
    get rate() { return rate; }, set rate(v) { rate = Math.max(0.6, Math.min(1.2, +v || 0.9)); },
    get sounds() { return sounds; }, set sounds(v) { sounds = !!v; },
    available: () => !!synth,
    clips: { has: l => !!clips[l], all: () => ({ ...clips }), set(l, url) { if (url) clips[l] = url; else delete clips[l]; saveClips(); },
      load(obj) { if (obj && typeof obj === 'object') { clips = { ...obj }; saveClips(); } }, record, play: l => clips[l] ? playClip(clips[l]) : speakPhone(SOUND[l] || l) },
  };
})(typeof window !== 'undefined' ? window : globalThis);
