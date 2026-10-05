// SECURITY: the Signal dashboard's Security view (ha-config,
// views_signal/security.yaml) in this app's layout. Same rules:
//   - Blink System: one mode, Armed (armed_away); a plain tap arms or
//     disarms it, no confirm. "Indoor motion" shows while
//     input_boolean.blink_indoor_alarm_active is on; tapping it turns that off,
//     which ends the Nest Mini announcements (one more may still play).
//   - the Blink cameras send stills, not video (the integration has no
//     stream), and only make a new one when asked: Snapshot runs
//     script.blink_snapshot, which asks for one and pulls it in (~8 s). The
//     badge is ACTIVE when its motion detection is on and the system armed,
//     STANDBY when on but disarmed, OFF otherwise. A still's age is the ts=
//     in its thumbnail address (when it was taken).
//   - pausing motion detection runs script.pause_<camera>_camera_motion_detection
//     with the minutes, which turns it off and back on after.
//   - the Nest doorbell can't be turned off from Home Assistant; its stills
//     only come with events, so it has a live view: WebRTC or HLS, whichever
//     the camera offers (camera/capabilities), as Home Assistant's own player.
// Scripts that wait are started (script.turn_on), not waited for.
'use strict';
const BLINK = 'alarm_control_panel.blink_system', BLINK_ALERT = 'input_boolean.blink_indoor_alarm_active';
const DOORBELL = { id: 'door', name: 'Front Door', cam: 'camera.outside_front_outside_front_doorbell', chime: 'event.outside_front_outside_front_doorbell_chime', motion: 'event.outside_front_outside_front_doorbell_motion' };
const BLINKS = [['yard', 'Yard'], ['garage', 'Garage'], ['kitchen', 'Kitchen'], ['living_room', 'Living Room']].map(([k, n]) => ({
  id: k, name: n, cam: 'camera.' + k, sw: `switch.${k}_camera_motion_detection`, motion: `binary_sensor.${k}_motion`, battery: `binary_sensor.${k}_battery`,
  temp: `sensor.blink_${k}_temperature`, wifi: `sensor.blink_${k}_wi_fi_signal_strength`, pause: `script.pause_${k}_camera_motion_detection`,
  pauseOnCard: k === 'yard' }));   // the Yard's pause is used often enough to sit on its card
const PAUSES = [[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours']];
const SEC_ACC = { armed: '78,161,255', disarmed: '154,160,166', arming: '255,180,78', triggered: '255,92,92', offline: '154,160,166' };
// Front-door events are timestamps; their type reads better without "camera_".
const evWhen = id => { const v = val(id); return v && v !== 'unknown' && v !== 'unavailable' ? ago(v) : 'None'; };
const evWhat = id => String(attr(id, 'event_type') || '').replace(/^camera_/, '').replace(/_/g, ' ');

family({
  id: 'cams', name: 'Cameras', icon: 'cctv', group: 'Security', order: 1,

  sys() {
    const d = dv('cams', 'sys', 'Blink'), s = val(BLINK);
    const offline = gone(BLINK), state = offline ? 'offline' : held(d, 'arm', s);
    const mood = offline ? 'offline' : state === 'triggered' ? 'triggered' : state === 'arming' || state === 'disarming' ? 'arming' : state === 'disarmed' ? 'disarmed' : 'armed';
    return { d, state, mood, armed: mood === 'armed', alert: isOn(BLINK_ALERT) };
  },
  cam(c) {
    const d = dv('cams', c.id, c.name), on = held(d, 'sw', val(c.sw)) === 'on', sys = this.sys();
    const thumb = String(attr(c.cam, 'thumbnail') || ''), ts = Number((/[?&]ts=(\d+)/.exec(thumb) || [])[1]) || null;
    const s = st(c.cam);
    return { d, on, badge: !on ? 'off' : sys.armed ? 'active' : 'standby', ts, offline: gone(c.cam),
      pic: haPic(attr(c.cam, 'entity_picture'), ts || (s && s.lu)), motion: isOn(c.motion) };
  },
  snap(name, pic, badge, age, extra = '') {
    const b = badge ? `<span class="cbadge ${badge}">${badge === 'active' ? '<i></i>' : ''}${badge.toUpperCase()}</span>` : '';
    return `<div class="snap">${pic ? `<img src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : `<div class="noimg">${svg('cctv', 34)}<span>${mode === 'live' ? 'No picture yet' : 'The camera\'s picture shows here once connected'}</span></div>`}
      ${b}<span class="cname">${esc(name)}</span>${age ? `<span class="cage">${age}</span>` : ''}${extra}</div>`;
  },
  ageOf(c, r) {
    if (!r.ts) return '';
    const min = (Date.now() / 1000 - r.ts) / 60;
    return `<span class="${min < 90 ? 'fresh' : ''}">${ago(r.ts)}</span>`;
  },

  mount(el) {
    el.innerHTML = `${cardHTML('cams:sys', '<div class="sysrow" data-r="sys"></div>', 'syscard')}
      ${this.shell('door')}${BLINKS.map(c => this.shell(c.id)).join('')}`;
  },
  render() {
    const sys = this.sys(), a = SEC_ACC[sys.mood], card = this.el.querySelector('[data-dv="cams:sys"]');
    const word = { armed: 'Armed', disarmed: 'Disarmed', arming: sys.state === 'disarming' ? 'Disarming' : 'Arming', triggered: 'Triggered', offline: offWord(BLINK) }[sys.mood];
    const watching = BLINKS.filter(c => this.cam(c).badge === 'active').length;
    put(card.querySelector('[data-r="fx"]'), skyHTML(sys.mood === 'triggered' ? grad('#241D20', '#3C2C31', '#614A50') : sys.armed ? grad('#161C26', '#1F2A3A', '#2E4058') : grad('#17181A', '#212326', '#33363B'), a, sys.armed ? { pool: 'drift', poolA: 0.12 } : sys.mood === 'triggered' ? { pool: 'pulse', poolA: 0.2 } : {}));
    put(card.querySelector('[data-r="sys"]'), `<span class="shield" style="--a:${a}">${svg(sys.armed || sys.mood === 'triggered' ? 'shield' : 'shieldOff', 30)}</span>
      <div class="dg-info"><div class="dg-name">Blink System</div><div class="dg-title">${word}</div><div class="dg-sub">${sys.armed ? watching + ' of ' + BLINKS.length + ' watching' : sys.mood === 'offline' ? 'The sync module is not reachable' : 'Cameras on standby'}</div></div>
      <button class="armbtn${sys.armed ? ' on' : ''}${tWaiting(sys.d, 'arm') ? ' wait' : ''}" data-a="arm" style="--a:${a}"${sys.mood === 'offline' ? ' disabled' : ''}>${sys.armed || sys.mood === 'triggered' ? 'Disarm' : 'Arm'}</button>
      ${sys.alert ? `<button class="sysalert" data-a="silence">${svg('alert', 18)}<span><b>Indoor motion detected</b>Tap to silence the Nest Mini</span></button>` : ''}`);
    card.classList.toggle('alerting', sys.alert);
    shadow(card, a);

    for (const door of cardsOf('cams:door')) this.paintDoor(door);
    for (const c of BLINKS) for (const el of cardsOf('cams:' + c.id)) this.paintCam(el, c);
    this.sum = sys.mood === 'offline' ? 'Offline' : sys.alert ? 'Indoor motion' : sys.armed ? `Armed · ${watching} watching` : { disarmed: 'Disarmed', arming: 'Arming', triggered: 'Triggered' }[sys.mood];
  },
  // The cards' frames, for Favorites' copies.
  shell(id) { return id === 'door' ? cardHTML('cams:door', '<div data-r="snap"></div><div data-r="tiles"></div>', 'camcard') : cardHTML('cams:' + id, `<div data-r="snap"></div><div class="camctl" data-r="ctl"></div>${BLINKS.find(c => c.id === id).pauseOnCard ? '<div class="campause" data-r="pause"></div>' : ''}`, 'camcard'); },
  paintDoor(door) {
    const dpic = haPic(attr(DOORBELL.cam, 'entity_picture'), (st(DOORBELL.cam) || {}).lu);
    put(door.querySelector('[data-r="fx"]'), skyHTML(grad('#17181A', '#212326', '#33363B'), '190,194,204', {}));
    put(door.querySelector('[data-r="snap"]'), this.snap(DOORBELL.name, dpic, '', '', `<button class="livebtn" data-a="open">${svg('video', 16)}Live</button>`));
    put(door.querySelector('[data-r="tiles"]'), `<div class="ctiles"><div><small>LAST RING</small><b>${evWhen(DOORBELL.chime)}</b></div><div><small>LAST MOTION</small><b>${evWhen(DOORBELL.motion)}</b><em>${esc(evWhat(DOORBELL.motion))}</em></div></div>`);
    door.classList.toggle('offline', gone(DOORBELL.cam));
  },
  paintCam(el, c) {
    const sys = this.sys(), r = this.cam(c);
    put(el.querySelector('[data-r="fx"]'), skyHTML(grad('#17181A', '#212326', '#33363B'), '190,194,204', {}));
    put(el.querySelector('[data-r="snap"]'), this.snap(c.name, r.pic, r.badge, this.ageOf(c, r), r.motion && r.on ? `<span class="cmotion">${svg('motion', 14)}Motion</span>` : ''));
    put(el.querySelector('[data-r="ctl"]'), `<button class="ghost" data-a="snapshot"${r.offline ? ' disabled' : ''}>${svg('iris', 18)}Snapshot</button>
      <button class="ghost sw-pill${r.on ? ' on' : ''}${tWaiting(r.d, 'sw') ? ' wait' : ''}" data-a="motion" role="switch" aria-checked="${r.on}"${gone(c.sw) ? ' disabled' : ''}>${svg('motion', 18)}Motion${accentSw(r.on, sys.armed ? '48,209,88' : '255,180,78')}</button>`);
    const pz = el.querySelector('[data-r="pause"]');
    if (pz) put(pz, `<div class="cp-h">Pause motion detection</div>${chipsHTML('pause', PAUSES, null, { dis: !r.on || unav(c.pause) })}`);
    el.classList.toggle('offline', r.offline);
  },

  sheet(id) {
    if (id === 'sys') return null;
    if (id === 'door') {
      const L = this.live, pic = haPic(attr(DOORBELL.cam, 'entity_picture'), (st(DOORBELL.cam) || {}).lu);
      return {
        title: DOORBELL.name, accent: '190,194,204', fx: skyHTML(grad('#121316', '#1C1D21', '#2C2E34'), '190,194,204', {}, 150),
        pill: pillHTML2(L ? (L.status === 'playing' ? 'Live' : L.status === 'error' ? 'No live view' : 'Connecting') : 'Doorbell', L && L.status === 'playing' ? '255,92,92' : ''),
        parts: [
          // While live the video's HTML stays the same, so the element (and its stream) is kept.
          ['view', L && L.status !== 'error' ? `<div class="camv"><video data-live playsinline muted autoplay></video>${L.status !== 'playing' ? `<div class="camwait">${svg('video', 26)}Connecting…</div>` : ''}</div>` : `<div class="camv">${this.snap('', pic, '', '')}</div>`],
          ['live', `<div class="camacts"><button class="ghost big" data-a="${L && L.status !== 'error' ? 'stop' : 'live'}"${mode !== 'live' ? ' disabled' : ''}>${svg(L && L.status !== 'error' ? 'stop' : 'video', 18)}${L && L.status !== 'error' ? 'Stop' : 'Watch live'}</button></div>
            ${L && L.status === 'error' ? `<p class="tnote">${esc(L.msg)}</p>` : mode !== 'live' ? '<p class="tnote">Live view needs Home Assistant connected.</p>' : ''}`],
          ['tiles', lbl('EVENTS') + grp(readRow('bell', 'Last ring', evWhen(DOORBELL.chime) + (evWhat(DOORBELL.chime) ? ' · ' + esc(evWhat(DOORBELL.chime)) : ''))
            + readRow('motion', 'Last motion', evWhen(DOORBELL.motion) + (evWhat(DOORBELL.motion) ? ' · ' + esc(evWhat(DOORBELL.motion)) : '')))
            + '<p class="tnote">The doorbell keeps recording whatever this shows; it can only be turned off in Google Home.</p>'],
        ],
      };
    }
    const c = BLINKS.find(x => x.id === id), r = this.cam(c), sys = this.sys();
    const dbm = num(c.wifi), wifi = isNaN(dbm) ? '—' : Math.round(dbm) + ' dBm · ' + (dbm >= -60 ? 'Strong' : dbm >= -70 ? 'Fair' : 'Weak');
    const mo = st(c.motion), low = isOn(c.battery), tu = attr(c.temp, 'unit_of_measurement') || '°';
    return {
      title: c.name, accent: r.badge === 'active' ? '48,209,88' : r.badge === 'standby' ? '255,180,78' : '154,160,166',
      fx: skyHTML(grad('#121316', '#1C1D21', '#2C2E34'), '190,194,204', {}, 150), pill: pillHTML2(r.badge === 'active' ? 'Active' : r.badge === 'standby' ? 'Standby' : 'Off', r.badge === 'active' ? '48,209,88' : r.badge === 'standby' ? '255,180,78' : ''),
      parts: [
        ['view', `<div class="camv">${this.snap('', r.pic, '', this.ageOf(c, r))}</div>`],
        ['acts', `<div class="camacts"><button class="ghost big" data-a="snapshot"${r.offline ? ' disabled' : ''}>${svg('iris', 18)}Take a snapshot</button></div><p class="tnote">Blink sends stills, not video. A new one takes about 8 seconds.</p>`],
        ['motion', grp(swRow('motion', 'Motion detection', 'motion', r.on, sys.armed ? '48,209,88' : '255,180,78', { dis: gone(c.sw), wait: tWaiting(r.d, 'sw'), sub: r.on && !sys.armed ? 'On, but the system is disarmed' : '' }), true)],
        ['pause', lbl('PAUSE MOTION DETECTION') + chipsHTML('pause', PAUSES, null, { dis: !r.on })],
        ['read', lbl('READINGS') + grp(readRow('motion', 'Last motion', mo && mo.state === 'on' ? 'Detected' : mo && mo.lc ? ago(mo.lc) : '—')
          + readRow('battery', 'Battery', gone(c.battery) ? '—' : low ? 'Low' : 'OK', low ? 'due' : '')
          + readRow('therm', 'Temperature', isNaN(num(c.temp)) ? '—' : Math.round(num(c.temp)) + esc(tu))
          + readRow('wifi', 'Wi-Fi', wifi))],
      ],
    };
  },
  act(id, a, b) {
    if (id === 'sys') {
      const s = this.sys();
      if (a === 'silence') return fire('Blink', 'input_boolean', 'turn_off', { entity_id: BLINK_ALERT });
      if (a === 'arm') { const arm = !(s.armed || s.mood === 'triggered'); tset(s.d, 'arm', arm ? 'armed_away' : 'disarmed'); render(); return tsend(s.d, 'alarm_control_panel', arm ? 'alarm_arm_away' : 'alarm_disarm', { entity_id: BLINK }, ['arm']); }
      return;
    }
    if (id === 'door') {
      if (a === 'live') return this.startLive();
      if (a === 'stop') { this.stopLive(); return render(); }
      return;
    }
    const c = BLINKS.find(x => x.id === id), r = this.cam(c);
    if (a === 'snapshot') { toast(`${c.name}: asking for a new snapshot…`); return fire(c.name, 'script', 'turn_on', { entity_id: 'script.blink_snapshot', variables: { camera: c.cam } }); }
    if (a === 'motion') { tset(r.d, 'sw', r.on ? 'off' : 'on'); render(); return tsend(r.d, 'switch', r.on ? 'turn_off' : 'turn_on', { entity_id: c.sw }, ['sw']); }
    if (a === 'pause') {
      const m = Number(b.dataset.v);
      toast(`${c.name}: motion detection off for ${m < 60 ? m + ' minutes' : m / 60 + (m === 60 ? ' hour' : ' hours')}`);
      tset(r.d, 'sw', 'off'); render();
      return fire(c.name, 'script', 'turn_on', { entity_id: c.pause, variables: { minutes: m } });
    }
  },

  // ---- the doorbell's live view ----
  // As Home Assistant's own player: ask what the camera offers; WebRTC is an
  // offer sent as a subscription (camera/webrtc/offer) that answers with the
  // session, the answer and ICE candidates, ours going back with
  // camera/webrtc/candidate; HLS is a playlist address (camera/stream) the
  // iPhone plays itself. A Nest wants the data channel its config names.
  live: null,
  async startLive() {
    this.stopLive();
    const L = this.live = { status: 'starting', pc: null, end: null };
    renderDev();
    const fail = msg => { if (this.live !== L) return; this.stopLive(); this.live = { status: 'error', msg }; render(); };
    const video = () => dsheet.querySelector('video[data-live]');
    try {
      const caps = await HA.send({ type: 'camera/capabilities', entity_id: DOORBELL.cam });
      const types = (caps && caps.frontend_stream_types) || [];
      if (types.includes('web_rtc')) {
        const cfg = await HA.send({ type: 'camera/webrtc/get_client_config', entity_id: DOORBELL.cam });
        if (this.live !== L) return;
        const pc = L.pc = new RTCPeerConnection((cfg && cfg.configuration) || {});
        if (cfg && cfg.dataChannel) pc.createDataChannel(cfg.dataChannel);
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });
        const stream = new MediaStream();
        pc.ontrack = ev => { stream.addTrack(ev.track); const v = video(); if (v) { v.srcObject = stream; v.play().catch(() => {}); } if (this.live === L) { L.status = 'playing'; render(); } };
        let session = null; const queued = [];
        const sendCand = c => HA.send({ type: 'camera/webrtc/candidate', entity_id: DOORBELL.cam, session_id: session, candidate: c }).catch(() => {});
        pc.onicecandidate = ev => { if (!ev.candidate) return; const c = ev.candidate.toJSON(); session ? sendCand(c) : queued.push(c); };
        pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') fail('The live view dropped. Try again.'); };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        L.end = await HA.subscribe({ type: 'camera/webrtc/offer', entity_id: DOORBELL.cam, offer: offer.sdp }, ev => {
          if (this.live !== L) return;
          if (ev.type === 'session') { session = ev.session_id; queued.splice(0).forEach(sendCand); }
          else if (ev.type === 'answer') pc.setRemoteDescription({ type: 'answer', sdp: ev.answer }).catch(e => fail('The camera\'s answer did not work: ' + e.message));
          else if (ev.type === 'candidate') pc.addIceCandidate(ev.candidate).catch(() => {});
          else if (ev.type === 'error') fail('Home Assistant could not start the live view: ' + (ev.message || ev.code));
        });
      } else if (types.includes('hls')) {
        const r = await HA.send({ type: 'camera/stream', entity_id: DOORBELL.cam });
        if (this.live !== L) return;
        const v = video(); if (!v) return;
        v.src = saved().url + r.url;
        v.addEventListener('playing', () => { if (this.live === L) { L.status = 'playing'; render(); } }, { once: true });
        v.addEventListener('error', () => fail('This browser could not play the camera\'s stream.'), { once: true });
        v.play().catch(() => {});
      } else fail('Home Assistant has no live stream for this camera.');
    } catch (e) { fail(e.message); }
  },
  stopLive() {
    const L = this.live; this.live = null;
    if (!L) return;
    try { if (L.end) L.end(); } catch {}
    try { if (L.pc) L.pc.close(); } catch {}
    const v = dsheet.querySelector('video[data-live]'); if (v) { v.srcObject = null; v.removeAttribute('src'); }
  },
  close(id) { if (id === 'door') this.stopLive(); },

  samples: e => {
    const t = Math.round(Date.now() / 1000), cam = (ago, extra = {}) => e('idle', { thumbnail: `/api/blink/thumb?ts=${t - ago * 60}`, ...extra });
    const out = {
      [BLINK]: e('armed_away', { supported_features: 2 }), [BLINK_ALERT]: e('off'),
      [DOORBELL.cam]: e('streaming', { frontend_stream_type: 'web_rtc' }),
      [DOORBELL.chime]: e(new Date(Date.now() - 3.2 * 3600e3).toISOString(), { event_type: 'doorbell_chime' }),
      [DOORBELL.motion]: e(new Date(Date.now() - 14 * 60e3).toISOString(), { event_type: 'camera_person' }),
    };
    [[12, 'on', 'off'], [140, 'on', 'off'], [35, 'off', 'off'], [600, 'on', 'on']].forEach(([age, sw, low], i) => {
      const c = BLINKS[i];
      Object.assign(out, { [c.pause]: e('off'), [c.cam]: cam(age), [c.sw]: e(sw), [c.motion]: e(i === 0 ? 'on' : 'off'), [c.battery]: e(low), [c.temp]: e(54 + i * 6, { unit_of_measurement: '°F' }), [c.wifi]: e(-52 - i * 9, { unit_of_measurement: 'dBm' }) });
    });
    return out;
  },
  preview(domain, service, d) {
    if (domain === 'script' && service === 'turn_on') {
      const c = BLINKS.find(x => x.pause === d.entity_id); if (c) { patchEnt(c.sw, 'off'); return true; }
      if (d.entity_id === 'script.blink_snapshot') { const b = BLINKS.find(x => x.cam === d.variables.camera); patchEnt(b.cam, null, { thumbnail: `/api/blink/thumb?ts=${Math.round(Date.now() / 1000)}` }); return true; }
    }
    return false;
  },
});
