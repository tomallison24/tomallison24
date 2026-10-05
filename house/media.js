// MEDIA: the Signal dashboard's SN3 cards (ha-config, views_signal/media.yaml)
// as two views, Speakers and TV. Same rules:
//   - a glass record with the album art as its label, turning while playing;
//     the art, blurred, tints the sky (half while playing, less when paused)
//   - a Sonos is "TV" when its source is TV (or it plays the TV stream); the
//     LG TV whenever it is on
//   - what each player can do is what it tells Home Assistant it can do
//     (supported_features): the Nest Mini has no skip or seek, the LG no
//     volume, and only the Apple TV and the Arc choose a source
//   - Sonos extras: favourites (sensor.sonos_favorites, which ships disabled -
//     empty until it is turned on), shuffle / repeat / crossfade / loudness,
//     volume presets lit within 3%, the sleep timer (script.signal_media_sleep,
//     which keeps its end time in input_text.signal_media_sleep), tone,
//     grouping (an offline peer can't be joined, so House party joins only
//     the reachable ones) and Hand off (script.sonos_handoff, tapped twice)
//   - the Arc's home theatre: night sound, speech, sub, surround, levels
// "Lounge" is media_player.living_room_sonos_living_room_sonos and "Apple TV"
// is media_player.living_room_living_room: the registry's names, not typos.
'use strict';
const SPEAKERS = [
  { id: 'kt', name: 'Kitchen', ent: 'media_player.kitchen_sonos_kitchen_sonos', pre: 'kitchen_sonos_kitchen_sonos', acc: '226,194,166', kind: 'sonos', mic: 'binary_sensor.kitchen_sonos_kitchen_sonos_microphone' },
  { id: 'lo', name: 'Lounge', ent: 'media_player.living_room_sonos_living_room_sonos', pre: 'living_room_sonos_living_room_sonos', acc: '190,182,222', kind: 'sonos' },
  { id: 'of', name: 'Office', ent: 'media_player.office_sonos_office_sonos', pre: 'office_sonos_office_sonos', acc: '176,196,224', kind: 'sonos', mic: 'binary_sensor.office_sonos_office_sonos_microphone' },
  { id: 'ar', name: 'Arc Sub', ent: 'media_player.sonos_arc_sub_sonos_arc_sub', pre: 'sonos_arc_sub_sonos_arc_sub', acc: '168,206,198', tvAcc: '178,204,230', kind: 'sonos', ht: true, mic: 'binary_sensor.sonos_arc_sub_sonos_arc_sub_microphone' },
  { id: 'mv', name: 'Move', ent: 'media_player.move', pre: 'move', acc: '224,186,198', kind: 'sonos', mic: 'binary_sensor.move_microphone', battery: 'sensor.move_battery', charging: 'binary_sensor.move_charging' },
  { id: 'nm', name: 'Nest Mini', ent: 'media_player.nest_mini', acc: '172,204,206', kind: 'nest' },
];
const TVS = [
  { id: 'atv', name: 'Apple TV', ent: 'media_player.living_room_living_room', acc: '196,198,206', kind: 'atv', apps: ['Netflix', 'YouTube', 'Spotify', 'Prime Video', 'Disney+', 'HBO Max'] },
  { id: 'tv', name: 'Living Room TV', ent: 'media_player.65_oled', acc: '170,188,230', kind: 'tv' },
];
const PLAYERS = [...SPEAKERS, ...TVS];
// MediaPlayerEntityFeature bits; a player that doesn't report them gets its kind's.
const MF = { pause: 1, seek: 2, vol: 4, mute: 8, prev: 16, next: 32, on: 128, off: 256, source: 2048, shuffle: 32768, repeat: 262144, group: 524288 };
const MF_KIND = { sonos: 1 | 2 | 4 | 8 | 16 | 32 | 32768 | 262144 | 524288, nest: 1 | 4 | 8 | 256, atv: 1 | 2 | 4 | 8 | 16 | 32 | 128 | 256 | 2048, tv: 128 | 256 | 2048 };
const SLEEP = 'input_text.signal_media_sleep';
const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// A muted sky in the player's own colour: the accent laid over the card's base.
const tone = (acc, k) => '#' + acc.split(',').map((v, i) => Math.round([0x16, 0x17, 0x1B][i] + (Number(v) - [0x16, 0x17, 0x1B][i]) * k).toString(16).padStart(2, '0')).join('');

function mediaFamily(cfg) {
  return family({
    ...cfg,
    read(p) {
      const d = dv(cfg.id, p.id, p.name), s = st(p.ent), A = s ? s.attributes : {};
      const offline = gone(p.ent);
      const state = offline ? (s ? s.state : 'unknown') : held(d, 'state', s.state);
      const playing = state === 'playing' || state === 'buffering';
      const on = !offline && state !== 'off' && state !== 'standby';
      const tv = p.kind === 'tv' ? ['on', 'playing', 'paused', 'idle'].includes(state) : p.kind === 'sonos' && on && (A.source === 'TV' || /htastream/.test(A.media_content_id || ''));
      const mood = offline ? 'offline' : tv ? 'tv' : playing ? 'playing' : state === 'paused' ? 'paused' : 'idle';
      const sf = Number.isFinite(A.supported_features) ? A.supported_features : MF_KIND[p.kind];
      const vol = held(d, 'vol', A.volume_level), muted = !!held(d, 'mute', A.is_volume_muted);
      const group = Array.isArray(A.group_members) && A.group_members.length ? A.group_members : [p.ent];
      const dur = Number(A.media_duration) || 0;
      let pos = Number(A.media_position) || 0;
      if (playing && A.media_position_updated_at) pos += (Date.now() - Date.parse(A.media_position_updated_at)) / 1000;
      pos = held(d, 'pos', dur ? Math.min(pos, dur) : pos);
      return { d, A, state, offline, playing, on, tv, mood, can: k => (sf & MF[k]) !== 0, vol, muted, group, dur, pos,
        art: haPic(A.entity_picture), shuffle: !!held(d, 'shuffle', A.shuffle), repeat: held(d, 'repeat', A.repeat || 'off') };
    },
    acc(p, r) { return r.mood === 'tv' && p.tvAcc ? p.tvAcc : p.acc; },
    sky(p, r) {
      const a = this.acc(p, r);
      if (r.mood === 'offline') return grad('#121316', '#1C1D21', '#2C2E34');
      if (r.mood === 'idle') return grad(tone(a, 0.03), tone(a, 0.08), tone(a, 0.16));
      const k = r.mood === 'paused' ? 0.6 : 1;
      return grad(tone(a, 0.06 * k), tone(a, 0.14 * k), tone(a, 0.28 * k));
    },
    words(p, r) {
      const A = r.A;
      if (r.offline) return { title: offWord(p.ent), sub: p.id === 'mv' ? 'Asleep or out of range' : 'Not reachable' };
      if (p.kind === 'tv') return { title: r.on ? (A.media_title || A.source || 'On') : 'Off', sub: r.on ? [A.source, r.playing ? 'Playing' : ''].filter(Boolean).map(esc).join(' · ') : 'Standby' };
      if (r.tv) return { title: 'TV', sub: 'Sound from the TV' + (val('sensor.' + p.pre + '_audio_input_format') ? ' · ' + esc(val('sensor.' + p.pre + '_audio_input_format')) : '') };
      if (r.playing || r.mood === 'paused') return { title: esc(A.media_title || A.media_channel || 'Playing'), sub: [A.media_artist, A.app_name && p.kind !== 'sonos' ? A.app_name : A.source].filter(Boolean).map(esc).join(' · ') || (r.playing ? 'Playing' : 'Paused') };
      return { title: r.state === 'off' ? 'Off' : 'Not playing', sub: [A.source, A.app_name].filter(Boolean).map(esc).join(' · ') || 'Idle' };
    },
    withWho(p, r) {
      if (r.group.length < 2) return '';
      const names = r.group.filter(e => e !== p.ent).map(e => (PLAYERS.find(x => x.ent === e) || { name: e }).name);
      return (r.group[0] === p.ent ? 'With ' : 'Following ') + names.join(', ');
    },
    // The record: the art as its label, grooves catching the light.
    vinyl(p, r, size) {
      const a = this.acc(p, r), spin = r.playing && !r.tv;
      const label = r.art ? `style="background-image:url('${esc(r.art)}')"` : `style="background:radial-gradient(circle at 35% 30%, rgba(${a},0.95), rgba(${a},0.45))"`;
      const glyph = r.art ? '' : svg(p.kind === 'tv' || r.tv ? 'tv' : p.kind === 'atv' ? 'apps' : 'music', size === 'lg' ? 40 : 22);
      return `<div class="vinyl ${size}${spin ? ' spin' : ''}${r.mood === 'paused' ? ' paused' : ''}" style="--a:${a}"><div class="rec"><i class="grooves"></i><div class="lab" ${label}>${glyph}</div></div>${size === 'lg' ? `<i class="arm${spin ? ' on' : ''}"></i>` : ''}</div>`;
    },
    fx(p, r, top) {
      const a = this.acc(p, r);
      return skyHTML(this.sky(p, r), a, { pool: r.playing ? 'breathe' : r.mood === 'tv' ? 'pulse' : '', poolA: r.mood === 'tv' ? 0.14 : 0.1, art: r.playing || r.mood === 'paused' ? r.art : '', artPaused: r.mood === 'paused', seed: 61 }, top);
    },
    controls(p, r) {
      const a = this.acc(p, r);
      if (p.kind === 'tv') return pwrBtn(r.on, a, (r.on ? 'Turn off ' : 'Turn on ') + p.name, { a: 'tvpower', dis: r.offline, wait: tWaiting(r.d, 'state') })
        + `<div class="srcline">${r.on && r.A.source ? esc(r.A.source) : r.on ? 'On' : 'Off'}</div>`;
      const dis = r.offline || r.tv;
      return pwrBtn(r.playing, a, r.playing ? 'Pause' : 'Play', { a: 'pp', icon: r.playing ? 'pause' : 'play', dis: dis || !r.can('pause'), wait: tWaiting(r.d, 'state') })
        + `<button class="disc sm" data-a="next" aria-label="Next"${dis || !r.can('next') ? ' disabled' : ''}>${svg('next', 20)}</button><i class="hair"></i>`
        + (r.can('vol') ? sliderHTML('vol', r.vol == null ? 0 : Math.round(r.vol * 100), 0, 100, 1, { cls: 'thin vol', tint: a, aria: p.name + ' volume', unit: '%', dis: r.offline }) : '<span class="srcline">No volume</span>');
    },

    mount(el) {
      el.innerHTML = cfg.list.map(p => this.shell(p)).join('');
      // The seek bar moves with the song while a popup is open.
      setInterval(() => { if (openD && openD.f === this && !rangeHeld) { const p = cfg.list.find(x => x.id === openD.id); if (p && this.read(p).playing) renderDev(); } }, 1000);
    },
    render() {
      let n = 0;
      for (const p of cfg.list) {
        const r = this.read(p);
        if (r.playing || (p.kind === 'tv' && r.on)) n++;
        for (const card of cardsOf(cfg.id + ':' + p.id)) this.paint(card, p);
      }
      this.sum = cfg.summary(n);
    },
    // One card, wherever it is (its own view, or Now Playing on Favorites).
    shell(p) { return cardHTML(cfg.id + ':' + p.id, `
        <div class="dg-top"><div data-r="hero"></div><div class="dg-info" data-r="info"></div></div>
        <div class="dg-ctl mctl" data-r="ctl"></div>`, 'mcard'); },
    paint(card, p) {
      const r = this.read(p), R = k => card.querySelector(`[data-r="${k}"]`), w = this.words(p, r);
      put(R('fx'), this.fx(p, r, 60));
      put(R('hero'), this.vinyl(p, r, 'sm'));
      const who = this.withWho(p, r), bat = p.battery && !gone(p.battery) ? `${svg('battery', 13)}${Math.round(num(p.battery))}%` : '';
      put(R('info'), infoHTML2(p.name, w.title, w.sub, (who || bat || r.muted) ? `<div class="alerts">${r.muted ? `<span class="alert">${svg('mute', 13)}Muted</span>` : ''}${who ? `<span class="alert">${svg('group', 13)}${esc(who)}</span>` : ''}${bat ? `<span class="alert">${bat}</span>` : ''}</div>` : ''));
      put(R('ctl'), this.controls(p, r));
      card.classList.toggle('offline', r.offline);
      card.classList.toggle('muted', r.muted);
      shadow(card, this.acc(p, r));
    },

    sheet(id) {
      const p = cfg.list.find(x => x.id === id), r = this.read(p), a = this.acc(p, r), A = r.A, w = this.words(p, r);
      const sonos = p.kind === 'sonos', dis = r.offline;
      const pill = r.offline ? 'Offline' : r.tv ? 'TV' : r.playing ? 'Playing' : r.mood === 'paused' ? 'Paused' : r.on ? 'Idle' : 'Off';
      const peers = SPEAKERS.filter(x => x.kind === 'sonos' && x.id !== p.id);
      const sl = this.sleepLeft(p);
      const favs = sonos ? Object.entries(attr('sensor.sonos_favorites', 'items') || {}).slice(0, 6) : [];
      const sw = (k, label, ic, o = {}) => { const id2 = 'switch.' + p.pre + '_' + k; return st(id2) ? swRow('sw', label, ic, held(r.d, k, val(id2)) === 'on', a, { v: k, dis: gone(id2), wait: tWaiting(r.d, k), ...o }) : ''; };
      const numSl = (k, label) => {
        const id2 = 'number.' + p.pre + '_' + k; if (!st(id2)) return '';
        const v = Number(held(r.d, k, val(id2))), mn = attr(id2, 'min') ?? -10, mx = attr(id2, 'max') ?? 10, stp = attr(id2, 'step') ?? 1;
        return sliderHTML('num', isNaN(v) ? 0 : v, mn, mx, stp, { v: k, label, tint: a, cls: 'inrow', dis: gone(id2), unit: attr(id2, 'unit_of_measurement') ? ' ' + attr(id2, 'unit_of_measurement') : '' });
      };
      const status = [
        A.source && p.kind !== 'tv' ? readRow('input', 'Source', esc(A.source)) : '',
        p.mic && st(p.mic) ? readRow('mic', 'Microphone', isOn(p.mic) ? 'On' : 'Off') : '',
        p.battery && st(p.battery) ? readRow('battery', 'Battery', gone(p.battery) ? '—' : Math.round(num(p.battery)) + '%' + (isOn(p.charging) ? ' · Charging' : '')) : '',
        A.queue_size != null ? readRow('music', 'In the queue', A.queue_size) : '',
      ].join('');
      return {
        title: p.name, accent: a, fx: this.fx(p, r, 150), pill: pillHTML2(pill),
        parts: [
          ['hero', `<div class="uhero">${this.vinyl(p, r, 'lg')}<div class="dg-title">${w.title}</div><div class="dg-sub">${w.sub}</div>
            ${this.withWho(p, r) ? `<div class="alerts" style="justify-content:center"><span class="alert">${svg('group', 13)}${esc(this.withWho(p, r))}</span></div>` : ''}</div>`],
          r.dur > 0 && r.can('seek') && !r.tv ? ['seek', sliderHTML('seek', Math.round(r.pos), 0, Math.round(r.dur), 1, { cls: 'seek', tint: a, label: mmss(r.pos), shown: mmss(r.dur), aria: 'Position', dis })] : null,
          p.kind !== 'tv' ? ['transport', `<div class="transport">
              <button class="disc" data-a="prev" aria-label="Previous"${dis || r.tv || !r.can('prev') ? ' disabled' : ''}>${svg('prev', 22)}</button>
              <button class="disc" data-a="seek15" data-v="-15" aria-label="Back 15 seconds"${dis || r.tv || !r.can('seek') || !r.dur ? ' disabled' : ''}>${svg('back15', 22)}</button>
              ${pwrBtn(r.playing, a, r.playing ? 'Pause' : 'Play', { a: 'pp', icon: r.playing ? 'pause' : 'play', dis: dis || r.tv || !r.can('pause'), wait: tWaiting(r.d, 'state') }).replace('class="pwr', 'class="pwr big')}
              <button class="disc" data-a="seek15" data-v="15" aria-label="Forward 15 seconds"${dis || r.tv || !r.can('seek') || !r.dur ? ' disabled' : ''}>${svg('fwd15', 22)}</button>
              <button class="disc" data-a="next" aria-label="Next"${dis || r.tv || !r.can('next') ? ' disabled' : ''}>${svg('next', 22)}</button></div>`] : null,
          r.can('vol') ? ['vol', `<div class="volrow">${sliderHTML('vol', r.vol == null ? 0 : Math.round(r.vol * 100), 0, 100, 1, { label: 'VOLUME', shown: r.vol == null ? '--' : Math.round(r.vol * 100) + '%', unit: '%', tint: a, dis })}
            ${r.can('mute') ? `<button class="disc${r.muted ? ' lit' : ''}${tWaiting(r.d, 'mute') ? ' wait' : ''}" data-a="mute" aria-pressed="${r.muted}" aria-label="${r.muted ? 'Unmute' : 'Mute'}"${dis ? ' disabled' : ''}>${svg(r.muted ? 'mute' : 'vol', 20)}</button>` : ''}</div>`
            + (sonos ? chipsHTML('vpre', [[15, '15'], [25, '25'], [50, '50'], [75, '75'], [100, '100']], r.vol == null ? null : r.vol * 100, { near: 3, dis }) : '')] : null,
          p.kind === 'atv' ? ['apps', lbl('APPS') + `<div class="tiles nodrag">${p.apps.map(x => `<button class="tile${A.source === x || A.app_name === x ? ' on' : ''}" data-a="app" data-v="${esc(x)}"${dis ? ' disabled' : ''}>${esc(x)}</button>`).join('')}</div>`] : null,
          p.kind === 'tv' && Array.isArray(A.source_list) && r.on ? ['src', lbl('SOURCE') + `<div class="tiles nodrag">${A.source_list.slice(0, 9).map(x => `<button class="tile${A.source === x ? ' on' : ''}" data-a="app" data-v="${esc(x)}"${dis ? ' disabled' : ''}>${esc(x)}</button>`).join('')}</div>`] : null,
          p.kind !== 'sonos' ? ['power', grp(p.kind === 'nest'
            ? actRow('turnoff', 'Turn off', 'power', { dis: dis || r.state === 'off' })
            : swRow('tvpower', 'Power', 'power', r.on, '48,209,88', { dis, wait: tWaiting(r.d, 'state') }), true)] : null,
          sonos && favs.length ? ['favs', lbl('FAVOURITES') + `<div class="tiles nodrag">${favs.map(([fid, t]) => `<button class="tile${[A.media_title, A.media_album_name, A.media_playlist, A.media_channel].includes(t) ? ' on' : ''}" data-a="fav" data-v="${esc(fid)}"${dis ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>`] : null,
          sonos ? ['play', lbl('PLAYBACK') + grp(
            (r.can('shuffle') ? swRow('shuffle', 'Shuffle', 'shuffle', r.shuffle, a, { dis, wait: tWaiting(r.d, 'shuffle') }) : '')
            + sw('crossfade', 'Crossfade', 'crossfade') + sw('loudness', 'Loudness', 'loud'))
            + (r.can('repeat') ? `<div class="glbl">REPEAT</div>` + segHTML('repeat', [['off', 'Off'], ['all', 'All'], ['one', 'One']], r.repeat, { dis, wait: tWaiting(r.d, 'repeat') }) : '')] : null,
          sonos ? ['sleep', lbl('SLEEP TIMER' + (sl ? ' · ' + sl.left + ' MIN LEFT' : '')) + chipsHTML('sleep', [[15, '15 min'], [30, '30 min'], [60, '1 hour'], [0, 'Off']], sl ? sl.mins : 0, { dis })] : null,
          sonos && r.can('group') ? ['group', lbl('GROUP') + `<div class="chips nodrag">${peers.map(x => {
              const inG = r.group.includes(x.ent), off = gone(x.ent);
              return `<button class="chip2" data-a="grp" data-v="${x.ent}" aria-pressed="${inG}"${dis || off ? ' disabled' : ''}>${esc(x.name)}</button>`;
            }).join('')}<button class="chip2 party" data-a="party"${dis ? ' disabled' : ''}>${svg('party', 15)}House party</button></div>`] : null,
          sonos && r.mood !== 'idle' && !r.offline ? ['hand', lbl('HAND OFF TO') + `<div class="chips nodrag">${peers.map(x => {
              const k = 'ho' + p.id + x.id, arm = isArmed(k);
              return `<button class="chip2${arm ? ' armed' : ''}" data-a="handoff" data-v="${x.ent}"${gone(x.ent) ? ' disabled' : ''}>${arm ? 'Tap to move to ' : ''}${esc(x.name)}</button>`;
            }).join('')}</div><p class="tnote">Moves what is playing to that speaker and stops it here.</p>`] : null,
          sonos ? ['tone', lbl('TONE') + `<div class="group pad">${numSl('bass', 'Bass')}${numSl('treble', 'Treble')}${numSl('balance', 'Balance')}</div>`] : null,
          p.ht ? ['ht', lbl('HOME THEATRE') + grp(sw('night_sound', 'Night sound', 'night') + sw('speech_enhancement', 'Speech enhancement', 'speech')
            + sw('subwoofer_enabled', 'Subwoofer', 'sub') + sw('surround_enabled', 'Surround', 'surround')
            + sw('surround_music_full_volume', 'Surround music at full volume', 'music', { sub: held(r.d, 'surround_music_full_volume', val('switch.' + p.pre + '_surround_music_full_volume')) === 'on' ? 'Full' : 'Ambient' }))
            + `<div class="group pad">${numSl('sub_gain', 'Sub level')}${numSl('surround_level', 'Surround level')}${numSl('music_surround_level', 'Music surround level')}${numSl('audio_delay', 'Audio delay')}</div>`
            + grp(actRow('tvsrc', 'Switch to TV', 'tv', { dis: dis || A.source === 'TV', right: A.source === 'TV' ? 'On TV' : null })
              + readRow('input', 'Input format', esc(val('sensor.' + p.pre + '_audio_input_format') || '—')))] : null,
          status ? ['status', lbl('STATUS') + grp(status)] : null,
        ],
      };
    },
    sleepLeft(p) {
      const m = new RegExp('(?:^|;)' + p.id + '=(\\d+):(\\d+)').exec(val(SLEEP) || '');
      if (!m) return null;
      const ms = Number(m[1]) * 1000 - Date.now(), left = Math.max(1, Math.round(ms / 60000));
      return ms > 0 ? { left, mins: Number(m[2]) } : null;
    },
    act(id, a, b) {
      const p = cfg.list.find(x => x.id === id), r = this.read(p), d = r.d, e = p.ent;
      const send = (f, svc, data, v) => { if (f) { tset(d, f, v); render(); } return tsend(d, 'media_player', svc, { entity_id: e, ...data }, f ? [f] : []); };
      if (a === 'pp') return send('state', 'media_play_pause', {}, r.playing ? 'paused' : 'playing');
      if (a === 'next') return fire(p.name, 'media_player', 'media_next_track', { entity_id: e });
      if (a === 'prev') return fire(p.name, 'media_player', 'media_previous_track', { entity_id: e });
      if (a === 'seek15') { const to = Math.max(0, Math.min(r.dur, r.pos + Number(b.dataset.v))); return send('pos', 'media_seek', { seek_position: Math.round(to) }, to); }
      if (a === 'mute') return send('mute', 'volume_mute', { is_volume_muted: !r.muted }, !r.muted);
      if (a === 'vpre') return send('vol', 'volume_set', { volume_level: Number(b.dataset.v) / 100 }, Number(b.dataset.v) / 100);
      if (a === 'shuffle') return send('shuffle', 'shuffle_set', { shuffle: !r.shuffle }, !r.shuffle);
      if (a === 'repeat') { if (r.repeat !== b.dataset.v) send('repeat', 'repeat_set', { repeat: b.dataset.v }, b.dataset.v); return; }
      if (a === 'sw') { const k = b.dataset.v, id2 = 'switch.' + p.pre + '_' + k; tset(d, k, val(id2) === 'on' ? 'off' : 'on'); render(); return tsend(d, 'switch', 'toggle', { entity_id: id2 }, [k]); }
      if (a === 'fav') return fire(p.name, 'media_player', 'play_media', { entity_id: e, media_content_id: b.dataset.v, media_content_type: 'favorite_item_id' });
      if (a === 'sleep') return fire(p.name, 'script', 'signal_media_sleep', { player: e, key: p.id, minutes: Number(b.dataset.v) });
      if (a === 'grp') {
        const peer = b.dataset.v;
        return r.group.includes(peer) ? fire(p.name, 'media_player', 'unjoin', { entity_id: peer }) : fire(p.name, 'media_player', 'join', { entity_id: e, group_members: [peer] });
      }
      if (a === 'party') return fire(p.name, 'media_player', 'join', { entity_id: e, group_members: SPEAKERS.filter(x => x.kind === 'sonos' && x.ent !== e && !gone(x.ent)).map(x => x.ent) });
      if (a === 'handoff') {
        const x = PLAYERS.find(q => q.ent === b.dataset.v);
        if (twice('ho' + p.id + x.id)) { fire(p.name, 'script', 'turn_on', { entity_id: 'script.sonos_handoff', variables: { from_player: e, to_player: x.ent } }); toast(`Moving to the ${x.name}…`); }
        return;
      }
      if (a === 'app') return send('', 'select_source', { source: b.dataset.v });
      if (a === 'tvsrc') return send('', 'select_source', { source: 'TV' });
      if (a === 'tvpower') return send('state', r.on ? 'turn_off' : 'turn_on', {}, r.on ? 'off' : 'on');
      if (a === 'turnoff') return send('state', 'turn_off', {}, 'off');
    },
    slide(id, a, v, el) {
      const p = cfg.list.find(x => x.id === id), d = this.read(p).d;
      if (a === 'vol') { tset(d, 'vol', v / 100); return tsend(d, 'media_player', 'volume_set', { entity_id: p.ent, volume_level: v / 100 }, ['vol']); }
      if (a === 'seek') { tset(d, 'pos', v); return tsend(d, 'media_player', 'media_seek', { entity_id: p.ent, seek_position: v }, ['pos']); }
      if (a === 'num') { const k = el.dataset.v; tset(d, k, String(v)); return tsend(d, 'number', 'set_value', { entity_id: 'number.' + p.pre + '_' + k, value: v }, [k]); }
    },
    samples: cfg.samples,
    preview: cfg.preview,
  });
}

mediaFamily({
  id: 'speakers', name: 'Speakers', icon: 'speaker', group: 'Media', order: 1, list: SPEAKERS,
  summary: n => n ? n + ' playing' : 'Quiet',
  samples(e) {
    const now = new Date().toISOString(), K = 'media_player.kitchen_sonos_kitchen_sonos', O = 'media_player.office_sonos_office_sonos';
    const tracks = [['Harvest Moon', 'Neil Young'], ['Pink Moon', 'Nick Drake'], ['Holocene', 'Bon Iver']];
    const sonos = (pre, extra) => ({
      [`number.${pre}_bass`]: e(2, { min: -10, max: 10, step: 1 }), [`number.${pre}_treble`]: e(0, { min: -10, max: 10, step: 1 }), [`number.${pre}_balance`]: e(0, { min: -100, max: 100, step: 1 }),
      [`switch.${pre}_crossfade`]: e('off'), [`switch.${pre}_loudness`]: e('on'), ...extra });
    const playing = { media_title: 'Harvest Moon', media_artist: 'Neil Young', media_album_name: 'Harvest Moon', media_duration: 303, media_position: 84, media_position_updated_at: now, _tracks: tracks, source: 'Spotify' };
    return {
      [K]: e('playing', { ...playing, volume_level: 0.32, is_volume_muted: false, group_members: [K, O], shuffle: false, repeat: 'off', queue_size: 24 }),
      [O]: e('playing', { ...playing, volume_level: 0.2, is_volume_muted: false, group_members: [K, O], shuffle: false, repeat: 'off' }),
      'media_player.living_room_sonos_living_room_sonos': e('paused', { media_title: 'Kind of Blue', media_artist: 'Miles Davis', media_album_name: 'Kind of Blue', media_duration: 545, media_position: 210, media_position_updated_at: now, volume_level: 0.25, group_members: ['media_player.living_room_sonos_living_room_sonos'], shuffle: true, repeat: 'all', source: 'AirPlay' }),
      'media_player.sonos_arc_sub_sonos_arc_sub': e('playing', { source: 'TV', source_list: ['TV'], media_content_id: 'x-sonos-htastream:RINCON_1:spdif', volume_level: 0.4, group_members: ['media_player.sonos_arc_sub_sonos_arc_sub'] }),
      'media_player.move': e('unavailable'),
      'media_player.nest_mini': e('idle', { volume_level: 0.5 }),
      ...sonos('kitchen_sonos_kitchen_sonos', { 'binary_sensor.kitchen_sonos_kitchen_sonos_microphone': e('on') }),
      ...sonos('living_room_sonos_living_room_sonos'),
      ...sonos('office_sonos_office_sonos', { 'binary_sensor.office_sonos_office_sonos_microphone': e('off') }),
      ...sonos('sonos_arc_sub_sonos_arc_sub', {
        'binary_sensor.sonos_arc_sub_sonos_arc_sub_microphone': e('off'),
        'switch.sonos_arc_sub_sonos_arc_sub_night_sound': e('off'), 'switch.sonos_arc_sub_sonos_arc_sub_speech_enhancement': e('on'),
        'switch.sonos_arc_sub_sonos_arc_sub_subwoofer_enabled': e('on'), 'switch.sonos_arc_sub_sonos_arc_sub_surround_enabled': e('on'),
        'switch.sonos_arc_sub_sonos_arc_sub_surround_music_full_volume': e('off'),
        'number.sonos_arc_sub_sonos_arc_sub_sub_gain': e(2, { min: -15, max: 15, step: 1 }), 'number.sonos_arc_sub_sonos_arc_sub_surround_level': e(0, { min: -15, max: 15, step: 1 }),
        'number.sonos_arc_sub_sonos_arc_sub_music_surround_level': e(0, { min: -15, max: 15, step: 1 }), 'number.sonos_arc_sub_sonos_arc_sub_audio_delay': e(0, { min: 0, max: 5, step: 1 }),
        'sensor.sonos_arc_sub_sonos_arc_sub_audio_input_format': e('Dolby 5.1') }),
      ...sonos('move', { 'binary_sensor.move_microphone': e('unavailable'), 'sensor.move_battery': e('unavailable'), 'binary_sensor.move_charging': e('unavailable') }),
      [SLEEP]: e(''),
    };
  },
  // The two scripts, as Home Assistant would run them. The hand-off waits
  // to see the new speaker playing, so it is started (script.turn_on), not waited for.
  preview(domain, service, d) {
    if (domain !== 'script') return false;
    if (service === 'signal_media_sleep') {
      const p = SPEAKERS.find(x => x.ent === d.player), kept = (val(SLEEP) || '').split(';').filter(x => x && !x.startsWith(p.id + '='));
      if (d.minutes > 0) kept.push(`${p.id}=${Math.round(Date.now() / 1000 + d.minutes * 60)}:${d.minutes}`);
      patchEnt(SLEEP, kept.join(';'));
      return true;
    }
    if (service === 'turn_on' && d.entity_id === 'script.sonos_handoff') {
      d = d.variables;
      const from = st(d.from_player).attributes;
      patchEnt(d.to_player, 'playing', { media_title: from.media_title, media_artist: from.media_artist, media_album_name: from.media_album_name, media_duration: from.media_duration, media_position: from.media_position, media_position_updated_at: from.media_position_updated_at, group_members: [d.to_player] });
      patchEnt(d.from_player, 'paused', { group_members: [d.from_player] });
      return true;
    }
    return false;
  },
});

mediaFamily({
  id: 'tv', name: 'TV', icon: 'tv', group: 'Media', order: 2, list: TVS,
  summary: n => n ? (n === 1 ? 'On' : n + ' on') : 'Off',
  samples: e => ({
    'media_player.living_room_living_room': e('playing', { media_title: 'The Bear', media_artist: 'Season 3 · Episode 4', app_name: 'Disney+', source: 'Disney+', source_list: TVS[0].apps, media_duration: 1860, media_position: 600, media_position_updated_at: new Date().toISOString(), volume_level: 0.5 }),
    'media_player.65_oled': e('on', { source: 'Apple TV', source_list: ['Apple TV', 'HDMI 2', 'Live TV', 'YouTube', 'Netflix'] }),
  }),
});
