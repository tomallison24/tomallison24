// AUTOMATIONS: every Home Assistant automation, what it does, when it runs,
// the devices it works and whether it is on - to see at a glance, not to
// change (nothing here turns one on or off, or runs it).
//
// The list and each one's status (on or off, running, when it last ran) are
// Home Assistant's own automation.* entities, live. What each one does comes
// from its config: Home Assistant hands that only to an admin's token
// (automation/config is require_admin), so it is asked for once the view is
// opened, and otherwise read from automations-data.js, Home's copy of
// ha-config's automations.yaml and scripts.yaml (tools/automations.py writes
// it; re-run it after the automations change). The two are matched on the
// automation's id. In the preview, the copy is the list.
//
// Devices are read out of the config: every entity_id, and every entity a
// template names. Those in the actions (and in the scripts the actions start)
// are what it controls; those in the triggers and conditions, what it
// watches. Input helpers, timers and the like are listed apart, as Helpers.
// Each automation goes in a group by what it controls (Lights, Climate...);
// one that works three kinds of device or more is a Routine.
'use strict';

const AU_DEVICE = new Set(['light', 'switch', 'climate', 'cover', 'fan', 'humidifier', 'media_player', 'camera', 'alarm_control_panel', 'lock', 'vacuum',
  'siren', 'water_heater', 'remote', 'sensor', 'binary_sensor', 'select', 'number', 'button', 'valve', 'lawn_mower', 'update', 'event', 'image']);
const AU_PEOPLE = new Set(['person', 'device_tracker']);
// Read, never worked: a step that names one is reading it.
const AU_READONLY = new Set(['sensor', 'binary_sensor', 'person', 'device_tracker', 'event', 'update', 'image', 'sun', 'weather', 'zone', 'calendar']);
const AU_HELPER = new Set(['input_boolean', 'input_number', 'input_text', 'input_select', 'input_datetime', 'input_button', 'timer', 'counter', 'schedule',
  'automation', 'scene', 'script', 'group', 'zone', 'sun', 'weather', 'calendar', 'todo', 'notify', 'tts']);
const AU_RE = new RegExp(`\\b(${[...AU_DEVICE, ...AU_PEOPLE, ...AU_HELPER].join('|')})\\.([a-z0-9_]+)\\b`, 'g');
const AU_SERVICES = /^(turn_on|turn_off|toggle|reload|send_message|speak|set_value|set_datetime|select_option|trigger|start|cancel|pause|finish|press|increment|decrement|reset)$/;
const AU_ICON = { light: 'lightbulb', climate: 'thermostat', cover: 'blinds', fan: 'fan', humidifier: 'dehum', media_player: 'speaker', camera: 'camera',
  alarm_control_panel: 'shield', lock: 'lock', vacuum: 'vacuum', binary_sensor: 'motion', sensor: 'eye', switch: 'plug', select: 'tune', number: 'tune',
  person: 'guest', device_tracker: 'guest', sun: 'sun', weather: 'outside', timer: 'timer', script: 'play', notify: 'bell' };
// The groups, in this order. acc: the glass colour; in Vintage the Retro one (dual).
const AU_GROUPS = [
  { id: 'routine', name: 'Routines', icon: 'home' },
  { id: 'climate', name: 'Climate', icon: 'thermostat' },
  { id: 'lights', name: 'Lights', icon: 'lightbulb' },
  { id: 'blinds', name: 'Blinds', icon: 'blinds' },
  { id: 'security', name: 'Security', icon: 'shield' },
  { id: 'media', name: 'Media', icon: 'speaker' },
  { id: 'nursery', name: 'Nursery', icon: 'baby' },
  { id: 'around', name: 'Around the house', icon: 'vacuum' },
  { id: 'alerts', name: 'Notifications', icon: 'bell' },
  { id: 'helpers', name: 'Behind the scenes', icon: 'apps' },
  { id: 'missing', name: 'Not in Home Assistant', icon: 'alert' },
];
const AU_ACC = dual(
  { routine: '196,190,226', climate: '255,179,138', lights: '245,166,35', blinds: '156,212,202', security: '255,140,130', media: '170,188,230', nursery: '214,200,196',
    around: '184,206,202', alerts: '236,214,150', helpers: '190,194,204', missing: '240,179,187' },
  { routine: '47,140,134', climate: '216,87,42', lights: '227,167,47', blinds: '47,140,134', security: '216,87,42', media: '126,140,52', nursery: '227,167,47',
    around: '126,140,52', alerts: '227,167,47', helpers: '165,150,128', missing: '216,87,42' });
const AU_KIND = { light: 'lights', climate: 'climate', fan: 'climate', humidifier: 'climate', water_heater: 'climate', cover: 'blinds', camera: 'security',
  alarm_control_panel: 'security', lock: 'security', siren: 'security', media_player: 'media', remote: 'media', vacuum: 'around', lawn_mower: 'around', valve: 'around' };
// A switch, sensor or select is the device it belongs to, by its name.
const AU_NAMED = [[/hatch/, 'nursery'], [/camera|motion|blink/, 'security'], [/dyson|heater|thermostat|dehumid|_ac_|windmill/, 'climate'], [/blind/, 'blinds'],
  [/sonos|_tv|move_/, 'media'], [/vacuum|shark|ecovacs/, 'around'], [/lamp|light/, 'lights']];
function auKindOf(id) {
  const d = auDomain(id);
  if (/hatch/.test(id)) return 'nursery';
  if (AU_KIND[d]) return AU_KIND[d];
  if (['switch', 'select', 'number', 'button', 'sensor', 'binary_sensor'].includes(d)) { const m = AU_NAMED.find(([re]) => re.test(id)); return m ? m[1] : null; }
  return null;
}
// An automation that works no device of its own, by its name ("Blinds - Push Slider Targets").
const AU_ALIAS = [[/hatch|nursery/, 'nursery'], [/blink|camera|motion|alarm/, 'security'], [/dyson|heater|thermostat|dehumid|hvac|windmill/, 'climate'],
  [/blind/, 'blinds'], [/light|lamp|strip/, 'lights'], [/sonos|speaker|\btv\b/, 'media'], [/vacuum|shark/, 'around']];
const AU_PLURAL = { light: 'lights', switch: 'switches', climate: 'climate units', fan: 'fans', cover: 'blinds', media_player: 'media players', camera: 'cameras',
  sensor: 'sensors', binary_sensor: 'sensors', person: 'people', device_tracker: 'people', humidifier: 'dehumidifiers', alarm_control_panel: 'alarms', vacuum: 'vacuums' };
const AU_ONOFF = new Set(['light', 'switch', 'fan', 'climate', 'media_player', 'humidifier']);
const AU_FILTERS = [['all', 'All'], ['today', 'Ran today'], ['off', 'Off']];

const auCap = s => String(s || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const auList = v => v == null ? [] : Array.isArray(v) ? v : [v];
const auDomain = id => id.split('.')[0];
const auName = id => { const s = st(id); return (s && s.attributes.friendly_name) || auCap(id.split('.')[1] || id); };
// "08:30:00" -> "8:30 AM"
function auClock(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t)); if (!m) return String(t);
  const h = Number(m[1]), ap = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${m[2]} ${ap}`;
}
// "-01:30:00", "00:45:00", 3600 -> "1 h 30 min" (and whether it is before)
function auSpan(v) {
  if (v == null) return null;
  let s;
  if (typeof v === 'number') s = v;
  else if (typeof v === 'object') s = (v.hours || 0) * 3600 + (v.minutes || 0) * 60 + (v.seconds || 0);
  else { const m = /^(-)?(\d+):(\d+)(?::(\d+))?$/.exec(String(v).trim()); if (!m) return null; s = (m[1] ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0)); }
  const a = Math.abs(s), h = Math.floor(a / 3600), mi = Math.round((a % 3600) / 60);
  return { before: s < 0, zero: a === 0, text: [h ? h + ' h' : '', mi ? mi + ' min' : '', !h && !mi ? a + ' s' : ''].filter(Boolean).join(' ') };
}
const AU_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
function auDays(w) {
  const d = auList(w).map(x => String(x).toLowerCase());
  if (!d.length) return '';
  const key = AU_DAYS.filter(x => d.includes(x)).join(',');
  if (key === 'mon,tue,wed,thu,fri') return 'weekdays';
  if (key === 'sat,sun') return 'weekends';
  return d.map(x => auCap(x)).join(', ');
}
const auNames = ids => { const n = ids.map(auName); return n.length > 2 ? n.slice(0, 2).join(', ') + ` +${n.length - 2}` : n.join(' or '); };
// The entities a template names, in the order it names them.
const auInTpl = s => [...new Set([...String(s).matchAll(AU_RE)].map(m => m[0]).filter(x => !/_$/.test(x) && !AU_SERVICES.test(x.split('.')[1])))];
const auWord = v => ({ on: 'turns on', off: 'turns off', home: 'arrives home', not_home: 'leaves home', open: 'opens', closed: 'closes',
  playing: 'starts playing', paused: 'pauses', idle: 'goes idle', unavailable: 'goes offline', armed_away: 'is armed', disarmed: 'is disarmed', triggered: 'goes off' })[v];

// ---- what starts it ----
function auTrigger(t) {
  if (typeof t !== 'object' || !t) return 'A trigger';
  const kind = t.trigger || t.platform, ids = auList(t.entity_id).filter(x => typeof x === 'string');
  const forTxt = t.for != null && auSpan(t.for) ? ` for ${auSpan(t.for).text}` : '';
  if (kind === 'time') return auList(t.at).map(a => /\./.test(String(a)) ? `At ${auName(a)}'s time` : `At ${auClock(a)}`).join(' and ') + (t.weekday ? ` (${auDays(t.weekday)})` : '');
  if (kind === 'sun') {
    const ev = t.event === 'sunrise' ? 'sunrise' : 'sunset', o = auSpan(t.offset);
    return !o || o.zero ? `At ${ev}` : `${o.text} ${o.before ? 'before' : 'after'} ${ev}`;
  }
  if (kind === 'state') {
    const who = auNames(ids);
    if (t.attribute) return `When ${who}'s ${auCap(t.attribute).toLowerCase()} changes`;
    const to = auList(t.to);
    if (to.length === 1 && auWord(to[0])) return `When ${who} ${auWord(to[0])}${forTxt}`;
    if (to.length) return `When ${who} becomes ${to.map(x => auCap(x).toLowerCase()).join(' or ')}${forTxt}`;
    const from = auList(t.from);
    if (from.length) return `When ${who} stops being ${from.map(x => auCap(x).toLowerCase()).join(' or ')}${forTxt}`;
    return `When ${who} changes${forTxt}`;
  }
  if (kind === 'numeric_state') {
    const who = auNames(ids) + (t.attribute ? `'s ${auCap(t.attribute).toLowerCase()}` : '');
    const lim = v => /\./.test(String(v)) ? auName(v) : v;
    if (t.below != null && t.above != null) return `When ${who} is between ${lim(t.above)} and ${lim(t.below)}${forTxt}`;
    return t.below != null ? `When ${who} drops below ${lim(t.below)}${forTxt}` : `When ${who} goes above ${lim(t.above)}${forTxt}`;
  }
  if (kind === 'event') return `On the "${t.event_type}" event`;
  if (kind === 'homeassistant') return t.event === 'shutdown' ? 'When Home Assistant stops' : 'When Home Assistant starts';
  if (kind === 'time_pattern') {
    const every = (v, unit) => { const m = /^\/(\d+)$/.exec(String(v)); return m ? `Every ${m[1] === '1' ? '' : m[1] + ' '}${unit}${m[1] === '1' ? '' : 's'}` : null; };
    return every(t.seconds, 'second') || every(t.minutes, 'minute') || every(t.hours, 'hour') || (t.minutes != null ? `Every hour at :${String(t.minutes).padStart(2, '0')}` : 'On a schedule');
  }
  if (kind === 'template') { const n = auInTpl(t.value_template); return n.length ? `When a check on ${auNames(n)} passes${forTxt}` : `When a template check passes${forTxt}`; }
  if (kind === 'zone') return `When ${auNames(ids)} ${t.event === 'leave' ? 'leaves' : 'enters'} ${auName(t.zone || '')}`;
  if (kind === 'conversation') return `When you say "${auList(t.command)[0]}"`;
  if (kind === 'tag') return 'When a tag is scanned';
  if (kind === 'webhook') return 'When a webhook is called';
  return auCap(kind || 'trigger');
}
// ---- what must be true ----
function auCondition(c) {
  if (typeof c === 'string') { const n = auInTpl(c); return n.length ? `A check on ${auNames(n)}` : 'A template check'; }
  if (typeof c !== 'object' || !c) return 'A condition';
  const kind = c.condition, ids = auList(c.entity_id);
  if (kind === 'state') return `${auNames(ids)}${c.attribute ? `'s ${auCap(c.attribute).toLowerCase()}` : ''} is ${auList(c.state).map(x => auCap(x === 'not_home' ? 'away' : x).toLowerCase()).join(' or ')}`;
  if (kind === 'numeric_state') return `${auNames(ids)} is ${c.below != null ? 'below ' + c.below : ''}${c.below != null && c.above != null ? ' and ' : ''}${c.above != null ? 'above ' + c.above : ''}`;
  if (kind === 'time') {
    const p = [];
    if (c.after) p.push('after ' + (/\./.test(c.after) ? auName(c.after) : auClock(c.after)));
    if (c.before) p.push('before ' + (/\./.test(c.before) ? auName(c.before) : auClock(c.before)));
    if (c.weekday) p.push('on ' + auDays(c.weekday));
    return auCap(p.join(', ') || 'at a set time');
  }
  if (kind === 'sun') return auCap([c.after ? 'after ' + c.after : '', c.before ? 'before ' + c.before : ''].filter(Boolean).join(' and ') || 'by the sun');
  if (kind === 'template') { const n = auInTpl(c.value_template); return n.length ? `A check on ${auNames(n)}` : 'A template check'; }
  if (kind === 'zone') return `${auNames(ids)} is in ${auName(c.zone || '')}`;
  if (kind === 'or' || kind === 'and' || kind === 'not') {
    const inner = auList(c.conditions).map(auCondition);
    return (kind === 'or' ? 'Any of: ' : kind === 'not' ? 'None of: ' : 'All of: ') + inner.join('; ');
  }
  if (kind === 'trigger') return 'Only for some of its triggers';
  return auCap(kind || 'condition');
}

// ---- the entities in a piece of config ----
// Into `out`: ctl, the entities a step works (a service call's target or
// *entity_id); see, every other one named (a condition, a template, a
// variable); scripts, those started (script.turn_on, or script.goodnight as
// the action itself); tells, the notifications sent (notify.*); dyn, the
// kinds of device worked through a template ("{{ trigger.entity_id }}",
// "{{ c.climate }}"), which read() fills in from the entities named elsewhere.
const auNew = () => ({ ctl: new Set(), see: new Set(), scripts: new Set(), tells: new Set(), dyn: new Set() });
const AU_WHOLE = new RegExp(`^(${[...AU_DEVICE, ...AU_PEOPLE, ...AU_HELPER].join('|')})\\.[a-z0-9_]*[a-z0-9]$`);
function auAdd(out, id, ctl) {
  const d = auDomain(id);
  if (d === 'script' && !AU_SERVICES.test(id.split('.')[1])) out.scripts.add(id);
  else if (d === 'notify') out.tells.add(id);
  else (ctl && !AU_READONLY.has(d) ? out.ctl : out.see).add(id);
}
function auWalk(node, out, key = '', ctl = false, dom = '') {
  if (Array.isArray(node)) { for (const x of node) auWalk(x, out, key, ctl, dom); return out; }
  if (node && typeof node === 'object') {
    const svc = node.action || node.service, call = typeof svc === 'string';
    if (call) dom = AU_SVC_DOM[svc.split('.')[0]] || svc.split('.')[0];
    for (const k in node) {
      const into = k === 'target' || /entity_id$/.test(k);
      auWalk(node[k], out, k, call ? into : ctl && into, dom);
    }
    return out;
  }
  if (typeof node !== 'string') return out;
  if ((key === 'action' || key === 'service') && /^[a-z_]+\.[a-z0-9_]+$/.test(node)) {
    const [d, sv] = node.split('.');
    if (d === 'script' && !AU_SERVICES.test(sv)) out.scripts.add(node);
    else if (d === 'notify' && sv !== 'send_message') out.tells.add('notify:' + sv);
    return out;
  }
  if (/[{%]/.test(node)) {
    const named = auInTpl(node);
    for (const x of named) auAdd(out, x, ctl);
    if (ctl && !named.length && AU_DEVICE.has(dom)) out.dyn.add(dom);
    return out;
  }
  for (const x of node.split(',')) if (AU_WHOLE.test(x.trim()) && !AU_SERVICES.test(x.trim().split('.')[1])) auAdd(out, x.trim(), ctl);
  return out;
}
// The service's own kind of device, where it isn't an entity's (blink.trigger_camera).
const AU_SVC_DOM = { blink: 'camera' };
// The config of a script the automation starts: Home Assistant's, else the copy's.
const auScript = id => (AUTOS.scriptCfg[id] || (typeof HA_SCRIPTS !== 'undefined' && HA_SCRIPTS[id.split('.')[1]]) || null);

const AUTOS = family({
  id: 'autos', name: 'Automations', icon: 'sync', group: 'Automations', order: 1,
  filter: store.get('autoFilter') || 'all',
  liveCfg: {}, scriptCfg: {}, cfgAsked: false, cfgDenied: false, cache: new WeakMap(), cfgVer: 0,

  // What Home Assistant has (live) or the copy (preview), each with its config: [{ ent, cid, cfg, src }]
  list() {
    const copy = typeof HA_AUTOS !== 'undefined' ? HA_AUTOS : {};
    const live = Object.keys(ents).filter(id => id.startsWith('automation.'));
    if (mode !== 'live') return Object.keys(copy).map(cid => ({ ent: 'automation.' + cid, cid, cfg: copy[cid], src: 'copy' }));
    const out = live.map(ent => {
      const cid = String((ents[ent].attributes || {}).id || '');
      const cfg = this.liveCfg[ent] || copy[cid] || null;
      return { ent, cid, cfg, src: this.liveCfg[ent] ? 'ha' : cfg ? 'copy' : '' };
    });
    // In the copy but not in Home Assistant: an automation it turned down (a mistake in it) or that was removed.
    if (live.length) {
      const have = new Set(out.map(a => a.cid));
      for (const cid in copy) if (!have.has(cid)) out.push({ ent: '', cid, cfg: copy[cid], src: 'copy', missing: true });
    }
    return out;
  },

  // Everything the view shows about one automation.
  read(a) {
    const s = a.ent ? st(a.ent) : null, A = s ? s.attributes : {}, c = a.cfg || {};
    const name = A.friendly_name || c.alias || auCap(a.ent.split('.')[1] || a.cid);
    const trig = auList(c.triggers || c.trigger), cond = auList(c.conditions || c.condition), acts = auList(c.actions || c.action);
    const { controls, watches, tells, scripts, helpers, group } = this.parts(a, c, trig, cond, acts);
    const desc = String(c.description || '').trim();
    const first = desc.split(/\n/)[0].replace(/\s+/g, ' ');
    // The description's first sentence (two, when the first is a few words: "Safety net.")
    const sentences = first.match(/.+?[.!?](?=\s+[A-Z("']|$)|.+$/g) || [];
    const what = sentences[0] && sentences[0].length < 30 && sentences[1] ? sentences[0] + ' ' + sentences[1].trim() : (sentences[0] || '');
    const state = a.missing ? 'missing' : !s ? 'gone' : s.state === 'unavailable' ? 'unavailable' : Number(A.current) > 0 ? 'running' : s.state === 'off' ? 'off' : 'on';
    const last = A.last_triggered || null, lastMs = last ? Date.parse(last) : 0;
    const today = lastMs && new Date(lastMs).toDateString() === new Date().toDateString();
    return { a, name, desc, what, trig, cond, controls, watches, tells, scripts, helpers, group, state, last, lastMs, today, mode: c.mode || 'single',
      when: [...new Set(trig.map(auTrigger))] };
  },

  // What it works and watches, and its group: read out of its config once (again when the scripts' configs come in).
  parts(a, c, trig, cond, acts) {
    const hit = this.cache.get(c);
    if (hit && hit.ver === this.cfgVer && hit.missing === !!a.missing) return hit;
    // The devices: what the actions work (and the scripts they start), then what it reads.
    const did = auWalk(acts, auNew()), saw = auWalk([trig, cond], auNew());
    const via = [...did.scripts], named = new Set([...saw.ctl, ...saw.see, ...did.see]);
    for (let i = 0; i < via.length; i++) {
      const sc = auScript(via[i]); if (!sc) continue;
      const o = auWalk(sc.sequence || [], auNew());
      for (const k of ['ctl', 'tells', 'dyn']) for (const x of o[k]) did[k].add(x);
      for (const x of o.see) named.add(x);
      for (const x of o.scripts) if (!via.includes(x)) via.push(x);
    }
    const isDev = id => AU_DEVICE.has(auDomain(id)), isWho = id => AU_PEOPLE.has(auDomain(id));
    // Worked through a template: the devices of that kind it names anywhere else.
    for (const x of named) if (did.dyn.has(auDomain(x))) did.ctl.add(x);
    const controls = [...did.ctl].filter(isDev);
    const watches = [...new Set([...saw.ctl, ...saw.see, ...did.see])].filter(id => (isDev(id) || isWho(id)) && !controls.includes(id));
    const tells = [...did.tells];
    const scripts = [...did.scripts];
    const helpers = [...new Set([...did.ctl, ...did.see, ...saw.ctl, ...saw.see])].filter(id => AU_HELPER.has(auDomain(id)) && !['sun', 'weather', 'zone', 'tts'].includes(auDomain(id)));
    // Its group. Three kinds of device or more, or two and run on request (an event of its
    // own: Goodnight) or by people coming and going: a routine. Else the kind its name says
    // ("Blink - ...", "Hatch - ..."), else the kind it works most; working none, Notifications
    // if it sends one, else what it watches (when it starts a script), else behind the scenes.
    const per = {}; for (const id of controls) { const k = auKindOf(id); if (k) per[k] = (per[k] || 0) + 1; }
    const kinds = Object.keys(per).sort((x, y) => per[y] - per[x]);
    const asked = trig.length && trig.every(t => (t.trigger || t.platform) === 'event' && !/\./.test(t.event_type || '.') && !/_reloaded$/.test(t.event_type));
    const byName = (AU_ALIAS.find(([re]) => re.test(String(c.alias || '').toLowerCase())) || [])[1];
    const byWatch = scripts.length ? watches.map(auKindOf).find(Boolean) : null;
    const group = a.missing ? 'missing' : kinds.length >= 3 || (kinds.length === 2 && (asked || watches.some(isWho))) ? 'routine'
      : byName || kinds[0] || (tells.length ? 'alerts' : byWatch || 'helpers');
    const out = { controls, watches, tells, scripts, helpers, group, ver: this.cfgVer, missing: !!a.missing };
    this.cache.set(c, out);
    return out;
  },

  // "On · ran 2h ago"
  status(r) {
    if (r.state === 'missing') return 'Not loaded';
    if (r.state === 'gone') return offWord(r.a.ent);
    if (r.state === 'unavailable') return 'Unavailable';
    if (r.state === 'running') return 'Running now';
    if (mode !== 'live') return r.state === 'off' ? 'Off' : 'On';
    const ran = r.last ? 'ran ' + ago(r.last).replace(/^Just now$/, 'just now') : 'never run';
    return (r.state === 'off' ? 'Off' : 'On') + ' · ' + ran;
  },
  // A device's state, in a word or two.
  devState(id) {
    const s = st(id);
    if (!s) return mode === 'live' && Object.keys(ents).length ? 'Not found' : '';
    const A = s.attributes, d = auDomain(id), v = s.state;
    if (v === 'unavailable') return 'Unavailable';
    if (v === 'unknown') return '—';
    if (d === 'light') return v === 'on' ? (A.brightness != null ? Math.round(A.brightness / 2.55) + '%' : 'On') : 'Off';
    if (d === 'climate') return (A.hvac_action && v !== 'off' ? auCap(A.hvac_action) : v === 'heat_cool' ? 'Auto' : auCap(v)) + (A.current_temperature != null ? ` · ${Math.round(A.current_temperature)}°` : '');
    if (d === 'cover') return A.current_position != null ? (A.current_position <= 0 ? 'Closed' : A.current_position >= 100 ? 'Open' : `Open ${Math.round(A.current_position)}%`) : auCap(v);
    if (d === 'person' || d === 'device_tracker') return v === 'home' ? 'Home' : v === 'not_home' ? 'Away' : auCap(v);
    if (d === 'sensor' || d === 'number') return `${isNaN(Number(v)) ? auCap(v) : Math.round(Number(v) * 10) / 10}${A.unit_of_measurement ? (A.unit_of_measurement === '%' ? '%' : ' ' + A.unit_of_measurement) : ''}`;
    if (d === 'alarm_control_panel') return auCap(v.replace('armed_', 'armed '));
    return auCap(v);
  },

  // Home Assistant's own configs, when the token may read them (an admin's): asked once per connection.
  askConfigs() {
    if (mode !== 'live' || HA.status !== 'live' || this.cfgAsked || this.cfgDenied) return;
    const ids = Object.keys(ents).filter(id => id.startsWith('automation.'));
    if (!ids.length) return;
    this.cfgAsked = true;
    const one = (type, id, into) => HA.send({ type, entity_id: id }).then(r => { if (r && r.config) into[id] = r.config; },
      e => { if (/unauthori|admin/i.test(e.message || '')) this.cfgDenied = true; });
    one('automation/config', ids[0], this.liveCfg).then(() => {
      if (this.cfgDenied) return render();
      return Promise.all(ids.slice(1).map(id => one('automation/config', id, this.liveCfg))).then(() => {
        const sc = new Set(); for (const id in this.liveCfg) for (const x of auWalk(this.liveCfg[id].actions || this.liveCfg[id].action || [], auNew()).scripts) sc.add(x);
        return Promise.all([...sc].map(id => one('script/config', id, this.scriptCfg)));
      }).then(() => { this.cfgVer++; render(); });
    });
  },

  mount(el) {
    el.innerHTML = `<div class="au-filter" data-dv="autos:list" data-r="filter"></div><div data-r="note"></div><div class="au-groups" data-r="groups"></div>`;
    window.addEventListener('viewchange', e => { if (e.detail.to === 'autos') { this.askConfigs(); this.render(); } });
  },

  render() {
    if (HA.status !== 'live') this.cfgAsked = false;   // ask again on the next connection
    if (curView === 'autos') this.askConfigs();
    const all = this.list().map(a => this.read(a)).sort((x, y) => x.name.localeCompare(y.name));
    const real = all.filter(r => r.state !== 'missing');
    const nToday = real.filter(r => r.today).length, nOff = real.filter(r => r.state === 'off' || r.state === 'unavailable').length;
    const nRun = real.filter(r => r.state === 'running').length;
    this.sum = !real.length ? '' : [nRun ? `${nRun} running` : '', mode === 'live' && nToday ? `${nToday} ran today` : '', nOff ? `${nOff} off` : ''].filter(Boolean).join(' · ') || `${real.length} on`;
    if (curView !== 'autos') return;   // the cards are drawn when the view is shown (viewchange, in mount)
    const R = k => this.el.querySelector(`[data-r="${k}"]`);
    const counts = { all: real.length, today: nToday, off: nOff };
    put(R('filter'), chipsHTML('filter', AU_FILTERS.filter(([v]) => v !== 'today' || mode === 'live').map(([v, l]) => [v, `${l} <b>${counts[v]}</b>`]), this.filter, { cls: 'au-chips' }));
    const waiting = mode === 'live' && !real.length;
    put(R('note'), waiting ? `<p class="tnote">${HA.status === 'live' ? 'No automations in Home Assistant.' : 'Connecting to Home Assistant…'}</p>`
      : mode !== 'live' ? '<p class="tnote">A preview: the automations in Home\'s copy of ha-config. Connected, it shows Home Assistant\'s own, whether each is on, and when it last ran.</p>' : '');
    const filter = this.filter === 'today' && mode !== 'live' ? 'all' : this.filter;
    const shown = all.filter(r => filter === 'today' ? r.today : filter === 'off' ? r.state === 'off' || r.state === 'unavailable' : true);
    // The groups and their cards are laid out when the list changes; each card is then drawn on its own,
    // so a light dimming redraws only the cards that show it.
    const groups = AU_GROUPS.map(g => [g, shown.filter(r => r.group === g.id)]).filter(([, rs]) => rs.length);
    const box = R('groups'), layout = groups.map(([g, rs]) => g.id + ':' + rs.map(r => this.key(r)).join(',')).join('|');
    if (box.dataset.layout !== layout) {
      box.dataset.layout = layout;
      box.innerHTML = groups.map(([g, rs]) => `<div class="au-group"><div class="vsec-h"><span>${g.name}</span><em class="au-n">${rs.length}</em></div>${rs.map(r =>
        `<article class="dg dvc au" data-dv="${esc(this.key(r))}"><div class="dg-fx" data-r="fx"></div><div class="dg-in" data-r="in"></div></article>`).join('')}</div>`).join('')
        || (real.length ? `<p class="tnote">${filter === 'today' ? 'None has run today.' : 'Every automation is on.'}</p>` : '');
    }
    for (const [g, rs] of groups) for (const r of rs) {
      const card = box.querySelector(`[data-dv="${CSS.escape(this.key(r))}"]`); if (!card) continue;
      const acc = AU_ACC[g.id];
      card.className = `dg dvc au au-${r.state}`;
      put(card.querySelector('[data-r="fx"]'), skyHTML(grad('#17181A', '#212326', '#33363B'), acc, r.state === 'running' ? { pool: 'breathe', poolA: 0.16 } : {}));
      put(card.querySelector('[data-r="in"]'), this.cardHTML(r, g));
      shadow(card, acc);
    }
  },
  key: r => 'autos:' + (r.a.ent || 'x.' + r.a.cid),

  // A card's devices: each one with its state; more than three, one chip per kind ("14 lights · 3 on").
  devChips(devs) {
    const one = id => { const w = this.devState(id); return `<span class="alert au-dev">${svg(AU_ICON[auDomain(id)] || 'home', 13)}<span>${esc(auName(id))}</span>${w ? `<em>${esc(w)}</em>` : ''}</span>`; };
    let chips;
    if (devs.length <= 3) chips = devs.map(one);
    else {
      const by = new Map(); for (const id of devs) { const d = auDomain(id); by.set(d, [...(by.get(d) || []), id]); }
      chips = [...by].map(([d, ids]) => {
        if (ids.length === 1) return one(ids[0]);
        const on = ids.filter(id => { const s = st(id); return s && !['off', 'unavailable', 'unknown', 'idle', 'standby', 'closed', 'not_home'].includes(s.state); }).length;
        const known = ids.some(id => st(id));
        return `<span class="alert au-dev">${svg(AU_ICON[d] || 'home', 13)}<span>${ids.length} ${AU_PLURAL[d] || 'devices'}</span>${known && AU_ONOFF.has(d) ? `<em>${on ? on + ' on' : 'all off'}</em>` : ''}</span>`;
      });
    }
    return chips.slice(0, 4).join('') + (chips.length > 4 ? `<span class="alert au-dev more">+${chips.length - 4}</span>` : '');
  },
  // A card's inside: its name and status, what it does, when it runs, and its devices with theirs.
  cardHTML(r, g) {
    const devs = r.controls.length ? r.controls : r.watches;
    const chips = devs.length ? this.devChips(devs) : r.tells.length ? `<span class="alert au-dev">${svg('bell', 13)}<span>Sends a notification</span></span>` : '';
    return `<div class="au-top"><span class="shield" style="--a:${AU_ACC[g.id]}">${svg(g.icon, 20)}</span>
        <div class="au-h"><b>${esc(r.name)}</b><small><i class="au-dot"></i>${esc(this.status(r))}</small></div></div>
      ${r.what ? `<p class="au-what">${esc(r.what)}</p>` : !r.a.cfg ? '<p class="au-what dim">Not in Home\'s copy of the automations yet.</p>' : ''}
      ${r.when.length ? `<div class="au-when">${svg('clock', 14)}<span>${esc(r.when.slice(0, 2).join(' · ') + (r.when.length > 2 ? ` +${r.when.length - 2}` : ''))}</span></div>` : ''}
      ${chips ? `<div class="alerts au-devs">${chips}</div>` : ''}`;
  },

  find(id) { return this.list().find(a => (a.ent || 'x.' + a.cid) === id); },
  sheet(id) {
    const a = this.find(id); if (!a) return null;
    const r = this.read(a), g = AU_GROUPS.find(x => x.id === r.group), acc = AU_ACC[g.id];
    const row = (ic, k, v = '') => `<div class="rowi">${icon(ic)}<span class="k">${k}</span>${v ? `<span class="v">${v}</span>` : ''}</div>`;
    const devRows = ids => grp(ids.map(id => row(AU_ICON[auDomain(id)] || 'home', esc(auName(id)), esc(this.devState(id)))).join(''), true);
    const when = r.last ? new Date(r.last).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
    const tellName = id => id.startsWith('notify:') ? auCap(id.slice(7).replace(/^mobile_app_/, '')) : auName(id);
    const paras = r.desc.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const more = paras.join(' ').length > r.what.length + 2;
    return {
      title: r.name, accent: acc, pill: pillHTML2(esc(this.status(r).split(' · ')[0])),
      fx: skyHTML(grad('#17181A', '#212326', '#33363B'), acc, {}, 150),
      parts: [
        ['what', `<div class="au-desc"><p>${esc(r.what || 'No description.')}</p></div>`],
        ['stats', statsHTML([['Status', esc(this.status(r).split(' · ')[0])], ['Last ran', mode === 'live' ? esc(r.last ? ago(r.last) : 'Never') : '—'], ['Group', g.name]])],
        r.when.length ? ['when', lbl('RUNS') + grp(r.when.map(w => row('clock', esc(w))).join(''), true)] : null,
        r.cond.length ? ['if', lbl('ONLY IF') + grp(r.cond.map(c => row('check', esc(auCondition(c)))).join(''), true)] : null,
        r.controls.length ? ['does', lbl('CONTROLS') + devRows(r.controls)] : null,
        r.watches.length ? ['watch', lbl('WATCHES') + devRows(r.watches)] : null,
        r.tells.length ? ['tell', lbl('NOTIFIES') + grp(r.tells.map(id => row('bell', esc(tellName(id)))).join(''), true)] : null,
        r.scripts.length ? ['scripts', lbl('STARTS SCRIPTS') + grp(r.scripts.map(id => row('play', esc((auScript(id) || {}).alias || auName(id)))).join(''), true)] : null,
        r.helpers.length ? ['helpers', lbl('HELPERS') + `<p class="tnote au-helpers">${esc(r.helpers.map(auName).join(' · '))}</p>`] : null,
        more ? ['full', lbl('IN FULL') + `<div class="au-desc au-full">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>`] : null,
        ['src', `<p class="tnote">${mode === 'live' && r.last ? `Last ran ${esc(when)}. ` : ''}${r.state === 'missing'
          ? 'In ha-config\'s automations.yaml but not in Home Assistant: it was removed there, or Home Assistant turned it down (a mistake in it). '
          : ''}${a.src === 'ha' ? 'Read from Home Assistant.' : a.src === 'copy' ? 'Read from Home\'s copy of ha-config\'s automations.yaml.' : 'Home has no details for this one yet.'} Run and change it in Home Assistant.</p>`],
      ],
    };
  },
  act(id, a, b) {
    if (a === 'filter') { this.filter = b.dataset.v; store.set('autoFilter', this.filter); render(); }
  },
  // The preview: each automation in the copy, on, as Home Assistant would list it.
  samples(e) {
    const out = {};
    if (typeof HA_AUTOS !== 'undefined') for (const cid in HA_AUTOS) out['automation.' + cid] = e('on', { id: cid, friendly_name: HA_AUTOS[cid].alias, current: 0 });
    return out;
  },
});
