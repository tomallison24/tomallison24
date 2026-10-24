'use strict';

// Sparkle Kingdom's picture words, part two: food, nature, things to wear and find, and people.
// A child sees a word (or hears a sound) and taps the matching picture, so each one is the most
// obvious version of its word. Same look as art.js: a soft plum outline (never black), flat
// pastel-leaning colour (true-to-life where that makes it easier to recognize), one gentle
// highlight, a soft shadow under things that stand, and big friendly eyes where a face fits.
//
// Each picture is a function (uid) => SVG markup for a viewBox of 0 0 100 100, without the
// <svg> wrapper. uid(prefix) gives a unique id, for a picture that needs one.
(function (root) {
  const P = root.SparklePics = root.SparklePics || {};
  const INK = '#4B2E6F';
  const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const T = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const f = n => +n.toFixed(1);

  // ---- little pieces ----
  const shadow = (rx = 30, cy = 92, cx = 50) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4" fill="${INK}" opacity=".12"/>`;
  const shine = (cx, cy, rx, ry, rot = -30) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity=".5"/>`;
  const eye = (x, y, r = 4) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 1.2)}" fill="${INK}"/><circle cx="${f(x + r * .35)}" cy="${f(y - r * .45)}" r="${f(r * .42)}" fill="#fff"/>`;
  const blush = (x, y, rx = 4.5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${f(rx * .6)}" fill="#FF8FC7" opacity=".6"/>`;
  const line = (d, w = 2.5, c = INK, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const starPts = (x, y, r, k = .48, n = 5, sy = 1) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * k : r; p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr * sy)}`); } return p.join(' '); };
  const twinkle = (x, y, r, fill = '#fff') => `<path d="M${x} ${y - r}Q${f(x + r * .18)} ${f(y - r * .18)} ${x + r} ${y}Q${f(x + r * .18)} ${f(y + r * .18)} ${x} ${y + r}Q${f(x - r * .18)} ${f(y + r * .18)} ${x - r} ${y}Q${f(x - r * .18)} ${f(y - r * .18)} ${x} ${y - r}Z" fill="${fill}"/>`;
  // Overlapping circles drawn as one shape with one outline (clouds, leaves, curls).
  const blob = (cs, fill) => `<g fill="${INK}">${cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 1.5}"/>`).join('')}</g><g fill="${fill}">${cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 1.5}"/>`).join('')}</g>`;
  const leaf = (x, y, len, rot, fill = '#6CC24A') => `<path d="M${x} ${y}C${x + len * .3} ${y - len * .45} ${x + len * .75} ${y - len * .4} ${x + len} ${y}C${x + len * .75} ${y + len * .4} ${x + len * .3} ${y + len * .45} ${x} ${y}Z" transform="rotate(${rot} ${x} ${y})" fill="${fill}" ${T}/>`;
  // A moon shape: the outer circle minus a second circle, worked out once.
  const crescent = (cx, cy, R, ox, oy, r) => {
    const dx = ox - cx, dy = oy - cy, d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
    const px = cx + a * dx / d, py = cy + a * dy / d, A = [f(px + h * dy / d), f(py - h * dx / d)], B = [f(px - h * dy / d), f(py + h * dx / d)];
    return `M${A}A${R} ${R} 0 1 0 ${B}A${r} ${r} 0 0 1 ${A}Z`;
  };
  const MOON = crescent(46, 52, 40, 68, 40, 33);
  // A scallop shell's edge: bumps between ribs fanning out from the hinge.
  const SHELL = (() => {
    const hx = 50, hy = 80, R = 56, n = 7, a0 = -Math.PI / 2 - 0.95, step = 1.9 / n, pt = (a, r) => `${f(hx + Math.cos(a) * r)} ${f(hy + Math.sin(a) * r)}`;
    let d = `M${hx - 7} ${hy}L${pt(a0, R)}`, ribs = '';
    for (let i = 0; i < n; i++) { const a = a0 + i * step; d += `Q${pt(a + step / 2, R * 1.13)} ${pt(a + step, R)}`; if (i) ribs += `M${pt(a, 12)}L${pt(a, R - 1)}`; }
    return { d: d + `L${hx + 7} ${hy}Z`, ribs };
  })();

  Object.assign(P, {
    sun: () => {
      let rays = '';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, p = (r, s) => `${f(50 + Math.cos(a + s) * r)},${f(50 + Math.sin(a + s) * r)}`; rays += `<polygon points="${p(30, -.2)} ${p(46, 0)} ${p(30, .2)}"/>`; }
      return `<g><g fill="#F5A623" ${O}>${rays}</g><circle cx="50" cy="50" r="30" fill="#FFC94A" ${O}/>${shine(38, 34, 9, 5)}
        ${eye(40, 47)}${eye(60, 47)}${blush(33, 57)}${blush(67, 57)}${line('M43 59Q50 66 57 59', 3)}</g>`;
    },
    star: () => `<g>${shadow(28)}<polygon points="${starPts(50, 52, 44, .5)}" fill="#FFC94A" ${O}/>${shine(38, 38, 6, 3.5, -35)}</g>`,
    moon: () => `<g>${twinkle(80, 20, 7, '#FFC94A')}${twinkle(88, 52, 5, '#FFC94A')}${twinkle(72, 78, 4, '#B79BFF')}
      <path d="${MOON}" fill="#FFE27A" ${O}/>${shine(22, 40, 4, 9, 20)}
      ${line('M26 54q4 4 8 0', 2.5)}${blush(24, 63, 4)}${line('M32 68q4 3 8 -1', 2.5)}</g>`,
    tree: () => `<g>${shadow(26)}<path d="M44 92L46 62H54L56 92Z" fill="#B57A4C" ${O}/>
      ${blob([[50, 32, 22], [30, 46, 16], [70, 46, 16], [38, 60, 14], [62, 60, 14], [50, 54, 18]], '#6CC24A')}
      ${shine(40, 22, 8, 4.5)}<path d="M40 44q4 3 8 0M58 34q4 3 8 0M56 60q4 3 8 0" fill="none" stroke="#4FA43A" stroke-width="2.5" stroke-linecap="round"/></g>`,
    apple: () => `<g>${shadow(28)}<path d="M50 28C40 20 14 22 16 52C17 76 34 92 50 86C66 92 83 76 84 52C86 22 60 20 50 28Z" fill="#E8434A" ${O}/>
      <path d="M50 30C50 22 51 16 55 10" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M50 30C50 22 51 16 55 10" fill="none" stroke="#8B5A3C" stroke-width="3" stroke-linecap="round"/>
      ${leaf(54, 20, 22, -25)}${shine(30, 40, 7, 4, -50)}</g>`,
    banana: () => `<g>${shadow(30, 90)}<path d="M8 40C10 88 74 94 90 34L82 28C72 62 30 64 8 40Z" fill="#FFE14D" ${O}/>
      ${line('M20 60C38 76 66 74 82 46', 2, '#E2B220')}
      <path d="M82 29L86 12L93 14L90 33Z" fill="#A8B84A" ${T}/><path d="M86 12L93 14" stroke="#7A5232" stroke-width="3" stroke-linecap="round"/><circle cx="9" cy="41" r="3.2" fill="#7A5232"/>${shine(26, 66, 7, 2.5, 30)}</g>`,
    strawberry: () => `<g>${shadow(26)}<path d="M50 90C30 84 14 60 18 42C22 28 40 26 50 30C60 26 78 28 82 42C86 60 70 84 50 90Z" fill="#F0414E" ${O}/>
      ${[[32, 44], [50, 44], [68, 44], [40, 56], [60, 56], [30, 62], [70, 62], [50, 68], [42, 78], [58, 78]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.4" fill="#FFE38A"/>`).join('')}
      <polygon points="${starPts(50, 30, 20, .38, 6, .55)}" fill="#5DBB4C" ${O}/><path d="M50 26V14" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M50 26V14" stroke="#5DBB4C" stroke-width="3" stroke-linecap="round"/>${shine(28, 46, 5, 3, -60)}</g>`,
    tomato: () => `<g>${shadow(34)}<ellipse cx="50" cy="56" rx="38" ry="32" fill="#FF5446" ${O}/>
      <polygon points="${starPts(50, 28, 24, .32, 6, .5)}" fill="#5DBB4C" ${O}/><circle cx="50" cy="26" r="3.5" fill="#5DBB4C" ${T}/>${shine(26, 46, 6, 3.5, -60)}</g>`,
    watermelon: () => `<g>${shadow(40, 88)}<path d="M6 34H94A44 44 0 0 1 6 34Z" fill="#5DBB4C" ${O}/><path d="M12 34H88A38 38 0 0 1 12 34Z" fill="#D8F5B0"/>
      <path d="M16 34H84A34 34 0 0 1 16 34Z" fill="#FF5A6E" ${T}/>
      ${[[30, 44, -30], [44, 50, -10], [58, 50, 10], [70, 44, 30], [38, 60, -20], [52, 64, 0], [64, 58, 20]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3.2" transform="rotate(${r} ${x} ${y})" fill="${INK}"/>`).join('')}
      <path d="M6 34H94" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>${shine(26, 40, 6, 2, 0)}</g>`,
    avocado: () => `<g>${shadow(28)}<path d="M50 8C64 8 70 24 74 38C82 54 84 88 50 90C16 88 18 54 26 38C30 24 36 8 50 8Z" fill="#4E8A2E" ${O}/>
      <path d="M50 15C60 15 64 28 68 40C75 55 76 82 50 83C24 82 25 55 32 40C36 28 40 15 50 15Z" fill="#E4F29A" ${T}/>
      <circle cx="50" cy="62" r="15" fill="#A0663A" ${O}/>${shine(44, 56, 5, 3)}${shine(40, 30, 4, 7, 20)}</g>`,
    lemon: () => `<g>${shadow(34, 86)}<g transform="rotate(-14 50 54)"><path d="M10 54C12 50 16 48 21 46C32 24 68 24 79 46C84 48 88 50 90 54C88 58 84 60 79 62C68 84 32 84 21 62C16 60 12 58 10 54Z" fill="#FFE14D" ${O}/>${shine(36, 40, 9, 4, 0)}</g>${leaf(64, 30, 20, -40)}</g>`,
    pear: () => `<g>${shadow(30)}<path d="M50 20C60 20 62 32 64 42C66 52 82 58 82 74C82 88 66 92 50 92C34 92 18 88 18 74C18 58 34 52 36 42C38 32 40 20 50 20Z" fill="#C6DE5A" ${O}/>
      <path d="M50 21C50 16 51 12 54 8" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M50 21C50 16 51 12 54 8" fill="none" stroke="#8B5A3C" stroke-width="3" stroke-linecap="round"/>
      ${leaf(53, 14, 18, -20)}${shine(32, 64, 5, 8, 20)}</g>`,
    plum: () => `<g>${shadow(30)}<ellipse cx="50" cy="58" rx="34" ry="32" fill="#7E4FC4" ${O}/>${line('M50 28C40 40 40 66 48 88', 2, '#5E3399')}
      <path d="M50 28C50 22 51 18 54 13" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M50 28C50 22 51 18 54 13" fill="none" stroke="#8B5A3C" stroke-width="3" stroke-linecap="round"/>
      ${leaf(53, 18, 22, -15)}${shine(34, 46, 8, 5, -50)}</g>`,
    pumpkin: () => `<g>${shadow(38)}<ellipse cx="30" cy="60" rx="20" ry="28" fill="#F28A26" ${O}/><ellipse cx="70" cy="60" rx="20" ry="28" fill="#F28A26" ${O}/>
      <ellipse cx="50" cy="60" rx="20" ry="30" fill="#FF9F3A" ${O}/><path d="M46 32L47 18Q52 14 56 18L54 32Z" fill="#6E9A3A" ${T}/>
      ${line('M56 20q10 -6 14 2', 2.5, '#6E9A3A')}${shine(44, 46, 4, 9, 10)}</g>`,
    cupcake: () => `<g>${shadow(24)}<path d="M28 60H72L66 90H34Z" fill="#8FD3FF" ${O}/>${line('M40 62L42 88M50 62V88M60 62L58 88', 2, INK, 'opacity=".45"')}
      <path d="M22 62C18 50 28 46 34 46C34 36 44 32 50 34C56 32 66 36 66 46C72 46 82 50 78 62Z" fill="#FFB3DA" ${O}/>${line('M32 54q18 6 36 0', 2, '#FF8FC7')}
      ${[[34, 52, '#7FE0C7', 30], [62, 50, '#FFC94A', -30], [48, 44, '#B79BFF', 10], [70, 56, '#7FE0C7', 70]].map(([x, y, c, r]) => `<rect x="${x - 3}" y="${y - 1.2}" width="6" height="2.4" rx="1.2" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('')}
      ${line('M50 26Q52 16 60 12', 2.5)}<circle cx="50" cy="29" r="7" fill="#F0414E" ${O}/><circle cx="47.5" cy="26.5" r="2" fill="#fff" opacity=".7"/></g>`,
    cake: () => `<g><ellipse cx="50" cy="86" rx="44" ry="8" fill="#D9CCFF" ${O}/>
      <path d="M14 52V80A36 7 0 0 0 86 80V52Z" fill="#FFF6E9" ${O}/><path d="M14 66A36 7 0 0 0 86 66V71A36 7 0 0 1 14 71Z" fill="#FF8FC7"/>
      <path d="M14 52A36 8 0 0 1 86 52V58Q80 64 76 58Q70 66 64 59Q56 66 50 59Q44 66 36 59Q30 66 24 58Q18 64 14 58Z" fill="#FFB3DA" ${O}/>
      ${[[30, '#8FD3FF'], [50, '#7FE0C7'], [70, '#B79BFF']].map(([x, c]) => `<rect x="${x - 3.5}" y="28" width="7" height="22" rx="2" fill="${c}" ${T}/><path d="M${x} 10C${x + 5} 16 ${x + 5} 22 ${x} 23C${x - 5} 22 ${x - 5} 16 ${x} 10Z" fill="#FFC94A" ${T}/><ellipse cx="${x}" cy="19" rx="1.6" ry="2.4" fill="#F5A623"/>`).join('')}</g>`,
    egg: () => `<g>${shadow(24)}<path d="M50 10C70 10 80 46 80 62C80 80 66 90 50 90C34 90 20 80 20 62C20 46 30 10 50 10Z" fill="#FFF6E9" ${O}/>${shine(38, 32, 5, 10, 20)}</g>`,
    juice: () => `<g>${shadow(30)}<path d="M28 30L36 22H76L68 30Z" fill="#FFD9A8" ${O}/><path d="M68 30L76 22V82L68 90Z" fill="#F5A623" ${O}/>
      <rect x="22" y="30" width="46" height="60" rx="2" fill="#FFB347" ${O}/><circle cx="45" cy="62" r="14" fill="#FF9F1C" ${O}/>
      ${line('M45 48V76M31 62H59M35 52L55 72M55 52L35 72', 1.5, '#FFD9A8')}<circle cx="45" cy="62" r="14" fill="none" stroke="#FFF6E9" stroke-width="2.5"/>
      ${leaf(46, 47, 14, -50)}
      <path d="M56 26V8L66 4" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M56 26V8L66 4" fill="none" stroke="#FF5FA8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${shine(30, 40, 3, 6, 0)}</g>`,
    rainbow: () => {
      const cs = ['#FF6B6B', '#FFA54A', '#FFD84A', '#7FD66A', '#6FC3FF', '#A98BFF'], arc = r => `M${50 - r} 70A${r} ${r} 0 0 1 ${50 + r} 70`;
      return `<g><path d="${arc(29)}" fill="none" stroke="${INK}" stroke-width="35"/>${cs.map((c, i) => `<path d="${arc(41 - i * 5)}" fill="none" stroke="${c}" stroke-width="5.4"/>`).join('')}
        ${blob([[12, 72, 9], [22, 68, 11], [32, 74, 8], [18, 79, 8]], '#fff')}${blob([[88, 72, 9], [78, 68, 11], [68, 74, 8], [82, 79, 8]], '#fff')}</g>`;
    },
    log: () => `<g>${shadow(40, 86)}<path d="M28 36H80A12 23 0 0 1 80 82H28Z" fill="#A9693E" ${O}/>${line('M44 46H70M50 58H84M40 70H66', 2.5, '#7E4A28')}
      <ellipse cx="28" cy="59" rx="17" ry="23" fill="#F2C98A" ${O}/><ellipse cx="28" cy="59" rx="11" ry="15.5" fill="none" stroke="#C98E52" stroke-width="2"/><ellipse cx="28" cy="59" rx="5.5" ry="8" fill="none" stroke="#C98E52" stroke-width="2"/><circle cx="28" cy="59" r="1.6" fill="#C98E52"/>
      ${line('M64 36C64 28 66 24 70 20', 3, '#7E4A28')}${leaf(69, 21, 14, -40)}</g>`,
    shell: () => `<g>${shadow(34, 90)}<path d="${SHELL.d}" fill="#FFB8C2" ${O}/>${line(SHELL.ribs, 2, '#F07F93')}
      <path d="M38 78H62L66 90H34Z" fill="#FF9DAE" ${O}/>${shine(34, 42, 7, 3.5, -35)}</g>`,
    gem: () => `<g>${shadow(26, 92)}<path d="M18 36L32 18H68L82 36L50 86Z" fill="#FF8FC7" ${O}/><path d="M32 18L40 36H18Z" fill="#FFD0E8"/><path d="M60 36H82L50 86Z" fill="#E066A5" opacity=".7"/>
      ${line('M18 36H82M32 18L40 36L50 86L60 36L68 18M40 36L50 18L60 36', 2, INK, 'opacity=".55"')}<path d="M18 36L32 18H68L82 36L50 86Z" fill="none" ${O}/>${twinkle(30, 28, 5)}${twinkle(84, 16, 6, '#FFC94A')}</g>`,
    ring: () => `<g>${shadow(30)}<path d="M50 38A32 26 0 1 1 49.9 38ZM50 46A24 18 0 1 0 50.1 46Z" fill="#FFC94A" fill-rule="evenodd" ${O}/>${line('M28 58A24 18 0 0 1 40 46', 2.5, '#FFF1B8')}
      <path d="M40 40L44 34H56L60 40L50 46Z" fill="#F5A623" ${T}/><path d="M34 22L40 12H60L66 22L50 40Z" fill="#8FD3FF" ${O}/><path d="M34 22H66M40 12L45 22L50 40L55 22L60 12" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".5"/>
      ${twinkle(22, 18, 6, '#FFC94A')}${twinkle(80, 30, 5, '#FFC94A')}${twinkle(42, 16, 3)}</g>`,
    crown: () => `<g>${shadow(36, 88)}<path d="M16 80L10 32L32 52L50 20L68 52L90 32L84 80Z" fill="#FFC94A" ${O}/><rect x="15" y="66" width="70" height="16" rx="3" fill="#F5A623" ${O}/>
      ${[[10, 30], [50, 18], [90, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#FF8FC7" ${T}/>`).join('')}
      <circle cx="32" cy="74" r="4" fill="#8FD3FF" ${T}/><path d="M50 68L55 74L50 80L45 74Z" fill="#FF5FA8" ${T}/><circle cx="68" cy="74" r="4" fill="#7FE0C7" ${T}/>${shine(26, 50, 3, 7, -10)}</g>`,
    gift: () => `<g>${shadow(34)}<rect x="17" y="44" width="66" height="46" rx="6" fill="#B79BFF" ${O}/><rect x="12" y="32" width="76" height="16" rx="5" fill="#D9CCFF" ${O}/>
      <rect x="44" y="32" width="12" height="58" fill="#FF8FC7" ${T}/>
      <path d="M50 32C36 14 20 20 28 29C32 33 42 32 50 32C58 32 68 33 72 29C80 20 64 14 50 32Z" fill="#FF8FC7" ${O}/><circle cx="50" cy="31" r="4.5" fill="#FF5FA8" ${T}/>
      ${twinkle(28, 66, 5)}${twinkle(72, 76, 4)}${twinkle(88, 14, 6, '#FFC94A')}</g>`,
    igloo: () => `<g><path d="M4 84C10 76 30 76 50 77C70 76 90 76 96 84C90 92 10 92 4 84Z" fill="#fff" ${O}/>
      <path d="M10 80A40 44 0 0 1 90 80Z" fill="#EAF7FF" ${O}/>
      ${line('M13 66H87M20 52H80M34 40H66M24 80V66M78 80V66M30 66V52M50 66V52M70 66V52M42 52V40M58 52V40', 2.2, '#7FA9D9')}
      <path d="M34 82V70A16 16 0 0 1 66 70V82Z" fill="#EAF7FF" ${O}/><path d="M41 82V72A9 9 0 0 1 59 72V82Z" fill="${INK}"/>${shine(32, 46, 7, 3, -35)}</g>`,
    umbrella: () => `<g>${[[18, 20], [84, 18], [12, 40]].map(([x, y]) => `<path d="M${x} ${y - 5}C${x + 4} ${y} ${x + 4} ${y + 4} ${x} ${y + 4}C${x - 4} ${y + 4} ${x - 4} ${y} ${x} ${y - 5}Z" fill="#8FD3FF" ${T}/>`).join('')}
      ${line('M50 50V82Q50 90 42 90Q35 90 35 83', 8)}${line('M50 50V82Q50 90 42 90Q35 90 35 83', 3.5, '#F5A623')}
      <path d="M10 52C12 26 32 14 50 14C68 14 88 26 90 52Q80 44 70 52Q60 44 50 52Q40 44 30 52Q20 44 10 52Z" fill="#FF8FC7" ${O}/>
      <path d="M50 14C40 24 32 38 30 52L50 52C50 40 50 24 50 14Z" fill="#FFB3DA"/><path d="M50 14C60 24 68 38 70 52" fill="none" ${T}/><path d="M50 14C40 24 32 38 30 52M50 14V52" fill="none" ${T}/>
      <path d="M10 52C12 26 32 14 50 14C68 14 88 26 90 52Q80 44 70 52Q60 44 50 52Q40 44 30 52Q20 44 10 52Z" fill="none" ${O}/><circle cx="50" cy="12" r="3" fill="#F5A623" ${T}/></g>`,
    tent: () => `<g>${shadow(42, 88)}<path d="M50 16L90 86H10Z" fill="#4FC3B8" ${O}/><path d="M50 30L66 86H34Z" fill="${INK}"/>
      <path d="M50 30L34 86H24Z" fill="#9BEBDD" ${O}/><path d="M50 30L66 86H76Z" fill="#9BEBDD" ${O}/>
      ${line('M50 16L50 8', 3.5)}${line('M10 86L4 90M90 86L96 90', 2.5)}${shine(40, 40, 3, 8, 30)}</g>`,
    nose: uid => { const c = uid('nose'); return `<g><clipPath id="${c}"><circle cx="50" cy="54" r="38"/></clipPath><circle cx="12" cy="56" r="8" fill="#FFD9BF" ${O}/><circle cx="88" cy="56" r="8" fill="#FFD9BF" ${O}/><circle cx="50" cy="54" r="38" fill="#FFD9BF"/>
      <path d="M8 50V8H92V50C80 34 64 30 50 34C36 30 20 34 8 50Z" fill="#9A5B34" ${O} clip-path="url(#${c})"/><circle cx="50" cy="54" r="38" fill="none" ${O}/>${eye(34, 46, 4)}${eye(66, 46, 4)}${blush(26, 64, 5)}${blush(74, 64, 5)}
      <path d="M50 36C47 46 37 54 36 64C35 74 42 78 50 76C58 78 65 74 64 64C63 54 53 46 50 36Z" fill="#FFA987" ${O}/>
      <ellipse cx="45" cy="71" rx="2.4" ry="1.6" fill="${INK}" opacity=".5"/><ellipse cx="55" cy="71" rx="2.4" ry="1.6" fill="${INK}" opacity=".5"/>${shine(45, 58, 3, 6, 20)}
      ${line('M44 84Q50 88 56 84', 2.5)}</g>`; },
    leg: () => `<g>${shadow(28, 93, 60)}<path d="M30 4H68L66 20H32Z" fill="#6FB6F0" ${O}/>
      <path d="M38 16C37 30 40 42 40 50C38 58 40 64 43 70H57C57 62 59 56 60 50C61 42 62 30 62 16Z" fill="#FFD9BF" ${O}/>${line('M53 50q3 1.5 6 -0.5', 2, '#E8A986')}
      <path d="M42 66H58V79H42Z" fill="#fff" ${O}/>${line('M42 71H58M42 75H58', 2, '#FF8FC7')}
      <path d="M40 78H58C68 78 84 80 86 87C86 90 85 92 82 92H40C38 92 37 90 37 88V82C37 80 38 78 40 78Z" fill="#FF8FC7" ${O}/><path d="M37 88H86" fill="none" ${T}/>
      ${line('M62 80l2 4M68 80l2 4', 2)}${shine(45, 30, 2.5, 7, 0)}</g>`,
    clown: () => `<g>${blob([[14, 46, 10], [12, 62, 10], [20, 76, 9], [86, 46, 10], [88, 62, 10], [80, 76, 9]], '#FF8FC7')}
      ${blob([[22, 38, 8], [18, 54, 7], [78, 38, 8], [82, 54, 7]], '#8FD3FF')}<circle cx="50" cy="58" r="32" fill="#FFF6E9" ${O}/>
      <path d="M34 30L50 4L66 30Z" fill="#B79BFF" ${O}/><circle cx="50" cy="5" r="5" fill="#FFC94A" ${T}/><circle cx="46" cy="20" r="2.5" fill="#FFC94A"/><circle cx="56" cy="24" r="2.5" fill="#7FE0C7"/>
      ${line('M37 40l3 4M63 40l-3 4', 2, '#B79BFF')}${eye(38, 52, 4.5)}${eye(62, 52, 4.5)}
      <path d="M34 70Q50 88 66 70Q50 76 34 70Z" fill="#FF5A6E" ${O}/><circle cx="50" cy="63" r="7" fill="#F0414E" ${O}/><circle cx="48" cy="61" r="2" fill="#fff" opacity=".7"/>${blush(30, 64)}${blush(70, 64)}</g>`,
    robot: () => `<g>${shadow(30)}${line('M50 16V6', 3)}<circle cx="50" cy="6" r="4.5" fill="#FF5FA8" ${T}/>
      <rect x="20" y="40" width="10" height="20" rx="5" fill="#B79BFF" ${O}/><rect x="70" y="40" width="10" height="20" rx="5" fill="#B79BFF" ${O}/>
      <rect x="36" y="76" width="10" height="14" rx="3" fill="#B79BFF" ${O}/><rect x="54" y="76" width="10" height="14" rx="3" fill="#B79BFF" ${O}/>
      <rect x="28" y="50" width="44" height="30" rx="7" fill="#8FD3FF" ${O}/><rect x="40" y="57" width="20" height="14" rx="3" fill="#D9CCFF" ${T}/>
      <circle cx="45" cy="64" r="2.5" fill="#FF5FA8"/><circle cx="55" cy="64" r="2.5" fill="#FFC94A"/>
      <rect x="26" y="16" width="48" height="34" rx="8" fill="#8FD3FF" ${O}/><rect x="20" y="26" width="6" height="12" rx="2" fill="#FFC94A" ${T}/><rect x="74" y="26" width="6" height="12" rx="2" fill="#FFC94A" ${T}/>
      <circle cx="40" cy="31" r="7" fill="#fff" ${T}/><circle cx="60" cy="31" r="7" fill="#fff" ${T}/>${eye(40, 31, 3.5)}${eye(60, 31, 3.5)}
      ${line('M43 42Q50 46 57 42', 2.5)}${shine(32, 22, 4, 2, -20)}</g>`,
    wig: () => `<g>${shadow(26)}<path d="M30 92C30 84 38 82 50 82C62 82 70 84 70 92Z" fill="#C98E52" ${O}/><rect x="46" y="64" width="8" height="20" fill="#C98E52" ${O}/>
      <ellipse cx="50" cy="44" rx="20" ry="25" fill="#ECE6F4" ${O}/>
      ${blob([[50, 13, 11], [36, 17, 10], [64, 17, 10], [26, 27, 10], [74, 27, 10], [42, 25, 8], [58, 25, 8], [22, 40, 9], [78, 40, 9], [22, 53, 9], [78, 53, 9], [25, 65, 8], [75, 65, 8]], '#FFD25E')}
      ${line('M45 11q3 -3 6 0M31 16q3 -3 6 0M61 16q3 -3 6 0M21 27q3 -3 6 0M71 27q3 -3 6 0M17 41q3 -3 6 0M77 41q3 -3 6 0M18 54q3 -3 6 0M76 54q3 -3 6 0', 2, '#E9A93F')}${shine(40, 12, 5, 2.5, -20)}</g>`,
  });
})(typeof window !== 'undefined' ? window : globalThis);
