// THERMOSTAT SCHEDULES: where each thermostat is in its schedule, as Home
// Assistant's scheduler card shows it. The schedules are the Scheduler
// integration's (custom_components/scheduler): one switch.schedule_<name>
// per schedule, kept inside Home Assistant (not in ha-config), so they are
// found by what they control - each lists its `entities` - not by name.
// Its attributes, as the integration writes them (switch.py,
// state_attributes):
//   weekdays      ['daily'] / ['workday'] / ['weekend'] / ['mon', 'tue', ...]
//   timeslots     one per step: "06:30" (from then on) or "06:30:00 - 08:00:00"
//   actions       one per step: { service, service_data }
//   current_slot  the step under way - set while inside a step that has an
//                 end; a schedule of start times only leaves it empty, and
//                 then the step under way is the one before next_slot
//   next_slot, next_trigger (when the next step starts)
// The switch is on while the schedule is enabled; turning it off pauses it.
'use strict';
// HOME ASSISTANT'S OWN SCHEDULE (the Nests). The house runs its thermostat
// schedule in Home Assistant itself, not the Scheduler integration: the
// "Thermostat - daily schedule" automation moves each Nest's profile helper
// (input_select.thermostat_lr_phase / _of_phase) at its times, Goodnight moves
// it to night, and script.thermostat_apply writes the profile's setpoints
// (ha-config). So the step under way is just that helper's state, and the
// popup lights it the moment Home Assistant moves it. What can stand in front
// of the schedule, in the script's order: Vacation (55/85), the sitter hold
// (the Nests left where they are), Eco (everyone out, 64/80).
// THE NUMBERS MUST MATCH script.thermostat_apply and the `thermostat_schedule`
// automation's times (and Signal's tf_card `scheds`), which is where they
// take effect; here they are only shown. `wk`: Monday to Friday only. A step
// with no time is Goodnight's.
const HA_SCHED = {
  lr: { phase: 'input_select.thermostat_lr_phase', steps: [
    { p: 'morning', name: 'Morning', at: '06:00', lo: 70, hi: 78 },
    { p: 'day', name: 'Day', at: '08:00', lo: 68, hi: 80, wk: true },
    { p: 'evening', name: 'Evening', at: '17:00', lo: 70, hi: 78 },
    { p: 'night', name: 'Night', at: null, lo: 64, hi: 82 },
  ] },
  of: { phase: 'input_select.thermostat_of_phase', steps: [
    { p: 'morning', name: 'Morning', at: '07:00', lo: 68, hi: 80 },
    { p: 'evening', name: 'Evening', at: '19:00', lo: 68, hi: 78 },
    { p: 'night', name: 'Night', at: null, lo: 64, hi: 78 },
  ] },
};
const HA_ECO = [64, 80];
const weekday = d => d.getDay() % 6 !== 0;
// The next step the clock will start, and when: the first timed step after now
// (a Mon-Fri step only on a weekday), within the week. Goodnight comes before
// it when the step under way is the one before night.
function haNext(sc, cur, now = new Date()) {
  const i = sc.steps.findIndex(x => x.p === cur);
  if (i >= 0 && sc.steps[i + 1] && !sc.steps[i + 1].at) return { step: sc.steps[i + 1], when: 'At Goodnight' };
  for (let d = 0; d < 8; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    for (const x of sc.steps) {
      if (!x.at || (x.wk && !weekday(day))) continue;
      const [h, m] = x.at.split(':').map(Number), t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      if (t > now) return { step: x, when: schWhen(t.toISOString()), at: t };
    }
  }
  return null;
}
// Where the Nest is: { sc, cur (the profile under way), lit ('vacation' | 'eco' | 'hold' | a profile), next }.
function haSchedRead(t, now = new Date()) {
  const sc = HA_SCHED[t.id]; if (!sc || t.kind !== 'nest') return null;
  const ph = st(sc.phase), cur = ph && sc.steps.some(x => x.p === ph.state) ? ph.state : null;
  const lit = vacOn() ? 'vacation' : isOn('input_boolean.thermostat_hold') ? 'hold' : isOn(AWAY_FLAG) ? 'eco' : cur;
  return { sc, cur, lit, known: !!ph, next: haNext(sc, cur, now) };
}
function haSchedHTML(t) {
  const s = haSchedRead(t); if (!s) return '';
  if (!s.known) return '<p class="tnote">Home Assistant hasn’t said where the schedule is yet.</p>';
  const we = !weekday(new Date());
  const why = s.lit === 'vacation' ? `Vacation is on: ${VAC_SET[0]}° heat, ${VAC_SET[1]}° cool until you turn it off. The schedule is paused.`
    : s.lit === 'hold' ? 'Sitter hold: the thermostats stay where they are until it’s released. The schedule is paused.'
    : s.lit === 'eco' ? 'Everyone is out: Eco until someone is home, then back to the schedule.' : '';
  const row = (cls, time, name, temps, tag) => `<div class="sstep${cls}"><span class="st-t">${time}</span><span class="st-a">${name}<small>${temps}</small></span><span class="st-tag">${tag}</span></div>`;
  const steps = s.sc.steps.map(x => {
    const now = x.p === s.cur, off = x.wk && we, nx = s.next && s.next.step === x && s.lit === s.cur;
    const tag = now ? (s.lit === s.cur ? 'Now' : 'Paused') : nx ? esc(s.next.when) : off ? 'Not today' : '';
    return row((now && s.lit === s.cur ? ' now' : now ? ' paused' : '') + (nx ? ' next' : '') + (off ? ' off' : ''),
      x.at ? esc(schTime(x.at)) : 'Goodnight', esc(x.name) + (x.wk ? ' · Mon–Fri' : ''), `${x.lo}–${x.hi}°`, tag);
  }).join('');
  const eco = row(s.lit === 'eco' ? ' now' : '', 'When away', 'Eco', `${HA_ECO[0]}–${HA_ECO[1]}°`, s.lit === 'eco' ? 'Now' : '');
  const vac = row(s.lit === 'vacation' ? ' now vac' : ' vac', 'When on', 'Vacation', `${VAC_SET[0]}–${VAC_SET[1]}°`, s.lit === 'vacation' ? 'Now' : '');
  return `<div class="group sgroup ha"><div class="ssteps solo" data-sched="${t.id}">${steps}<i class="ssep"></i>${eco}${vac}</div></div>`
    + (why ? `<p class="tnote sched-why">${why}</p>` : '');
}
const SCH_DAYS = { daily: 'Every day', workday: 'Weekdays', weekend: 'Weekends' };
const SCH_DAY = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

function tSchedules(t) {
  const out = [];
  for (const id in ents) {
    if (!id.startsWith('switch.schedule_')) continue;
    const A = ents[id].attributes || {};
    if (Array.isArray(A.entities) && A.entities.includes(t.ent)) out.push(id);
  }
  return out.sort();
}
// A step's time in the phone's own format: "06:30:00" -> "6:30 AM" (or 06:30);
// a sun-relative one, "sunrise+00:30:00" -> "Sunrise +30m"; a range as "a–b".
function schTime(x) {
  const m = /^(\d{1,2}):(\d{2})/.exec(x);
  if (m) { const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  const sun = /^(sunrise|sunset)([+-])(\d{2}):(\d{2})/.exec(x);
  if (sun) { const mins = +sun[3] * 60 + +sun[4]; return sun[1].replace(/^\w/, c => c.toUpperCase()) + (mins ? ` ${sun[2]}${mins >= 60 ? Math.floor(mins / 60) + 'h' : ''}${mins % 60 ? (mins % 60) + 'm' : ''}` : ''); }
  return x;
}
const hhmm = s => String(s || '').split(' - ').map(schTime).join('–');
// When the next step starts, as "22:00", "Tue 06:30" or a date.
function schWhen(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  // Short: "10 PM", "6:30 AM"; another day by its name ("Tue 6 PM").
  // (in Russian the hour alone would read "18": it keeps its minutes, "18:00")
  const now = new Date(), t = d.toLocaleTimeString([], d.getMinutes() || document.documentElement.lang === 'ru' ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  return days === 0 ? t : days < 7 ? d.toLocaleDateString([], { weekday: 'short' }) + ' ' + t : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + t;
}
// What a step does, in the thermostat's own words.
function schAction(t, a) {
  if (!a) return '—';
  const svc = String(a.service || '').replace(/^climate\./, ''), d = a.service_data || {};
  const n = v => Math.round(Number(v));
  const parts = [];
  if (d.hvac_mode) parts.push(modeName(t, d.hvac_mode));
  if (d.preset_mode) parts.push(d.preset_mode === 'none' ? 'No preset' : d.preset_mode.replace(/^\w/, c => c.toUpperCase()));
  if (d.target_temp_low != null && d.target_temp_high != null) parts.push(`${n(d.target_temp_low)}–${n(d.target_temp_high)}°`);
  else if (d.temperature != null) parts.push(`${n(d.temperature)}°`);
  if (d.fan_mode) parts.push('Fan ' + d.fan_mode);
  if (!parts.length) parts.push(svc === 'turn_off' ? 'Off' : svc === 'turn_on' ? 'On' : svc.replace(/_/g, ' '));
  return parts.map(esc).join(' · ');
}
function schRead(t, id) {
  const s = st(id), A = s.attributes, slots = A.timeslots || [], acts = A.actions || [];
  const d = dv('sched', id, A.friendly_name || 'Schedule');
  const on = held(d, 'on', s.state) !== 'off' && s.state !== 'completed';
  let cur = Number.isInteger(A.current_slot) ? A.current_slot : null, derived = false;
  if (cur == null && Number.isInteger(A.next_slot) && slots.length) { cur = (A.next_slot - 1 + slots.length) % slots.length; derived = true; }
  const name = String(A.friendly_name || id.replace('switch.schedule_', '').replace(/_/g, ' ')).replace(/^Schedule\s*/i, '') || 'Schedule';
  const days = (A.weekdays || []).map(w => SCH_DAYS[w] || SCH_DAY[w] || w).join(', ');
  return { id, d, A, on, slots, acts, cur, derived, next: Number.isInteger(A.next_slot) ? A.next_slot : null, when: A.next_trigger ? schWhen(A.next_trigger) : '', name, days };
}
// The card's line: the next change and what it sets ("10:00 PM → 64–78°"),
// from the schedule that changes next.
function tSchedChip(t) {
  const list = tSchedules(t).map(id => schRead(t, id)).filter(s => s.on);
  if (!list.length) return '';
  list.sort((a, b) => (Date.parse(a.A.next_trigger) || Infinity) - (Date.parse(b.A.next_trigger) || Infinity));
  const s = list[0];
  const now = s.cur != null ? schAction(t, s.acts[s.cur]) : '';
  const next = s.next != null ? schAction(t, s.acts[s.next]) : '';
  // Just the next change: when, and what to.
  const txt = next && s.when ? `${s.when} → ${next}` : now ? now : 'Scheduled';
  return `<span class="alert sched">${svg('timer', 13)}${txt}</span>`;
}
// The popup: each schedule, its steps, the one under way lit, and its switch.
function tSchedHTML(t) {
  const ids = tSchedules(t), ha = haSchedHTML(t);
  if (!ids.length && !ha) return '<p class="tnote">No schedule.</p>';
  return ha + ids.map(id => {
    const s = schRead(t, id);
    const steps = s.slots.map((slot, i) => `<div class="sstep${s.on && i === s.cur ? ' now' : ''}${s.on && i === s.next ? ' next' : ''}">
        <span class="st-t">${esc(hhmm(slot))}</span><span class="st-a">${schAction(t, s.acts[i])}</span>
        <span class="st-tag">${s.on && i === s.cur ? 'Now' : s.on && i === s.next ? (s.when ? esc(s.when) : 'Next') : ''}</span></div>`).join('');
    return `<div class="group sgroup">
      <button class="rowi${tWaiting(s.d, 'on') ? ' wait' : ''}" data-a="tsched" data-v="${esc(id)}" role="switch" aria-checked="${s.on}">${icon('timer')}
        <span class="k"><span translate="no">${esc(s.name)}</span><small>${esc(s.days || '')}${s.on ? '' : ' · paused'}</small></span><span class="sw${s.on ? ' on' : ''}" style="--tint:110,170,130"></span></button>
      <div class="ssteps">${steps}</div></div>`;
  }).join('');
}
// Pausing or resuming a schedule is its switch.
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a="tsched"]'); if (!b || b.disabled) return;
  const id = b.dataset.v, s = st(id); if (!s) return;
  const d = dv('sched', id, (s.attributes.friendly_name || 'Schedule')), on = held(d, 'on', s.state) !== 'off';
  tset(d, 'on', on ? 'off' : 'on'); render();
  tsend(d, 'switch', on ? 'turn_off' : 'turn_on', { entity_id: id }, ['on']);
});

// The preview: Home Assistant's profile helpers, where the clock puts them
// (as script.thermostat_set_phase_from_clock), and the sitter hold off.
SAMPLES.push(e => {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60, wk = weekday(d);
  return {
    'input_select.thermostat_lr_phase': e(h < 6 ? 'night' : h >= 17 ? 'evening' : wk && h >= 8 ? 'day' : 'morning', { options: ['morning', 'day', 'evening', 'night'] }),
    'input_select.thermostat_of_phase': e(h < 7 ? 'night' : h >= 19 ? 'evening' : 'morning', { options: ['morning', 'evening', 'night'] }),
    'input_boolean.thermostat_hold': e('off'),
  };
});
