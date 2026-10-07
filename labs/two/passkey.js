// Option 2 test: a family account with a passkey (Face ID). Test A and Test B are
// separate Home Screen apps with separate storage; the passkey lives in iCloud
// Keychain, tied to this site's address, so either app can use it.
//
// A test only: there is no server here. The name rides inside the passkey's user
// handle (up to 64 bytes) and comes back when Face ID signs in. The real thing
// would check each sign-in on the server and hand over the person's settings.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'lab.two';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const set = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
  const log = m => { $('log').textContent = m; };

  function paint() {
    const p = get();
    $('where').textContent = standalone ? 'Opened from its own Home Screen icon.' : 'Add this page to your Home Screen (Share, Add to Home Screen), then open it from there.';
    $('store').innerHTML = p ? '<span class="ok">This app remembers ' + p.name.replace(/[<&>"]/g, '') + '</span>' : 'This app\'s own storage is empty';
    $('in').classList.toggle('hide', !!p); $('out').classList.toggle('hide', !p);
    if (p) $('how').textContent = p.via === 'created' ? 'Account created here with Face ID.' : p.via === 'autofill' ? 'Signed in from the keyboard bar with Face ID: nothing typed, nothing copied from the other app.' : 'Signed in with one Face ID tap: nothing typed, nothing copied from the other app.';
  }

  async function create() {
    const name = $('name').value.trim().slice(0, 40);
    if (!name) { $('name').focus(); return; }
    if (!window.PublicKeyCredential) return log('This browser has no passkeys.');
    try {
      await navigator.credentials.create({ publicKey: {
        challenge: rnd(32),
        rp: { name: 'AllisonOS (test)' },
        user: { id: enc.encode(JSON.stringify({ n: name })), name: name + ' (AllisonOS test)', displayName: name },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
        hints: ['client-device'],   // prefer this phone's own passkeys (browsers that know hints)
        timeout: 60000,
      } });
      set({ name, via: 'created', at: Date.now() }); log(''); paint();
    } catch (e) { log(e.name === 'NotAllowedError' ? 'Cancelled, or Face ID did not finish.' : e.name + ': ' + e.message); }
  }

  async function signIn() {
    if (!window.PublicKeyCredential) return log('This browser has no passkeys.');
    try {
      if (auto) auto.abort();   // a request already waiting in the keyboard bar would block this one
      const c = await navigator.credentials.get({ publicKey: { challenge: rnd(32), userVerification: 'required', hints: ['client-device'], timeout: 60000 } });
      done(c, 'passkey');
    } catch (e) { log(e.name === 'NotAllowedError' ? 'Cancelled, or no passkey for this site yet: create the account first.' : e.name + ': ' + e.message); waitInKeyboard(); }
  }
  function done(c, via) {
    let name = '';
    try { name = JSON.parse(dec.decode(c.response.userHandle)).n; } catch {}
    if (!name) return log('That passkey is not from this test. Create the account in Test A first.');
    set({ name, via, at: Date.now() }); log(''); paint();
  }

  // The second way in: passkey autofill. Tapping the name box shows saved passkeys
  // above the keyboard ("conditional mediation"), a different path from the button.
  let auto = null;
  async function waitInKeyboard() {
    if (get() || !window.PublicKeyCredential || !PublicKeyCredential.isConditionalMediationAvailable) return;
    try { if (!(await PublicKeyCredential.isConditionalMediationAvailable())) return; } catch { return; }
    auto = new AbortController();
    try {
      const c = await navigator.credentials.get({ mediation: 'conditional', signal: auto.signal, publicKey: { challenge: rnd(32), userVerification: 'required' } });
      done(c, 'autofill');
    } catch (e) { if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') log(e.name + ': ' + e.message); }
  }

  // What this phone reports, for working out why a passkey isn't offered
  async function report() {
    const out = [];
    out.push('Opened from: ' + (standalone ? 'Home Screen icon' : 'Safari tab'));
    out.push('iOS: ' + ((navigator.userAgent.match(/OS (\d+[_\d]*) like Mac/) || [])[1] || '?').replace(/_/g, '.'));
    const P = window.PublicKeyCredential;
    if (!P) { out.push('Passkeys: not available'); } else {
      try { out.push('Face ID passkeys: ' + ((await P.isUserVerifyingPlatformAuthenticatorAvailable()) ? 'yes' : 'no')); } catch { out.push('Face ID passkeys: ?'); }
      try { out.push('Passkey autofill: ' + (P.isConditionalMediationAvailable && (await P.isConditionalMediationAvailable()) ? 'yes' : 'no')); } catch { out.push('Passkey autofill: ?'); }
      try { if (P.getClientCapabilities) { const k = await P.getClientCapabilities(); out.push('Capabilities: ' + ['passkeyPlatformAuthenticator', 'userVerifyingPlatformAuthenticator', 'conditionalGet', 'hybridTransport'].map(x => x + ' ' + (k[x] ? 'yes' : 'no')).join(', ')); } } catch {}
    }
    $('report').textContent = out.join('\n');
  }

  $('create').onclick = create;
  $('signin').onclick = signIn;
  $('reset').onclick = () => { set(null); log(''); paint(); waitInKeyboard(); };
  paint(); report(); waitInKeyboard();
})();
