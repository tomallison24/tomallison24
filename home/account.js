// AllisonOS family accounts: the apps' side. The server is functions/aOS/api
// (rules in server/auth.js).
//
// Each Home Screen app has its own storage, but a passkey lives in the person's
// iCloud Keychain, tied to this site's address, so any app signs in with one Face
// ID tap. The session it gets back is kept in this app's own storage
// (localStorage aos.session) and sent with calls to the locked server routes
// (calendar/api, travel/api).
//
//   AllisonOS.account.fetch(url, opts)   fetch, signed in; on a 401 it shows the
//                                        sign-in sheet once and tries again
//   AllisonOS.account.signIn()           Face ID -> session (needs a tap first)
//   AllisonOS.account.signUp({ name, code | invite })
//   AllisonOS.account.call(path, body)   the accounts API itself (aOS uses it)
//   AllisonOS.account.user() / .signOut() / .prompt()
(() => {
  'use strict';
  const A = window.AllisonOS = window.AllisonOS || {};
  if (A.account) return;
  const me = document.currentScript;
  const API = new URL('../aOS/api/', (me && me.src) || location.href).href;
  const KEY = 'aos.session';
  const enc = new TextEncoder();
  const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

  async function call(path, body, method) {
    const s = load(), headers = { 'Content-Type': 'application/json' };
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    const r = await fetch(API + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'http-' + r.status), { status: r.status, data: j });
    return j;
  }
  const keep = j => { save({ token: j.token, user: j.user, at: Date.now() }); dispatchEvent(new CustomEvent('aos:account', { detail: j.user })); return j.user; };

  async function signIn() {
    if (!window.PublicKeyCredential) throw new Error('no-passkeys');
    const b = await call('signin/begin', {});
    const c = await navigator.credentials.get({ publicKey: { challenge: unb64u(b.challenge), rpId: b.rpId, userVerification: 'required', hints: ['client-device'], timeout: 120000 } });
    return keep(await call('signin/finish', { id: b.id, credId: b64u(c.rawId), clientDataJSON: b64u(c.response.clientDataJSON), authenticatorData: b64u(c.response.authenticatorData), signature: b64u(c.response.signature) }));
  }

  async function signUp({ name, code, invite }) {
    if (!window.PublicKeyCredential) throw new Error('no-passkeys');
    const b = await call('signup/begin', { name, code, invite });
    const c = await navigator.credentials.create({ publicKey: {
      challenge: unb64u(b.challenge), rp: b.rp,
      user: { id: unb64u(b.user.id), name: b.user.name + ' (AllisonOS)', displayName: b.user.name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
      hints: ['client-device'], attestation: 'none', timeout: 120000,
    } });
    const r = c.response;
    if (!r.getPublicKey || !r.getAuthenticatorData) throw new Error('old-browser');
    return keep(await call('signup/finish', { id: b.id, credId: b64u(c.rawId), clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.getAuthenticatorData()), spki: b64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm() }));
  }

  // ---- the sign-in sheet: Face ID needs a tap, so a locked call asks for one ----
  const CSS = `
#aos-signin { position: fixed; inset: 0; z-index: 2147483600; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.32);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased; opacity: 0; transition: opacity .25s;
  --s-bg: rgba(250,250,252,.97); --s-text: #0B0B0F; --s-muted: rgba(60,60,67,.62); --s-dot: rgba(0,0,0,.07);
  --s-pastel: linear-gradient(100deg, #6FA597 0%, #8193BC 34%, #BE918F 67%, #BC9C68 100%); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) #aos-signin { --s-bg: rgba(24,25,30,.97); --s-text: #fff; --s-muted: rgba(235,235,245,.62); --s-dot: rgba(255,255,255,.1);
  --s-pastel: linear-gradient(100deg, #A9D3C7 0%, #B9C6E0 34%, #E3C5C3 67%, #E9D6B4 100%); } }
html[data-theme="dark"] #aos-signin { --s-bg: rgba(24,25,30,.97); --s-text: #fff; --s-muted: rgba(235,235,245,.62); --s-dot: rgba(255,255,255,.1);
  --s-pastel: linear-gradient(100deg, #A9D3C7 0%, #B9C6E0 34%, #E3C5C3 67%, #E9D6B4 100%); }
#aos-signin.on { opacity: 1; }
#aos-signin .s-sheet { width: 100%; max-width: 520px; margin: 0 8px calc(env(safe-area-inset-bottom) + 8px); padding: 26px 22px 18px; border-radius: 30px; background: var(--s-bg);
  -webkit-backdrop-filter: blur(30px); backdrop-filter: blur(30px); color: var(--s-text); text-align: center; transform: translateY(30px); transition: transform .35s cubic-bezier(.2,.8,.2,1); }
#aos-signin.on .s-sheet { transform: none; }
#aos-signin .s-mark { font-size: 40px; font-weight: 800; letter-spacing: -1.5px; line-height: 1; }
#aos-signin .s-mark span { background: var(--s-pastel); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
#aos-signin h2 { margin: 14px 0 6px; font-size: 22px; }
#aos-signin p { margin: 0 0 4px; color: var(--s-muted); font-size: 15px; line-height: 1.4; }
#aos-signin button { display: block; width: 100%; height: 50px; margin-top: 14px; border: 0; border-radius: 999px; font-family: inherit; font-size: 17px; font-weight: 600; cursor: pointer; }
#aos-signin .s-go { background: #0A84FF; color: #fff; }
#aos-signin .s-not { height: 40px; margin-top: 6px; background: none; color: var(--s-muted); font-size: 15px; }
#aos-signin .s-err { min-height: 20px; margin-top: 10px; font-size: 14px; color: #D9534F; }
#aos-signin .s-new { margin-top: 6px; font-size: 13px; }`;
  let asking = null;
  function prompt(why) {
    if (asking) return asking;
    asking = new Promise(resolve => {
      if (!document.getElementById('aos-signin-css')) { const st = document.createElement('style'); st.id = 'aos-signin-css'; st.textContent = CSS; document.head.appendChild(st); }
      const el = document.createElement('div');
      el.id = 'aos-signin'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Sign in to AllisonOS');
      el.innerHTML = `<div class="s-sheet"><div class="s-mark"><span>aOS</span></div><h2>Sign in to AllisonOS</h2>
        <p>${why || 'Your family account keeps this private.'}</p>
        <button type="button" class="s-go">Continue with Face ID</button><div class="s-err" role="status"></div>
        <p class="s-new">No account yet? Set one up in aOS, or ask for an invite.</p>
        <button type="button" class="s-not">Not now</button></div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
      const done = ok => { el.classList.remove('on'); setTimeout(() => el.remove(), 300); asking = null; resolve(ok); };
      el.querySelector('.s-not').onclick = () => done(false);
      el.querySelector('.s-go').onclick = async () => {
        const err = el.querySelector('.s-err'); err.textContent = '';
        try { await signIn(); done(true); }
        catch (e) { err.textContent = e.name === 'NotAllowedError' ? 'No passkey found, or cancelled. Set up your account in aOS first.' : e.message === 'unknown' ? 'That account isn\'t in the family any more.' : 'Couldn\'t sign in (' + (e.message || e.name) + ').'; }
      };
    });
    return asking;
  }

  // fetch, signed in: on a 401 from a locked route, ask once and try again
  async function authFetch(url, opts = {}) {
    const go = () => { const s = load(), h = new Headers(opts.headers || {}); if (s && s.token) h.set('Authorization', 'Bearer ' + s.token); return fetch(url, Object.assign({}, opts, { headers: h })); };
    let r = await go();
    if (r.status !== 401) return r;
    let j = {}; try { j = await r.clone().json(); } catch {}
    if (j.error !== 'signin') return r;
    save(null);
    if (await prompt()) r = await go();
    return r;
  }

  A.account = {
    fetch: authFetch, signIn, signUp, call, prompt,
    user: () => (load() || {}).user || null,
    token: () => (load() || {}).token || null,
    signOut: () => { save(null); dispatchEvent(new CustomEvent('aos:account', { detail: null })); },
  };
})();
