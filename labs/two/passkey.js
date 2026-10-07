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
    if (p) $('how').textContent = p.via === 'created' ? 'Account created here with Face ID.' : 'Signed in with one Face ID tap: nothing typed, nothing copied from the other app.';
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
        timeout: 60000,
      } });
      set({ name, via: 'created', at: Date.now() }); log(''); paint();
    } catch (e) { log(e.name === 'NotAllowedError' ? 'Cancelled, or Face ID did not finish.' : e.name + ': ' + e.message); }
  }

  async function signIn() {
    if (!window.PublicKeyCredential) return log('This browser has no passkeys.');
    try {
      const c = await navigator.credentials.get({ publicKey: { challenge: rnd(32), userVerification: 'required', timeout: 60000 } });
      let name = '';
      try { name = JSON.parse(dec.decode(c.response.userHandle)).n; } catch {}
      if (!name) return log('That passkey is not from this test. Create the account in Test A first.');
      set({ name, via: 'passkey', at: Date.now() }); log(''); paint();
    } catch (e) { log(e.name === 'NotAllowedError' ? 'Cancelled, or no passkey for this site yet: create the account first.' : e.name + ': ' + e.message); }
  }

  $('create').onclick = create;
  $('signin').onclick = signIn;
  $('reset').onclick = () => { set(null); log(''); paint(); };
  paint();
})();
