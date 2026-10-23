// AUTOMATIONS: every Home Assistant automation, what it does, when it runs,
// the devices it works and whether it is on, with a switch to turn each one
// on or off (on its row and in its popup, as the Signal dashboard's
// Automations view has since 2026-10-22). Nothing here runs one.
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
// one that works three kinds of device or more is a Routine. The view itself
// is the names, by group, each with its switch: tap a name for its status,
// devices and the rest. A switch shows the tap at once and holds it until Home
// Assistant reports it (held()/tset()/tsend(), as every device's switches).
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
// By its name: the routines (Goodnight, Mom's Awake, Away, Home, Babysitter, and what goes
// with them), and one that works no device of its own ("Blinds - Push Slider Targets").
const AU_ALIAS = [[/goodnight|mom's awake|babysitter|^away\b|^home\b/, 'routine'], [/hatch|nursery/, 'nursery'], [/blink|camera|motion|alarm/, 'security'], [/dyson|heater|thermostat|dehumid|hvac|windmill/, 'climate'],
  [/blind/, 'blinds'], [/light|lamp|strip/, 'lights'], [/sonos|speaker|\btv\b/, 'media'], [/vacuum|shark/, 'around']];

const auCap = s => String(s || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const auList = v => v == null ? [] : Array.isArray(v) ? v : [v];
const auDomain = id => id.split('.')[0];
const auName = id => { const s = st(id); return (s && s.attributes.friendly_name) || auCap(id.split('.')[1] || id); };
// "08:30:00" -> "8:30 AM"; "04:00:30" -> "4:00:30 AM"
function auClock(t) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(t)); if (!m) return String(t);
  const h = Number(m[1]), ap = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${m[2]}${m[3] && m[3] !== '00' ? ':' + m[3] : ''} ${ap}`;
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
// the action itself; a script a template only checks is read, not started);
// tells, the notifications sent (notify.*); dyn, the
// kinds of device worked through a template ("{{ trigger.entity_id }}",
// "{{ c.climate }}"), which read() fills in from the entities named elsewhere.
const auNew = () => ({ ctl: new Set(), see: new Set(), scripts: new Set(), tells: new Set(), dyn: new Set() });
const AU_WHOLE = new RegExp(`^(${[...AU_DEVICE, ...AU_PEOPLE, ...AU_HELPER].join('|')})\\.[a-z0-9_]*[a-z0-9]$`);
function auAdd(out, id, ctl) {
  const d = auDomain(id);
  if (d === 'script' && !AU_SERVICES.test(id.split('.')[1])) (ctl ? out.scripts : out.see).add(id);   // named in a check: only read
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
// Entities a template makes from others: its replace() steps on each entity named
// ("input_number.office_blinds_target" | replace('input_number.', 'cover.') |
// replace('_target', '') -> cover.office_blinds), and 'camera.' ~ r over a list.
function auDerive(cfg, named) {
  const out = new Set(), tpls = [];
  (function walk(n) { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') Object.values(n).forEach(walk); else if (typeof n === 'string' && /[{%]/.test(n)) tpls.push(n); })(cfg);
  for (const t of tpls) {
    const steps = [...t.matchAll(/replace\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g)];
    if (steps.length) for (const id of named) { let x = id; for (const [, a, b] of steps) x = x.split(a).join(b); if (x !== id && AU_WHOLE.test(x)) out.add(x); }
    for (const [, v, list] of t.matchAll(/for (\w+) in \[([^\]]*)\]/g)) {
      const items = [...list.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
      for (const [, d, suf] of t.matchAll(new RegExp(`'([a-z_]+)\\.'\\s*~\\s*${v}\\b(?:\\s*~\\s*'([a-z0-9_]*)')?`, 'g'))) for (const it of items) { const x = `${d}.${it}${suf || ''}`; if (AU_WHOLE.test(x)) out.add(x); }
    }
  }
  return out;
}
// What a call does to its device, in words: "Turns off", "Sets to 25%", "Opens".
// A number from a template is "Sets brightness" and the like; vars fills a
// service named by one ("switch.turn_{{ state }}", with the state handed to the script).
const auNum = v => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v) : null;
function auDoes(svc, data = {}, vars = {}) {
  svc = String(svc).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => typeof vars[k] === 'string' ? vars[k] : m);
  if (/[{%]/.test(svc)) return '';
  const [d, sv] = svc.split('.'), n = k => auNum(data[k]);
  if (sv === 'turn_off' || (sv === 'set_hvac_mode' && data.hvac_mode === 'off')) return 'Turns off';
  if (sv === 'turn_on') return d === 'light' && n('brightness_pct') != null ? `Sets to ${n('brightness_pct')}%` : d === 'light' && data.brightness_pct != null ? 'Sets brightness' : 'Turns on';
  if (sv === 'toggle') return 'Toggles';
  if (sv === 'set_cover_position') return n('position') === 100 ? 'Opens' : n('position') === 0 ? 'Closes' : n('position') != null ? `Sets to ${n('position')}%` : 'Moves';
  if (sv === 'open_cover') return 'Opens';
  if (sv === 'close_cover') return 'Closes';
  if (sv === 'set_hvac_mode') return /[{%]/.test(data.hvac_mode || '{') ? 'Sets mode' : `Sets to ${auCap(data.hvac_mode === 'heat_cool' ? 'auto' : data.hvac_mode)}`;
  if (sv === 'set_temperature') return 'Sets temperature';
  if (sv === 'set_preset_mode') return /[{%]/.test(data.preset_mode || '{') ? 'Sets preset' : data.preset_mode === 'none' ? '' : `Sets to ${auCap(data.preset_mode)}`;
  if (sv === 'set_fan_mode') return 'Sets fan';
  if (sv === 'set_percentage') return n('percentage') != null ? `Sets speed ${n('percentage')}%` : 'Sets speed';
  if (sv === 'media_stop') return 'Stops';
  if (sv === 'volume_set') return n('volume_level') != null ? `Volume ${Math.round(n('volume_level') * 100)}%` : 'Sets volume';
  if (sv === 'select_sound_mode') return /[{%]/.test(data.sound_mode || '{') ? 'Plays a sound' : `Plays ${auCap(data.sound_mode).replace(/([a-z])([A-Z])/g, '$1 $2')}`;
  if (sv === 'speak') return 'Speaks an alert';
  if (sv === 'alarm_arm_away' || sv === 'alarm_arm_home' || sv === 'alarm_arm_night') return 'Arms';
  if (sv === 'alarm_disarm') return 'Disarms';
  if (d === 'blink' && sv === 'trigger_camera') return 'Takes a snapshot';
  if (sv === 'update_entity') return '';
  return auCap(sv);
}
// Into eff (entity -> what is done to it) and dynEff (a kind of device worked through a template -> the same).
function auEffects(node, eff, dynEff, vars) {
  if (Array.isArray(node)) { for (const x of node) auEffects(x, eff, dynEff, vars); return; }
  if (!node || typeof node !== 'object') return;
  const svc = node.action || node.service;
  if (typeof svc === 'string' && !/^(script|notify|input_\w+|timer|counter)\./.test(svc)) {
    const data = node.data || {}, word = auDoes(svc, data, vars);
    const dom = AU_SVC_DOM[svc.split('.')[0]] || svc.split('.')[0];
    const ids = [];
    for (const [k, v] of Object.entries({ ...(node.target || {}), ...data, ...(node.entity_id ? { entity_id: node.entity_id } : {}) })) {
      if (!/entity_id$/.test(k)) continue;
      for (const x of auList(v)) if (typeof x === 'string') { if (/[{%]/.test(x)) { if (word) (dynEff[dom] = dynEff[dom] || new Set()).add(word); } else ids.push(...x.split(',').map(y => y.trim())); }
    }
    if (word) for (const id of ids) (eff[id] = eff[id] || new Set()).add(word);
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') auEffects(v, eff, dynEff, vars);
}
// The service's own kind of device, where it isn't an entity's (blink.trigger_camera).
const AU_SVC_DOM = { blink: 'camera' };
// The config of a script the automation starts: Home Assistant's, else the copy's.
const auScript = id => (AUTOS.scriptCfg[id] || (typeof HA_SCRIPTS !== 'undefined' && HA_SCRIPTS[id.split('.')[1]]) || null);

const AUTOS = family({
  id: 'autos', name: 'Automations', icon: 'sync', group: 'Automations', order: 1,
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
    const { controls, watches, tells, scripts, helpers, group, does } = this.parts(a, c, trig, cond, acts);
    const desc = String(c.description || '').trim();
    const first = desc.split(/\n/)[0].replace(/\s+/g, ' ');
    // The description's first sentence (two, when the first is a few words: "Safety net.")
    const sentences = first.match(/.+?[.!?](?=\s+[A-Z("']|$)|.+$/g) || [];
    const what = sentences[0] && sentences[0].length < 30 && sentences[1] ? sentences[0] + ' ' + sentences[1].trim() : (sentences[0] || '');
    // A switch tapped and not yet reported shows what was tapped (over Running now).
    const d = a.ent ? dv('autos', a.ent, name) : null, v = s && d ? held(d, 'on', s.state) : s && s.state;
    const state = a.missing ? 'missing' : !s ? 'gone' : s.state === 'unavailable' ? 'unavailable' : v !== s.state ? v
      : Number(A.current) > 0 ? 'running' : v === 'off' ? 'off' : 'on';
    const wait = !!d && tWaiting(d, 'on'), can = !!s && ['on', 'off'].includes(s.state);
    const last = A.last_triggered || null, lastMs = last ? Date.parse(last) : 0;
    const today = lastMs && new Date(lastMs).toDateString() === new Date().toDateString();
    return { a, name, desc, what, trig, cond, controls, watches, tells, scripts, helpers, group, does, state, wait, can, last, lastMs, today, mode: c.mode || 'single',
      when: [...new Set(trig.map(auTrigger))] };
  },

  // What it works and watches, and its group: read out of its config once (again when the scripts' configs come in).
  parts(a, c, trig, cond, acts) {
    const hit = this.cache.get(c);
    if (hit && hit.ver === this.cfgVer && hit.missing === !!a.missing) return hit;
    // The devices: what the actions work (and the scripts they start), then what it reads.
    // A script's notification (blink_set_enrolment's, when a camera didn't change) is the
    // script's own, only now and then: not the automation's.
    const did = auWalk(acts, auNew()), saw = auWalk([trig, cond, c.variables || {}], auNew());
    const via = [...did.scripts], named = new Set([...saw.ctl, ...saw.see, ...did.see]), cfgs = [c];
    for (let i = 0; i < via.length; i++) {
      const sc = auScript(via[i]); if (!sc) continue;
      cfgs.push(sc);
      const o = auWalk([sc.variables || {}, sc.sequence || []], auNew());
      for (const k of ['ctl', 'dyn']) for (const x of o[k]) did[k].add(x);
      for (const x of o.see) named.add(x);
      for (const x of o.scripts) if (!via.includes(x)) via.push(x);
    }
    const isDev = id => AU_DEVICE.has(auDomain(id)), isWho = id => AU_PEOPLE.has(auDomain(id));
    // Worked through a template: the devices of that kind it names anywhere else, or makes from those it names.
    if (did.dyn.size) for (const x of auDerive(cfgs, named)) named.add(x);
    // The entities handed to a script it starts (script.turn_on's variables) come first: the
    // Yard camera only named in the push message isn't one of those it stands down.
    const passed = new Set();
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (/^script\./.test(n.action || n.service || '') && n.data) for (const x of auWalk(n.data, auNew()).see) passed.add(x);
      Object.values(n).forEach(walk);
    })(acts);
    for (const d of did.dyn) {
      const mine = [...passed].filter(x => auDomain(x) === d);
      for (const x of mine.length ? mine : [...named].filter(x => auDomain(x) === d)) did.ctl.add(x);
    }
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
    // What it does to each device it controls: its own calls, then its scripts' (with what it hands them).
    const eff = {}, dynEff = {}, vars = {};
    (function walk(n) {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (/^script\./.test(n.action || n.service || '') && n.data) for (const [k, v] of Object.entries(n.data.variables || n.data)) if (typeof v === 'string' && !/[{%]/.test(v)) vars[k] = v;
      Object.values(n).forEach(walk);
    })(acts);
    auEffects(acts, eff, dynEff, {});
    for (const id of via) { const sc = auScript(id); if (sc) auEffects(sc.sequence || [], eff, dynEff, vars); }
    const does = {};
    for (const id of controls) { const w = new Set([...(eff[id] || []), ...(eff[id] ? [] : dynEff[auDomain(id)] || [])]); if (w.size) does[id] = [...w].slice(0, 2).join(' · '); }
    const out = { controls, watches, tells, scripts, helpers, group, does, ver: this.cfgVer, missing: !!a.missing };
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
    el.innerHTML = `<div data-r="note"></div><div class="au-groups" data-r="groups"></div>`;
    window.addEventListener('viewchange', e => { if (e.detail.to === 'autos') { this.askConfigs(); this.render(); } });
  },

  // A row: the name (a tap opens its popup), "Off" or "Running now" under it, and its switch.
  // One that isn't in Home Assistant has nothing to switch: the name and a chevron.
  rowHTML(r) {
    const key = esc(this.key(r)), label = esc(r.name);
    if (r.state === 'missing') return `<button type="button" class="rowi dvc au-row" data-dv="${key}" aria-label="${label}: status and devices"><span class="k">${label}</span>${svg('chevR', 18)}</button>`;
    const on = r.state === 'on' || r.state === 'running';
    const sub = r.state === 'off' ? 'Off' : r.state === 'running' ? 'Running now' : r.can ? '' : this.status(r);
    return `<div class="rowi dvc au-row au-swrow${on ? '' : ' off'}" data-dv="${key}">
      <button type="button" class="au-open" data-a="open" aria-label="${label}: status and devices"><span class="k">${label}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>
      <button type="button" class="au-sw${r.wait ? ' wait' : ''}" data-a="ausw" role="switch" aria-checked="${on}" aria-label="${label}"${r.can ? '' : ' disabled'}>${accentSw(on, AU_ACC[r.group])}</button></div>`;
  },

  // The view: the names, by group, each with its switch. Status, devices and the rest are in each one's popup.
  render() {
    if (HA.status !== 'live') this.cfgAsked = false;   // ask again on the next connection
    if (curView === 'autos') this.askConfigs();
    const all = this.list().map(a => this.read(a)).sort((x, y) => x.name.localeCompare(y.name));
    const real = all.filter(r => r.state !== 'missing');
    const nToday = real.filter(r => r.today).length, nOff = real.filter(r => r.state === 'off' || r.state === 'unavailable').length;
    const nRun = real.filter(r => r.state === 'running').length;
    this.sum = !real.length ? '' : [nRun ? `${nRun} running` : '', mode === 'live' && nToday ? `${nToday} ran today` : '', nOff ? `${nOff} off` : ''].filter(Boolean).join(' · ') || `${real.length} on`;
    if (curView !== 'autos') return;   // drawn when the view is shown (viewchange, in mount)
    const R = k => this.el.querySelector(`[data-r="${k}"]`);
    put(R('note'), mode === 'live' && !real.length ? `<p class="tnote">${HA.status === 'live' ? 'No automations in Home Assistant.' : 'Connecting to Home Assistant…'}</p>` : '');
    const groups = AU_GROUPS.map(g => [g, all.filter(r => r.group === g.id)]).filter(([, rs]) => rs.length);
    put(R('groups'), groups.map(([g, rs]) => `<div class="au-group"><div class="vsec-h"><span>${g.name}</span><em class="au-n">${rs.length}</em></div>
      <div class="group">${rs.map(r => this.rowHTML(r)).join('')}</div></div>`).join(''));
  },
  key: r => 'autos:' + (r.a.ent || 'x.' + r.a.cid),

  find(id) { return this.list().find(a => (a.ent || 'x.' + a.cid) === id); },
  sheet(id) {
    const a = this.find(id); if (!a) return null;
    const r = this.read(a), g = AU_GROUPS.find(x => x.id === r.group), acc = AU_ACC[g.id];
    const row = (ic, k, v = '') => `<div class="rowi">${icon(ic)}<span class="k">${k}</span>${v ? `<span class="v">${v}</span>` : ''}</div>`;
    // A device: its name with its state now under it, and on the right what this automation does to it.
    const devRows = (ids, does = {}) => grp(ids.map(id => { const now = this.devState(id);
      return row(AU_ICON[auDomain(id)] || 'home', `${esc(auName(id))}${now ? `<small>Now ${esc(now.charAt(0).toLowerCase() + now.slice(1))}</small>` : ''}`, esc(does[id] || '')); }).join(''), true);
    const when = r.last ? new Date(r.last).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
    const tellName = id => id.startsWith('notify:') ? auCap(id.slice(7).replace(/^mobile_app_/, '')) : auName(id);
    const paras = r.desc.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const more = paras.join(' ').length > r.what.length + 2;
    const src = [mode === 'live' && r.last ? `Last ran ${esc(when)}.` : '', r.state === 'missing' ? 'Not in Home Assistant.' : ''].filter(Boolean).join(' ');
    return {
      title: r.name, accent: acc, pill: pillHTML2(esc(this.status(r).split(' · ')[0])),
      fx: skyHTML(grad('#17181A', '#212326', '#33363B'), acc, {}, 150),
      parts: [
        ['stats', statsHTML([['Status', esc(this.status(r).split(' · ')[0])], ['Last ran', mode === 'live' ? esc(r.last ? ago(r.last) : 'Never') : '—']])],
        r.state !== 'missing' ? ['sw', grp(swRow('ausw', 'On', 'power', r.state === 'on' || r.state === 'running', acc,
          { dis: !r.can, wait: r.wait, sub: r.state === 'off' ? 'It won\'t run until it\'s back on' : '' }), true)] : null,
        r.controls.length ? ['does', lbl('CONTROLS') + devRows(r.controls, r.does)] : null,
        r.watches.length ? ['watch', lbl('WATCHES') + devRows(r.watches)] : null,
        !r.controls.length && !r.watches.length ? ['none', `<p class="tnote">${r.tells.length ? 'Works no device: it sends a notification.' : 'Works no device: only the dashboard\'s helpers.'}</p>`] : null,
        ['what', lbl('WHAT IT DOES') + `<div class="au-desc"><p>${esc(r.what || (r.a.cfg ? 'No description.' : 'Not in Home\'s copy of the automations yet.'))}</p></div>`],
        r.when.length ? ['when', lbl('RUNS') + grp(r.when.map(w => row('clock', esc(w))).join(''), true)] : null,
        r.cond.length ? ['if', lbl('ONLY IF') + grp(r.cond.map(c => row('check', esc(auCondition(c)))).join(''), true)] : null,
        r.tells.length ? ['tell', lbl('NOTIFIES') + grp(r.tells.map(id => row('bell', esc(tellName(id)))).join(''), true)] : null,
        r.scripts.length ? ['scripts', lbl('STARTS SCRIPTS') + grp(r.scripts.map(id => row('play', esc((auScript(id) || {}).alias || auName(id)))).join(''), true)] : null,
        r.helpers.length ? ['helpers', lbl('HELPERS') + `<p class="tnote au-helpers">${esc(r.helpers.map(auName).join(' · '))}</p>`] : null,
        more ? ['full', lbl('IN FULL') + `<div class="au-desc au-full">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>`] : null,
        src ? ['src', `<p class="tnote">${src}</p>`] : null,
      ],
    };
  },
  // Its switch (the row's or the popup's): automation.turn_on / turn_off.
  act(id, a) {
    if (a !== 'ausw') return;
    const s = st(id); if (!s || !['on', 'off'].includes(s.state)) return;
    const d = dv('autos', id, auName(id)), on = held(d, 'on', s.state) === 'on';
    tset(d, 'on', on ? 'off' : 'on'); render();
    return tsend(d, 'automation', on ? 'turn_off' : 'turn_on', { entity_id: id }, ['on']);
  },
  // The preview: each automation in the copy, on, as Home Assistant would list it.
  samples(e) {
    const out = {};
    if (typeof HA_AUTOS !== 'undefined') for (const cid in HA_AUTOS) out['automation.' + cid] = e('on', { id: cid, friendly_name: HA_AUTOS[cid].alias, current: 0 });
    return out;
  },
});
