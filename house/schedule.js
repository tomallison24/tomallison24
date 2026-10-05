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
  const now = new Date(), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  return days === 0 ? t : days === 1 ? 'tomorrow ' + t : days < 7 ? d.toLocaleDateString([], { weekday: 'short' }) + ' ' + t : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + t;
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
// The card's line: the step under way and until when, from the schedule
// that changes next.
function tSchedChip(t) {
  const list = tSchedules(t).map(id => schRead(t, id)).filter(s => s.on);
  if (!list.length) return '';
  list.sort((a, b) => (Date.parse(a.A.next_trigger) || Infinity) - (Date.parse(b.A.next_trigger) || Infinity));
  const s = list[0];
  const now = s.cur != null ? schAction(t, s.acts[s.cur]) : '';
  const next = s.next != null ? schAction(t, s.acts[s.next]) : '';
  const txt = now ? `${now}${s.when ? ' until ' + s.when : ''}` : next ? `Next ${next}${s.when ? ' at ' + s.when : ''}` : 'Scheduled';
  return `<span class="alert sched">${svg('timer', 13)}${txt}</span>`;
}
// The popup: each schedule, its steps, the one under way lit, and its switch.
function tSchedHTML(t) {
  const ids = tSchedules(t);
  if (!ids.length) return `<p class="tnote">No Home Assistant schedule controls this thermostat.${t.kind === 'nest' ? ' A schedule kept in the Nest app isn\'t visible to Home Assistant.' : ''}</p>`;
  return ids.map(id => {
    const s = schRead(t, id);
    const steps = s.slots.map((slot, i) => `<div class="sstep${s.on && i === s.cur ? ' now' : ''}${s.on && i === s.next ? ' next' : ''}">
        <span class="st-t">${esc(hhmm(slot))}</span><span class="st-a">${schAction(t, s.acts[i])}</span>
        <span class="st-tag">${s.on && i === s.cur ? 'Now' : s.on && i === s.next ? (s.when ? esc(s.when) : 'Next') : ''}</span></div>`).join('');
    return `<div class="group sgroup">
      <button class="rowi${tWaiting(s.d, 'on') ? ' wait' : ''}" data-a="tsched" data-v="${esc(id)}" role="switch" aria-checked="${s.on}">${icon('timer')}
        <span class="k">${esc(s.name)}<small>${esc(s.days || '')}${s.on ? '' : ' · paused'}</small></span><span class="sw${s.on ? ' on' : ''}" style="--tint:110,170,130"></span></button>
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

// The preview's schedules: the Living Room on weekdays, the Office every day.
SAMPLES.push(e => {
  const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d.toISOString(); };
  const LR = 'climate.living_room_living_room', OF = 'climate.office_office';
  return {
    'switch.schedule_living_room_weekdays': e('on', { friendly_name: 'Living Room weekdays', weekdays: ['workday'], entities: [LR],
      timeslots: ['06:30:00', '08:30:00', '17:00:00', '22:00:00'],
      actions: [{ service: 'climate.set_temperature', service_data: { target_temp_low: 68, target_temp_high: 74 } }, { service: 'climate.set_preset_mode', service_data: { preset_mode: 'eco' } },
        { service: 'climate.set_temperature', service_data: { target_temp_low: 68, target_temp_high: 74 } }, { service: 'climate.set_temperature', service_data: { target_temp_low: 64, target_temp_high: 78 } }],
      current_slot: null, next_slot: 3, next_trigger: at(22, 0), tags: [] }),
    'switch.schedule_office': e('on', { friendly_name: 'Office', weekdays: ['daily'], entities: [OF],
      timeslots: ['07:00:00 - 18:00:00', '18:00:00 - 07:00:00'],
      actions: [{ service: 'climate.set_temperature', service_data: { temperature: 70, hvac_mode: 'heat' } }, { service: 'climate.set_temperature', service_data: { temperature: 64 } }],
      current_slot: 0, next_slot: 1, next_trigger: at(18, 0), tags: [] }),
  };
});
