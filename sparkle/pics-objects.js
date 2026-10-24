'use strict';

// Sparkle Kingdom's picture words, part one: objects and vehicles (hat, bus, clock, ten...).
// A child sees a word (or hears a sound) and taps the matching picture, so each one is the most
// obvious version of its word, drawn to stay distinct from its look-alikes (pen and pencil, cup
// and mug, car, van, truck and bus, boat and ship). Same look as art.js: a soft plum outline
// (never black), flat pastel-leaning colour (true-to-life where that makes it easier to
// recognize, like the yellow school bus and the wooden chair), one gentle highlight, and a soft
// shadow under things that stand. No letters or digits: "ten" and "six" are things to count.
//
// Each picture is a function (uid) => SVG markup for a viewBox of 0 0 100 100, without the
// <svg> wrapper. uid(prefix) gives a unique id, for a picture that needs one.
(function (root) {
  const P = root.SparklePics = root.SparklePics || {};
  const INK = '#4B2E6F';
  const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const T = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const f = n => +n.toFixed(1);
  const C = {
    pink: '#FF8FC7', blush: '#FFB3DA', rose: '#FF5FA8', lilac: '#B79BFF', lav: '#D9CCFF', mint: '#7FE0C7', sky: '#8FD3FF',
    gold: '#FFC94A', amber: '#F5A623', cream: '#FFF6E9', peach: '#FFC7A8', coral: '#FF8A7A', teal: '#4FC3B8',
    wood: '#C98B5E', woodL: '#E9B872', woodD: '#8A5A3C', steel: '#DCE3EE', red: '#FF6B6B', tyre: '#6A5487', hub: '#E6E1F2',
  };

  // ---- little pieces ----
  const shadow = (rx = 30, cy = 92, cx = 50) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4" fill="${INK}" opacity=".12"/>`;
  const shine = d => `<path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
  const gleam = (cx, cy, rx, ry, rot = -30) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity=".5"/>`;
  const line = (d, w = 2, c = INK, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  // a stick or rope with an outline: a thick plum stroke under a thinner coloured one
  const rod = (d, w, c) => line(d, w + 3, INK) + line(d, w, c);
  const starPts = (x, y, r, k = .48) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * k : r; p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`); } return p.join(' '); };
  const heart = (x, y, s, fill, extra = '') => `<path d="M${x} ${f(y + s * .9)}C${f(x - s * 1.4)} ${f(y - s * .1)} ${f(x - s * .7)} ${f(y - s * 1.1)} ${x} ${f(y - s * .35)}C${f(x + s * .7)} ${f(y - s * 1.1)} ${f(x + s * 1.4)} ${f(y - s * .1)} ${x} ${f(y + s * .9)}Z" fill="${fill}" ${extra}/>`;
  const wheel = (x, y, r = 10) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.tyre}" ${O}/><circle cx="${x}" cy="${y}" r="${f(r * .45)}" fill="${C.hub}" ${T}/>`;
  const waves = (y, fill = C.sky) => `<path d="M2 ${y}Q10 ${y - 5} 18 ${y}T34 ${y}T50 ${y}T66 ${y}T82 ${y}T98 ${y}V96Q50 100 2 96Z" fill="${fill}" ${O}/>`;

  Object.assign(P, {
    hat: () => `<g>${shadow(40, 90)}
      <ellipse cx="50" cy="78" rx="43" ry="10" fill="${C.lilac}" ${O}/>
      <path d="M28 78L26 22Q50 15 74 22L72 78Q50 85 28 78Z" fill="${C.lilac}" ${O}/>
      <path d="M27.5 61Q50 68 72.5 61L72.2 73Q50 80 27.8 73Z" fill="${C.rose}" ${T}/>
      <ellipse cx="50" cy="21" rx="24" ry="6" fill="${C.lav}" ${O}/>
      ${shine('M34 31L35 54')}${heart(62, 67, 4.5, '#fff', 'opacity=".9"')}</g>`,

    map: () => `<g transform="rotate(-6 50 50)">${shadow(42, 90)}
      <path d="M16 22Q33 17 50 22T84 22V80Q67 85 50 80T16 80Z" fill="#FBE7B8" ${O}/>
      <rect x="8" y="18" width="12" height="66" rx="6" fill="#F2CF8A" ${O}/><rect x="80" y="18" width="12" height="66" rx="6" fill="#F2CF8A" ${O}/>
      <path d="M26 52L33 38L40 52Z" fill="${C.mint}" ${T}/><path d="M36 52L42 43L48 52Z" fill="${C.mint}" ${T}/>
      ${line('M28 70Q40 74 46 64T62 52T68 38', 3, C.coral, 'stroke-dasharray="1 6"')}
      ${line('M62 26L74 38M74 26L62 38', 5, INK)}${line('M62 26L74 38M74 26L62 38', 3, C.rose)}
      ${shine('M12 26V44')}</g>`,

    can: () => `<g>${shadow(30, 90)}
      <path d="M24 22V80A26 7 0 0 0 76 80V22Z" fill="${C.steel}" ${O}/>
      <path d="M24 33A26 7 0 0 0 76 33V69A26 7 0 0 1 24 69Z" fill="${C.coral}" ${T}/>
      <circle cx="50" cy="53" r="10" fill="${C.rose}" ${T}/><path d="M44 44Q50 40 56 44Q50 47 44 44Z" fill="#6CC24A" ${T}/>
      ${line('M24 75A26 7 0 0 0 76 75', 2, INK, 'opacity=".5"')}
      <ellipse cx="50" cy="22" rx="26" ry="7" fill="#EEF2F8" ${O}/><ellipse cx="50" cy="22" rx="20" ry="4.5" fill="none" ${T}/>
      ${shine('M30 38V64')}</g>`,

    bed: () => `<g>${shadow(44, 90)}
      <rect x="6" y="26" width="16" height="64" rx="7" fill="${C.wood}" ${O}/>
      <rect x="18" y="66" width="70" height="12" rx="3" fill="${C.wood}" ${O}/>
      <rect x="18" y="56" width="70" height="12" rx="4" fill="${C.cream}" ${O}/>
      <path d="M24 50Q24 42 34 42Q46 42 46 50Q46 58 34 58Q24 58 24 50Z" fill="#fff" ${O}/>
      <path d="M42 50Q64 46 90 52V72Q64 76 42 72Z" fill="${C.pink}" ${O}/>
      <path d="M42 50Q64 46 90 52V57Q64 52 42 56Z" fill="${C.blush}" ${T}/>
      ${heart(58, 64, 3.5, '#fff', 'opacity=".9"')}${heart(76, 65, 3.5, '#fff', 'opacity=".9"')}
      <rect x="82" y="48" width="12" height="42" rx="5" fill="${C.wood}" ${O}/>
      ${shine('M11 34V60')}</g>`,

    web: () => {
      const cx = 50, cy = 46, n = 8, rings = [11, 21, 31, 41];
      const pt = (r, i) => [cx + Math.cos(i * Math.PI * 2 / n - Math.PI / 2) * r, cy + Math.sin(i * Math.PI * 2 / n - Math.PI / 2) * r];
      let d = '';
      for (let i = 0; i < n; i++) { const [x, y] = pt(44, i); d += `M${cx} ${cy}L${f(x)} ${f(y)}`; }
      let rd = '';
      for (const r of rings) for (let i = 0; i < n; i++) {
        const [x1, y1] = pt(r, i), [x2, y2] = pt(r, i + 1), [mx, my] = pt(r * .8, i + .5);
        rd += `M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
      }
      return `<g>${line(d, 2.5)}${line(rd, 2)}
        ${line('M71 4V60', 1.5)}
        <g stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"><path d="M65 64l-7 -4M65 68l-8 1M66 71l-6 6M77 64l7 -4M77 68l8 1M76 71l6 6"/></g>
        <circle cx="71" cy="68" r="7" fill="${C.lilac}" ${T}/><circle cx="71" cy="60" r="4.5" fill="${C.lilac}" ${T}/>
        <circle cx="69.3" cy="59.5" r="1.2" fill="${INK}"/><circle cx="72.7" cy="59.5" r="1.2" fill="${INK}"/></g>`;
    },

    pen: () => `<g>${shadow(30, 88)}<g transform="rotate(135 50 50)">
      <rect x="4" y="46" width="10" height="8" rx="2" fill="#4A90D9" ${T}/>
      <rect x="11" y="43" width="58" height="14" rx="5" fill="${C.sky}" ${O}/>
      <rect x="60" y="43.5" width="16" height="13" rx="3" fill="#4A90D9" ${O}/>
      ${line('M65 45.5V54.5M70 45.5V54.5', 1.5)}
      <path d="M76 45L88 48.5V51.5L76 55Z" fill="${C.steel}" ${O}/><circle cx="90" cy="50" r="1.8" fill="${INK}"/>
      <path d="M16 43V38Q16 36 18 36H44Q46 36 46 38V39Q46 40 44 40H20V43" fill="#4A90D9" ${T}/>
      ${shine('M16 46.5H50')}</g>
      ${line('M10 86Q16 78 22 86T34 86', 3, '#4A90D9')}</g>`,

    pencil: () => `<g>${shadow(30, 88)}<g transform="rotate(135 50 50)">
      <rect x="4" y="42" width="16" height="16" rx="5" fill="${C.pink}" ${O}/>
      <rect x="16" y="42" width="11" height="16" rx="1" fill="${C.steel}" ${O}/>${line('M20 43V57M23.5 43V57', 1.5)}
      <path d="M68 42L88 50L68 58Z" fill="#F6D3A2" ${O}/><path d="M81 47.2L88 50L81 52.8Z" fill="#5A4A6A" ${T}/>
      <rect x="27" y="42" width="42" height="16" fill="${C.gold}" ${O}/>
      <rect x="27" y="47.5" width="42" height="5" fill="#FFE08A"/>${line('M27 47.5H69M27 52.5H69', 1.2, INK, 'opacity=".4"')}
      ${line('M27 42H69M27 58H69M27 42V58M69 42V58', 3)}
      ${shine('M32 45H60')}</g></g>`,

    ten: () => {
      let s = '';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) s += `<polygon points="${starPts(14 + c * 18, 38 + r * 24, 7.5)}" fill="${C.gold}" ${T}/>`;
      return `<g>${shadow(44, 84)}<rect x="5" y="26" width="90" height="48" rx="7" fill="${C.cream}" ${O}/>
        ${line('M23 26V74M41 26V74M59 26V74M77 26V74M5 50H95', 2)}${s}</g>`;
    },

    pin: () => `<g>${shadow(14, 90, 64)}<g transform="rotate(30 50 50)">
      <path d="M48.5 56H51.5L50 92Z" fill="#B9C3D4" ${T}/>
      <rect x="32" y="10" width="36" height="14" rx="7" fill="${C.rose}" ${O}/>
      <path d="M40 24H60L58 44H42Z" fill="${C.rose}" ${O}/>
      <path d="M28 52Q28 44 36 44H64Q72 44 72 52V54Q72 56 70 56H30Q28 56 28 54Z" fill="${C.rose}" ${O}/>
      ${shine('M37 15H52')}${shine('M45 28V38')}</g></g>`,

    box: () => `<g>${shadow(40, 90)}
      <path d="M46 30L80 40L94 26L60 16Z" fill="${C.woodL}" ${O}/>
      <path d="M20 44L46 30L80 40L54 54Z" fill="${C.woodD}" ${O}/>
      <path d="M20 44L54 54V90L20 80Z" fill="${C.woodL}" ${O}/>
      <path d="M54 54L80 40V78L54 90Z" fill="${C.wood}" ${O}/>
      <path d="M20 44L46 30L32 18L6 32Z" fill="${C.woodL}" ${O}/>
      <path d="M54 54L80 40L84 54L58 68Z" fill="${C.woodL}" ${O}/>
      ${shine('M25 52V70')}</g>`,

    bus: () => `<g>${shadow(46, 88)}
      <path d="M5 74V28Q5 22 11 22H78Q84 22 84 28V44H90Q96 44 96 50V74Q96 78 92 78H9Q5 78 5 74Z" fill="${C.gold}" ${O}/>
      ${[11, 25, 39, 53].map(x => `<rect x="${x}" y="28" width="11" height="13" rx="2" fill="${C.sky}" ${T}/>`).join('')}
      <rect x="68" y="28" width="12" height="40" rx="2" fill="${C.sky}" ${T}/>${line('M74 28V68M68 48H80', 2)}
      ${line('M5 54H68M80 58H96M5 62H68M80 66H96', 2)}
      <circle cx="92" cy="54" r="2.8" fill="${C.cream}" ${T}/><rect x="2" y="66" width="5" height="8" rx="1.5" fill="${C.coral}" ${T}/>
      ${wheel(24, 78, 10)}${wheel(78, 78, 10)}
      ${shine('M12 46H40')}</g>`,

    car: () => `<g>${shadow(40, 88)}
      <path d="M10 70Q8 54 22 52L30 50Q36 30 52 30Q66 30 72 48L82 50Q92 52 92 64V70Q92 74 88 74H14Q10 74 10 70Z" fill="${C.red}" ${O}/>
      <path d="M34 50Q38 36 49 36V50Z" fill="${C.sky}" ${T}/><path d="M53 36Q63 36 67 50H53Z" fill="${C.sky}" ${T}/>
      ${line('M51 52V68M56 57H60', 2)}
      <circle cx="88" cy="58" r="3" fill="${C.gold}" ${T}/><rect x="9" y="57" width="4" height="6" rx="1.5" fill="${C.gold}" ${T}/>
      ${wheel(28, 74, 10)}${wheel(72, 74, 10)}
      ${shine('M38 40Q41 35 45 34')}</g>`,

    van: () => `<g>${shadow(46, 90)}
      <path d="M6 76V24Q6 16 14 16H62Q70 16 75 24L86 42Q95 44 95 54V76Q95 80 91 80H10Q6 80 6 76Z" fill="${C.mint}" ${O}/>
      <path d="M64 22H68Q71 22 73 25L82 42H64Z" fill="${C.sky}" ${T}/>
      <rect x="12" y="22" width="20" height="18" rx="3" fill="${C.sky}" ${T}/><rect x="37" y="22" width="20" height="18" rx="3" fill="${C.sky}" ${T}/>
      ${line('M61 22V74M35 48H57M6 60H95', 2)}${line('M66 50H70', 2.5)}
      <circle cx="92" cy="58" r="2.8" fill="${C.gold}" ${T}/>
      ${wheel(26, 80, 10)}${wheel(76, 80, 10)}
      ${shine('M12 48H28')}</g>`,

    truck: () => `<g>${shadow(46, 90)}
      <rect x="6" y="62" width="88" height="10" rx="3" fill="#9C8BB8" ${O}/>
      <path d="M8 30Q16 12 30 18Q40 8 52 18Q60 16 62 30Z" fill="#B07A4F" ${O}/>
      <circle cx="26" cy="22" r="3" fill="#8A5A3C"/><circle cx="44" cy="17" r="2.5" fill="#8A5A3C"/>
      <path d="M5 28H63L59 62H11Z" fill="${C.amber}" ${O}/>${line('M9 40H61M10 50H60', 2, INK, 'opacity=".45"')}
      <path d="M66 62V32Q66 28 70 28H82Q86 28 88 32L95 48V62Z" fill="${C.gold}" ${O}/>
      <path d="M71 33H81L86 46H71Z" fill="${C.sky}" ${T}/>
      <circle cx="92" cy="55" r="2.6" fill="${C.cream}" ${T}/>
      ${wheel(22, 76, 12)}${wheel(48, 76, 12)}${wheel(80, 76, 12)}
      ${shine('M12 33H34')}</g>`,

    boat: () => `<g>
      ${rod('M48 66V10', 3, C.woodD)}
      <path d="M52 12L52 60L84 60Z" fill="#fff" ${O}/><path d="M44 18L44 60L18 60Z" fill="${C.pink}" ${O}/>
      <path d="M50 10L50 4L60 7Z" fill="${C.rose}" ${T}/>
      ${waves(82)}
      <path d="M10 64H90Q84 84 66 84H34Q16 84 10 64Z" fill="${C.coral}" ${O}/>
      <path d="M13 70H87" stroke="#fff" stroke-width="3" opacity=".8"/>${line('M10 64H90', 3)}
      ${shine('M58 24V50')}</g>`,

    ship: () => `<g>
      <path d="M14 20Q10 12 18 10Q22 4 28 8Q34 6 34 12" fill="${C.lav}" ${T}/>
      <rect x="22" y="14" width="10" height="24" rx="2" fill="${C.rose}" ${O}/><rect x="40" y="18" width="10" height="20" rx="2" fill="${C.rose}" ${O}/>
      <path d="M22 20H32M40 23H50" stroke="#fff" stroke-width="3"/>
      <rect x="16" y="36" width="58" height="22" rx="3" fill="#fff" ${O}/>
      ${[24, 34, 44, 54, 64].map(x => `<rect x="${x - 3}" y="42" width="6" height="7" rx="1.5" fill="${C.sky}" ${T}/>`).join('')}
      ${waves(84)}
      <path d="M2 56H98L88 86H12Z" fill="#6F8FE8" ${O}/>
      <path d="M8 76H92L88 86H12Z" fill="${C.coral}" ${T}/>
      ${[16, 28, 40, 52, 64, 76, 88].map(x => `<circle cx="${x}" cy="66" r="3.5" fill="${C.cream}" ${T}/>`).join('')}
      ${shine('M20 40H38')}</g>`,

    jet: () => `<g>${line('M14 86L26 74M6 74L18 62M22 94L34 82', 3, C.lav)}<g transform="rotate(45 50 50)">
      <path d="M44 42L8 64V71L44 60ZM56 42L92 64V71L56 60Z" fill="${C.sky}" ${O}/>
      <rect x="22" y="56" width="7" height="13" rx="3.5" fill="${C.lilac}" ${T}/><rect x="71" y="56" width="7" height="13" rx="3.5" fill="${C.lilac}" ${T}/>
      <path d="M45 78L32 88V92L46 87ZM55 78L68 88V92L54 87Z" fill="${C.sky}" ${O}/>
      <path d="M50 4Q57 12 57 28V80Q57 88 50 93Q43 88 43 80V28Q43 12 50 4Z" fill="#fff" ${O}/>
      <ellipse cx="50" cy="20" rx="3.6" ry="6.5" fill="${C.sky}" ${T}/>
      ${shine('M46.5 32V60')}</g></g>`,

    rocket: () => `<g transform="rotate(20 50 50)">
      <path d="M38 76Q50 104 62 76Z" fill="${C.amber}" ${O}/><path d="M44 77Q50 92 56 77Z" fill="${C.gold}"/>
      <path d="M33 54L16 72V84L36 74ZM67 54L84 72V84L64 74Z" fill="${C.rose}" ${O}/>
      <path d="M50 4Q70 20 68 56L66 76H34L32 56Q30 20 50 4Z" fill="#fff" ${O}/>
      <path d="M50 4Q62 13 66.5 28H33.5Q38 13 50 4Z" fill="${C.rose}" ${O}/>
      <circle cx="50" cy="44" r="9" fill="${C.sky}" ${O}/><circle cx="47" cy="41" r="2.5" fill="#fff" opacity=".7"/>
      <rect x="38" y="74" width="24" height="6" rx="2" fill="${C.lilac}" ${O}/>
      ${shine('M38 34V62')}</g>`,

    helicopter: () => `<g>${shadow(34, 92, 54)}
      ${line('M24 86H82M36 76V86M66 76V86', 3)}${line('M82 86Q88 86 88 82', 3)}
      <path d="M40 52L12 45Q8 45 8 49V52Q8 55 12 55L40 62Z" fill="${C.teal}" ${O}/>
      <circle cx="10" cy="48" r="3" fill="${C.lilac}" ${T}/><path d="M10 48L4 36M10 48L16 60" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M10 48L4 36M10 48L16 60" stroke="${C.lav}" stroke-width="2" stroke-linecap="round"/>
      <path d="M36 56Q36 32 60 32Q88 32 90 58Q90 78 64 78H50Q36 78 36 56Z" fill="${C.mint}" ${O}/>
      <path d="M64 36Q84 38 86 58H64Z" fill="${C.sky}" ${T}/>
      <rect x="56" y="22" width="6" height="11" fill="${C.lilac}" ${O}/>
      <rect x="10" y="16" width="88" height="6" rx="3" fill="${C.lav}" ${O}/><ellipse cx="59" cy="19" rx="6" ry="4.5" fill="${C.lilac}" ${O}/>
      ${shine('M42 50Q44 40 52 37')}</g>`,

    television: () => `<g>${shadow(36, 92)}
      ${line('M50 24L34 8M50 24L68 10', 3)}<circle cx="34" cy="8" r="3.5" fill="${C.rose}" ${T}/><circle cx="68" cy="10" r="3.5" fill="${C.rose}" ${T}/>
      ${line('M28 80L22 91M72 80L78 91', 4)}
      <rect x="8" y="22" width="84" height="60" rx="11" fill="${C.lilac}" ${O}/>
      <rect x="15" y="29" width="58" height="46" rx="8" fill="${C.sky}" ${O}/>
      ${line('M28 68A16 16 0 0 1 60 68', 4, C.rose)}${line('M33 68A11 11 0 0 1 55 68', 4, C.gold)}${line('M38 68A6 6 0 0 1 50 68', 4, C.mint)}
      <circle cx="82.5" cy="38" r="4.5" fill="${C.cream}" ${T}/><circle cx="82.5" cy="52" r="4.5" fill="${C.cream}" ${T}/>
      ${line('M79 63H86M79 68H86', 2)}
      ${shine('M20 36Q22 33 26 33')}</g>`,

    sock: uid => {
      const id = uid('sock');
      const shape = 'M32 8H62V50L80 60Q94 68 88 82Q82 94 68 88L40 76Q28 70 30 58Z';
      return `<g>${shadow(26, 92, 62)}<clipPath id="${id}"><path d="${shape}"/></clipPath>
        <path d="${shape}" fill="#fff"/>
        <g clip-path="url(#${id})">
          ${[20, 36, 52].map(y => `<rect x="20" y="${y}" width="50" height="8" fill="${C.pink}"/>`).join('')}
          ${[28, 44].map(y => `<rect x="20" y="${y}" width="50" height="8" fill="${C.lilac}"/>`).join('')}
          <rect x="20" y="4" width="50" height="12" fill="${C.mint}"/>${line('M38 6V16M44 6V16M50 6V16M56 6V16', 1.5, INK, 'opacity=".4"')}
          <circle cx="30" cy="72" r="13" fill="${C.rose}"/><circle cx="92" cy="84" r="14" fill="${C.rose}"/>
        </g>
        <path d="${shape}" fill="none" ${O}/>${line('M31 16H62', 2)}
        ${shine('M37 24V44')}</g>`;
    },

    violin: () => `<g>
      <g transform="rotate(-22 50 50) translate(-8 -2) scale(1.08) translate(-4 -4)">
        <path d="M50 26C60 26 65 30 64 38C63 44 58 46 59 52C60 56 68 58 67 70C66 80 58 86 50 86C42 86 34 80 33 70C32 58 40 56 41 52C42 46 37 44 36 38C35 30 40 26 50 26Z" fill="${C.wood}" ${O}/>
        <path d="M46.5 12H53.5L54.5 62H45.5Z" fill="#5C3A2E" ${T}/>
        <circle cx="50" cy="8" r="4.5" fill="#5C3A2E" ${T}/>${line('M44 14H47M53 16H56', 2.5)}
        ${line('M42 56Q40 60 43 62T42 68M58 56Q60 60 57 62T58 68', 2)}
        <path d="M46 72H54L52.5 84H47.5Z" fill="#5C3A2E" ${T}/><rect x="43" y="64" width="14" height="3" rx="1" fill="${C.cream}" ${T}/>
        ${line('M48.5 12V72M51.5 12V72', .8, C.cream)}
        ${shine('M40 36Q40 31 44 30')}</g>
      ${rod('M74 94L90 10', 2.5, C.woodD)}${line('M78 92L92 18', 2, C.cream)}${line('M90 10L92 18', 2)}
      <rect x="71" y="84" width="8" height="10" rx="2" transform="rotate(10 75 89)" fill="${C.woodD}" ${T}/></g>`,

    yoyo: () => `<g>${shadow(26, 94, 52)}
      ${rod('M50 10C40 20 60 30 52 44', 1.5, C.cream)}<circle cx="50" cy="8" r="4" fill="none" ${T}/>
      <circle cx="58" cy="60" r="27" fill="#E0458C" ${O}/>
      <circle cx="47" cy="63" r="27" fill="${C.rose}" ${O}/>
      <circle cx="47" cy="63" r="14" fill="${C.blush}" ${T}/><polygon points="${starPts(47, 63, 8)}" fill="#fff"/>
      ${shine('M28 54Q32 42 42 39')}</g>`,

    drum: () => `<g>${shadow(36, 90)}
      <path d="M18 42V74A32 10 0 0 0 82 74V42Z" fill="${C.rose}" ${O}/>
      ${line('M18 48L28 72L38 50L48 74L58 50L68 73L78 48', 2.5, C.gold)}
      <path d="M18 68A32 10 0 0 0 82 68V74A32 10 0 0 1 18 74Z" fill="${C.gold}" ${T}/>
      <path d="M18 42A32 10 0 0 0 82 42V48A32 10 0 0 1 18 48Z" fill="${C.gold}" ${T}/>
      <ellipse cx="50" cy="42" rx="32" ry="10" fill="${C.cream}" ${O}/>
      ${rod('M22 10L56 38', 4, C.woodL)}${rod('M78 10L44 38', 4, C.woodL)}
      <circle cx="21" cy="9" r="4" fill="${C.woodL}" ${T}/><circle cx="79" cy="9" r="4" fill="${C.woodL}" ${T}/>
      ${shine('M24 54V64')}</g>`,

    flag: () => `<g>${shadow(22, 91, 30)}
      <rect x="22" y="12" width="6" height="78" rx="2" fill="${C.steel}" ${O}/><circle cx="25" cy="9" r="5" fill="${C.gold}" ${O}/>
      <path d="M28 16Q44 8 60 16T92 16V54Q76 46 60 54T28 54Z" fill="${C.pink}" ${O}/>
      ${heart(60, 35, 10, '#fff')}
      ${shine('M33 22Q40 19 46 20')}</g>`,

    sled: () => `<g>
      <path d="M3 88Q6 76 28 77Q50 72 72 77Q94 76 97 88Q50 96 3 88Z" fill="#fff" ${O}/>
      <path d="M14 87Q30 84 44 86" fill="none" stroke="${C.lav}" stroke-width="3" stroke-linecap="round"/>
      ${line('M20 58V74M44 58V74M66 58V74', 3)}
      ${rod('M8 74H74Q90 74 90 60Q90 50 82 52', 3, C.rose)}
      <path d="M12 52L70 52L84 40L26 40Z" fill="${C.woodL}" ${O}/>
      ${line('M26 52L40 40M42 52L56 40M58 52L72 40', 2)}
      <path d="M12 52H70V58H12Z" fill="${C.wood}" ${O}/>
      ${line('M84 42Q94 36 92 26', 2.5, C.woodD)}
      ${shine('M20 48L28 42')}</g>`,

    clock: () => {
      let ticks = '';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r1 = i % 3 ? 21 : 19; ticks += `M${f(50 + Math.sin(a) * r1)} ${f(56 - Math.cos(a) * r1)}L${f(50 + Math.sin(a) * 24)} ${f(56 - Math.cos(a) * 24)}`; }
      return `<g>${shadow(30, 92)}
        ${line('M30 80L22 91M70 80L78 91', 4)}
        ${line('M28 14Q50 2 72 14', 3)}
        <path d="M14 26A13 13 0 0 1 36 12Z" fill="${C.gold}" ${O}/><path d="M86 26A13 13 0 0 0 64 12Z" fill="${C.gold}" ${O}/>
        <circle cx="50" cy="56" r="33" fill="${C.rose}" ${O}/><circle cx="50" cy="56" r="26" fill="${C.cream}" ${O}/>
        ${line(ticks, 2)}
        ${line('M50 56L39.5 48', 4)}${line('M50 56L66 46', 3)}<circle cx="50" cy="56" r="3" fill="${C.rose}" ${T}/>
        ${shine('M26 40Q30 32 38 28')}</g>`;
    },

    cup: () => `<g>${shadow(40, 92)}
      <ellipse cx="50" cy="80" rx="42" ry="10" fill="${C.blush}" ${O}/><ellipse cx="50" cy="79" rx="22" ry="5" fill="none" ${T} opacity=".5"/>
      ${rod('M78 48Q96 44 94 58Q92 68 74 68', 4, '#fff')}
      <path d="M18 42Q18 74 42 80H58Q82 74 82 42Z" fill="#fff" ${O}/>
      <path d="M20.5 54Q50 62 79.5 54" fill="none" stroke="${C.pink}" stroke-width="5"/>
      ${[30, 50, 70].map(x => heart(x, x === 50 ? 67 : 64, 3.2, C.rose)).join('')}
      <ellipse cx="50" cy="42" rx="32" ry="8" fill="#fff" ${O}/><ellipse cx="50" cy="43" rx="26" ry="5" fill="#E9B872"/>
      ${shine('M24 50Q25 60 30 66')}</g>`,

    mug: () => `<g>${shadow(36, 92, 48)}
      ${line('M34 14Q30 8 34 2M48 14Q44 8 48 2', 3, C.lilac)}
      ${rod('M68 32H78Q90 32 90 50Q90 70 78 70H68', 5, C.sky)}
      <path d="M18 22V84A26 6 0 0 0 70 84V22Z" fill="${C.sky}" ${O}/>
      <ellipse cx="44" cy="22" rx="26" ry="6" fill="${C.sky}" ${O}/><ellipse cx="44" cy="23" rx="21" ry="3.6" fill="#8A5A3C"/>
      ${heart(44, 56, 12, C.rose, T)}
      ${shine('M25 32V72')}</g>`,

    fan: () => {
      const blade = a => `<path d="M50 38Q42 20 50 12Q62 16 54 37Z" transform="rotate(${a} 50 40)" fill="${C.sky}" ${T}/>`;
      let spokes = '';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; spokes += `M${f(50 + Math.sin(a) * 8)} ${f(40 - Math.cos(a) * 8)}L${f(50 + Math.sin(a) * 32)} ${f(40 - Math.cos(a) * 32)}`; }
      return `<g>${shadow(30, 92)}
        <path d="M24 88Q24 80 50 80Q76 80 76 88Z" fill="${C.mint}" ${O}/>
        <rect x="45" y="64" width="10" height="18" fill="${C.mint}" ${O}/>
        <circle cx="50" cy="40" r="34" fill="#EEF9FF" ${O}/>
        ${blade(0)}${blade(120)}${blade(240)}
        ${line(spokes, 1.5, INK, 'opacity=".45"')}<circle cx="50" cy="40" r="20" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".45"/>
        <circle cx="50" cy="40" r="34" fill="none" ${O}/><circle cx="50" cy="40" r="7" fill="${C.mint}" ${O}/>
        <rect x="64" y="84" width="6" height="3" rx="1" fill="${C.rose}"/>
        ${shine('M24 30Q28 18 40 12')}</g>`;
    },

    net: uid => {
      const id = uid('mesh');
      return `<g><defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0H6M0 0V6" stroke="${INK}" stroke-width="1" opacity=".45"/></pattern></defs>
        ${rod('M14 94L52 44', 4, C.woodL)}
        <path d="M46 34Q46 66 66 78Q84 82 90 30Z" fill="#fff" ${O}/><path d="M46 34Q46 66 66 78Q84 82 90 30Z" fill="url(#${id})"/>
        <ellipse cx="68" cy="31" rx="22" ry="9" fill="none" stroke="${INK}" stroke-width="6.5"/><ellipse cx="68" cy="31" rx="22" ry="9" fill="none" stroke="${C.lilac}" stroke-width="3"/>
        <g transform="rotate(-15 22 22)"><path d="M22 22Q12 8 8 16Q6 24 22 22ZM22 22Q32 8 36 16Q38 24 22 22ZM22 22Q14 32 12 28Q12 24 22 22ZM22 22Q30 32 32 28Q32 24 22 22Z" fill="${C.pink}" ${T}/>${line('M22 16V28', 2.5)}</g></g>`;
    },

    mop: () => {
      const strands = [[20, 88], [26, 92], [32, 90], [38, 93], [44, 90], [50, 92], [56, 88]].map(([x, y], i) => `M${36 + i * 2} 70Q${x - 6} ${y - 12} ${x + 2} ${y - 6}T${x} ${y}`).join('');
      return `<g>${shadow(42, 93)}
        <path d="M60 56H94L90 90H64Z" fill="${C.sky}" ${O}/><ellipse cx="77" cy="56" rx="17" ry="4" fill="#C6E9FF" ${O}/>
        ${line('M62 56Q77 36 92 56', 2.5)}<circle cx="70" cy="52" r="3" fill="#fff" ${T}/><circle cx="76" cy="50" r="4" fill="#fff" ${T}/><circle cx="83" cy="52" r="3" fill="#fff" ${T}/>
        ${rod('M22 4L42 66', 4, C.woodL)}
        ${rod(strands, 3.5, C.cream)}
        <path d="M32 66H52L54 74Q44 78 30 74Z" fill="${C.lilac}" ${O}/>
        ${shine('M64 62L66 82')}</g>`;
    },

    pot: () => `<g>${shadow(40, 92)}
      ${line('M38 18Q34 12 38 6M50 18Q46 12 50 6M62 18Q58 12 62 6', 3, C.lilac)}
      <rect x="4" y="50" width="16" height="10" rx="5" fill="${C.tyre}" ${O}/><rect x="80" y="50" width="16" height="10" rx="5" fill="${C.tyre}" ${O}/>
      <path d="M16 44V76Q16 88 30 88H70Q84 88 84 76V44Z" fill="${C.coral}" ${O}/>
      <path d="M18 36Q22 26 50 26Q78 26 82 36Z" fill="${C.coral}" ${O}/>
      <rect x="12" y="36" width="76" height="8" rx="4" fill="${C.coral}" ${O}/>
      <rect x="43" y="19" width="14" height="8" rx="4" fill="${C.tyre}" ${O}/>
      ${shine('M22 54V76')}</g>`,

    key: () => `<g>${shadow(30, 88)}<g transform="rotate(-25 50 50)">
      <rect x="34" y="45" width="56" height="10" rx="3" fill="${C.gold}" ${O}/>
      <path d="M72 55V68H79V60H83V68H90V55Z" fill="${C.gold}" ${O}/>
      <rect x="34" y="41" width="6" height="18" rx="2" fill="${C.amber}" ${O}/>
      <path d="M22 32A18 18 0 1 1 22 68A18 18 0 1 1 22 32ZM22 40A10 10 0 1 0 22 60A10 10 0 1 0 22 40Z" fill="${C.gold}" fill-rule="evenodd" ${O}/>
      ${shine('M12 42Q14 36 19 35')}${shine('M48 48H70')}</g></g>`,

    spoon: () => `<g>${shadow(26, 90)}<g transform="rotate(35 50 50)">
      <path d="M48 44Q47 60 45 76Q44 93 50 93Q56 93 55 76Q53 60 52 44Z" fill="${C.steel}" ${O}/>
      <path d="M50 5C63 5 67 17 65 28C63 39 56 46 50 47C44 46 37 39 35 28C33 17 37 5 50 5Z" fill="${C.steel}" ${O}/>
      <path d="M60 18C62 30 58 38 50 41C56 36 59 28 58 18Z" fill="#B7C3D6"/>
      ${gleam(43, 20, 3.5, 8, 10)}${shine('M49.5 62L48.5 84')}</g></g>`,

    chair: () => `<g>${shadow(32, 92)}
      ${rod('M32 60V84M64 60V84', 4, C.wood)}
      <rect x="28" y="12" width="40" height="11" rx="4" fill="${C.wood}" ${O}/>
      ${rod('M38 23V54M48 23V54M58 23V54', 3, C.woodL)}
      <rect x="26" y="10" width="6" height="50" rx="2" fill="${C.wood}" ${O}/><rect x="64" y="10" width="6" height="50" rx="2" fill="${C.wood}" ${O}/>
      <path d="M26 56H70L78 66H18Z" fill="${C.woodL}" ${O}/>
      <rect x="18" y="66" width="60" height="7" rx="2" fill="${C.wood}" ${O}/>
      <rect x="20" y="72" width="7" height="20" rx="2" fill="${C.wood}" ${O}/><rect x="69" y="72" width="7" height="20" rx="2" fill="${C.wood}" ${O}/>
      ${shine('M29 16V40')}</g>`,

    house: () => `<g>${shadow(42, 92)}
      <rect x="64" y="12" width="11" height="24" rx="2" fill="${C.coral}" ${O}/>
      <rect x="16" y="44" width="68" height="46" rx="3" fill="${C.cream}" ${O}/>
      <path d="M6 48L50 12L94 48Q94 52 90 52H10Q6 52 6 48Z" fill="${C.rose}" ${O}/>
      <path d="M41 90V68Q41 60 50 60Q59 60 59 68V90Z" fill="${C.lilac}" ${O}/><circle cx="55" cy="76" r="1.8" fill="${INK}"/>
      <rect x="22" y="60" width="13" height="13" rx="2" fill="${C.sky}" ${T}/><rect x="65" y="60" width="13" height="13" rx="2" fill="${C.sky}" ${T}/>
      ${line('M28.5 60V73M22 66.5H35M71.5 60V73M65 66.5H78', 2)}
      ${heart(50, 34, 5, '#fff', 'opacity=".9"')}
      ${shine('M22 42L40 28')}</g>`,

    six: () => {
      const pips = [[30, 38], [30, 56], [30, 74], [58, 38], [58, 56], [58, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${INK}"/>`).join('');
      return `<g>${shadow(38, 92)}
        <path d="M14 30L24 18H86L76 30Z" fill="${C.lav}" ${O}/><path d="M76 30L86 18V78L76 90Z" fill="${C.lilac}" ${O}/>
        <rect x="12" y="26" width="64" height="64" rx="10" fill="#fff" ${O}/>
        ${pips}${gleam(21, 33, 3, 5, 40)}</g>`;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
