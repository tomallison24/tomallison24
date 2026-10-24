'use strict';

// The kingdom, drawn in code: floating islands in a pastel sky, joined by paths and a rainbow
// bridge, with her castle in the middle, Story Tower and the Gem Mine to explore, Star Meadow behind
// a memory door, and the lands still under the Grey Fog (the Fairy Garden and the Tiara Workshop,
// which open in a later chapter). Also the backdrops behind a round in each land.
//
// The paths are a little graph (NODES, EDGES): the unicorn walks it, and some paths have a gate:
//   sign    a signpost to read (Story Tower's road)
//   bridge  a rainbow bridge to mend by counting planks (the Gem Mine's)
//   door    a crystal door that opens to a sparkle pattern (Star Meadow's)
// A gate is passed once a session (app.js); the next session it asks again, at her level.
// Things to find: stars and critters hidden about the islands (STARS, CRITTERS).
(function (root) {
  const A = root.SparkleArt;
  const { C, INK, star, twinkle, heart, shade, uid } = A;
  const OUT = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const THIN = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const W = 1000, H = 1500;

  const NODES = {
    castle: { x: 500, y: 752, name: 'your castle' },
    sign: { x: 372, y: 560, name: 'the signpost' },
    tower: { x: 282, y: 392, name: 'Story Tower', land: 'read' },
    bridgeA: { x: 646, y: 640, name: 'the rainbow bridge' },
    bridgeB: { x: 746, y: 560 },
    mine: { x: 790, y: 470, name: 'the Gem Mine', land: 'math' },
    door: { x: 580, y: 900, name: 'the crystal door' },
    meadow: { x: 760, y: 930, name: 'Star Meadow' },
    garden: { x: 262, y: 1130, name: 'the Fairy Garden', land: 'garden', fog: 'garden' },
    workshop: { x: 752, y: 1180, name: 'the Tiara Workshop', land: 'spell', fog: 'workshop' },
  };
  // [from, to, its gate, the fog that hides it until that land opens]. The paths to the Fairy Garden and the
  // Tiara Workshop are steps of cloud across the sky, each with its own gate: a flower arch that opens for a
  // rhyme, and a gem door that opens for a word spelled.
  const EDGES = [['castle', 'sign'], ['sign', 'tower', 'sign'], ['castle', 'bridgeA'], ['bridgeA', 'bridgeB', 'bridge'], ['bridgeB', 'mine'],
    ['castle', 'door'], ['door', 'meadow', 'door'], ['castle', 'garden', 'flower', 'garden'], ['door', 'workshop', 'tiara', 'workshop']];
  const LANDS_FOGGED = ['garden', 'workshop'];
  const STARS = [{ id: 'st1', x: 196, y: 470 }, { id: 'st2', x: 870, y: 400 }, { id: 'st3', x: 610, y: 760 }, { id: 'st4', x: 830, y: 980 }, { id: 'st5', x: 700, y: 870 },
    { id: 'st6', x: 350, y: 300 }, { id: 'st7', x: 402, y: 760 }, { id: 'st8', x: 690, y: 975 }];
  const CRITTERS = [{ id: 'snail', x: 330, y: 470, name: 'a snail in a shell hat' }, { id: 'bunny', x: 840, y: 905, name: 'a bunny in boots' },
    { id: 'ladybug', x: 880, y: 520, name: 'a ladybug with a bow' }, { id: 'frog', x: 418, y: 812, name: 'a frog in a crown' }];

  // the shortest walk between two places (breadth first), as a list of node ids
  // open: { garden: true, ... } the lands the fog has lifted from
  function route(from, to, open = {}) {
    if (from === to) return [from];
    const next = {}; for (const [a, b, , fog] of EDGES) { if (fog && !open[fog]) continue; (next[a] = next[a] || []).push(b); (next[b] = next[b] || []).push(a); }
    const prev = { [from]: null }, q = [from];
    while (q.length) { const n = q.shift(); for (const m of next[n] || []) if (!(m in prev)) { prev[m] = n; if (m === to) { const p = [m]; let k = n; while (k) { p.unshift(k); k = prev[k]; } return p; } q.push(m); } }
    return null;
  }
  const gateOn = (a, b) => { const e = EDGES.find(([x, y]) => (x === a && y === b) || (x === b && y === a)); return e ? e[2] || null : null; };
  const nearest = (x, y, open = {}) => Object.entries(NODES).filter(([, n]) => !n.fog || open[n.fog]).sort(([, p], [, q]) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0][0];

  // ---- pieces of the world ----
  // an island: a grassy top and a rocky underside hanging below, with crystals
  function island(cx, cy, rx, ry, grass = '#B8EFA8', rock = '#C9B2F0', crystal = C.pink) {
    const dk = shade(rock, -0.15), g2 = shade(grass, -0.12);
    return `<g class="island">
      <path d="M${cx - rx} ${cy}C${cx - rx * 0.8} ${cy + ry * 2.2} ${cx - rx * 0.2} ${cy + ry * 3.3} ${cx} ${cy + ry * 3.6}C${cx + rx * 0.25} ${cy + ry * 3.2} ${cx + rx * 0.85} ${cy + ry * 2.1} ${cx + rx} ${cy}Z" fill="${rock}" ${OUT}/>
      <path d="M${cx - rx * 0.5} ${cy + ry * 1.2}L${cx - rx * 0.32} ${cy + ry * 2.2}M${cx + rx * 0.3} ${cy + ry * 1.1}L${cx + rx * 0.12} ${cy + ry * 2.5}" stroke="${dk}" stroke-width="4" stroke-linecap="round"/>
      <path d="M${cx - 14} ${cy + ry * 3.2}L${cx - 6} ${cy + ry * 3.9}L${cx + 2} ${cy + ry * 3.25}Z" fill="${crystal}" ${THIN}/><path d="M${cx + rx * 0.4} ${cy + ry * 1.9}l8 18l8 -18Z" fill="${C.sky}" ${THIN}/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${grass}" ${OUT}/>
      <path d="M${cx - rx + 10} ${cy + 6}C${cx - rx * 0.4} ${cy + ry * 0.9} ${cx + rx * 0.4} ${cy + ry * 0.9} ${cx + rx - 10} ${cy + 6}" fill="none" stroke="${g2}" stroke-width="5" stroke-linecap="round"/>
    </g>`;
  }
  const flower = (x, y, c) => `<g>${[0, 72, 144, 216, 288].map(a => `<circle cx="${x + 7 * Math.cos(a * Math.PI / 180)}" cy="${y + 7 * Math.sin(a * Math.PI / 180)}" r="5.5" fill="${c}" ${THIN}/>`).join('')}<circle cx="${x}" cy="${y}" r="4" fill="${C.gold}"/></g>`;
  const bush = (x, y, s = 1, c = '#8FDE96') => `<path d="M${x - 26 * s} ${y}C${x - 34 * s} ${y - 20 * s} ${x - 14 * s} ${y - 30 * s} ${x - 6 * s} ${y - 20 * s}C${x} ${y - 36 * s} ${x + 24 * s} ${y - 30 * s} ${x + 18 * s} ${y - 14 * s}C${x + 34 * s} ${y - 14 * s} ${x + 32 * s} ${y} ${x + 22 * s} ${y}Z" fill="${c}" ${OUT}/>`;
  const mushroom = (x, y, c = C.rose) => `<rect x="${x - 6}" y="${y - 18}" width="12" height="18" rx="5" fill="${C.cream}" ${THIN}/><path d="M${x - 18} ${y - 16}C${x - 18} ${y - 40} ${x + 18} ${y - 40} ${x + 18} ${y - 16}Z" fill="${c}" ${OUT}/><circle cx="${x - 6}" cy="${y - 28}" r="3.5" fill="#fff"/><circle cx="${x + 7}" cy="${y - 24}" r="2.8" fill="#fff"/>`;

  function castle(x, y) {   // her castle: pink towers, gold roofs, flags, a heart door
    const tower = (tx, ty, w, h, roof) => `<rect x="${tx - w / 2}" y="${ty - h}" width="${w}" height="${h}" fill="${C.blush}" ${OUT}/><path d="M${tx - w / 2 - 8} ${ty - h}L${tx} ${ty - h - roof}L${tx + w / 2 + 8} ${ty - h}Z" fill="${C.lilac}" ${OUT}/>
      <path d="M${tx} ${ty - h - roof}V${ty - h - roof - 26}" stroke="${INK}" stroke-width="3"/><path d="M${tx} ${ty - h - roof - 26}l22 6l-22 7Z" fill="${C.rose}" ${THIN}/><rect x="${tx - 7}" y="${ty - h + 22}" width="14" height="22" rx="7" fill="${C.sky}" ${THIN}/>`;
    return `<g class="place castle">${tower(x - 70, y, 46, 120, 54)}${tower(x + 70, y, 46, 120, 54)}
      <rect x="${x - 56}" y="${y - 92}" width="112" height="92" fill="${C.pink}" ${OUT}/>${[-48, -24, 0, 24].map(d => `<rect x="${x + d}" y="${y - 106}" width="16" height="16" fill="${C.pink}" ${THIN}/>`).join('')}
      ${tower(x, y - 60, 52, 90, 64)}
      <path d="M${x - 20} ${y}V${y - 34}C${x - 20} ${y - 54} ${x + 20} ${y - 54} ${x + 20} ${y - 34}V${y}Z" fill="${C.berry}" ${OUT}/>${heart(x, y - 30, 8, C.gold)}
      ${star(x, y - 260, 13, C.gold, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`)}${twinkle(x - 110, y - 160, 9, '#fff')}${twinkle(x + 112, y - 190, 7, '#fff')}</g>`;
  }
  function towerHouse(x, y) {   // Story Tower: a tall spiral library, books flapping round it
    const book = (bx, by, c, r) => `<g transform="translate(${bx} ${by}) rotate(${r})" class="flap"><path d="M0 0L-18 -8L-18 10L0 18Z" fill="${c}" ${THIN}/><path d="M0 0L18 -8L18 10L0 18Z" fill="${shade(c, 0.3)}" ${THIN}/></g>`;
    return `<g class="place tower">
      <path d="M${x - 50} ${y}L${x - 38} ${y - 200}H${x + 38}L${x + 50} ${y}Z" fill="${C.lav}" ${OUT}/>
      ${[0, 1, 2, 3].map(i => `<path d="M${x - 48 + i * 3} ${y - 30 - i * 46}Q${x} ${y - 10 - i * 46} ${x + 48 - i * 3} ${y - 50 - i * 46}" fill="none" stroke="${C.lilac}" stroke-width="6" stroke-linecap="round"/>`).join('')}
      <path d="M${x - 50} ${y - 200}L${x} ${y - 280}L${x + 50} ${y - 200}Z" fill="${C.lilac}" ${OUT}/>${star(x, y - 286, 12, C.gold, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`)}
      <circle cx="${x}" cy="${y - 160}" r="18" fill="${C.gold}" ${OUT}/><path d="M${x - 12} ${y - 160}H${x + 12}M${x} ${y - 172}V${y - 148}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M${x - 16} ${y}V${y - 30}C${x - 16} ${y - 48} ${x + 16} ${y - 48} ${x + 16} ${y - 30}V${y}Z" fill="${C.berry}" ${OUT}/>
      ${book(x - 84, y - 200, C.rose, -14)}${book(x + 82, y - 236, C.sky, 12)}${book(x + 74, y - 120, C.mint, -8)}${book(x - 76, y - 110, C.gold, 10)}</g>`;
  }
  function mineHill(x, y) {   // the Gem Mine: a rocky hill, a glowing cave mouth, candy-striped rails
    return `<g class="place mine">
      <path d="M${x - 110} ${y}C${x - 96} ${y - 110} ${x - 40} ${y - 160} ${x + 10} ${y - 150}C${x + 70} ${y - 140} ${x + 110} ${y - 80} ${x + 112} ${y}Z" fill="#B9A7E6" ${OUT}/>
      <path d="M${x - 40} ${y}V${y - 50}C${x - 40} ${y - 100} ${x + 40} ${y - 100} ${x + 40} ${y - 50}V${y}Z" fill="#3E2A66" ${OUT}/>
      <path d="M${x - 40} ${y - 50}C${x - 40} ${y - 100} ${x + 40} ${y - 100} ${x + 40} ${y - 50}" fill="none" stroke="#8B6A3E" stroke-width="12"/>
      ${[[x - 18, y - 30, C.pink], [x + 6, y - 46, C.sky], [x + 24, y - 24, C.mint]].map(([gx, gy, c]) => `<path d="M${gx} ${gy}l-9 -16l9 -14l9 14Z" fill="${c}" ${THIN}/>`).join('')}
      ${[[x - 76, y - 70, C.pink], [x + 70, y - 96, C.gold], [x - 20, y - 130, C.mint], [x + 40, y - 120, C.sky]].map(([gx, gy, c]) => `<path d="M${gx} ${gy}l-12 -20l12 -16l12 16Z" fill="${c}" ${OUT}/>`).join('')}
      <path d="M${x - 90} ${y + 12}H${x + 100}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M${x - 90} ${y + 12}H${x + 100}" stroke="#fff" stroke-width="5" stroke-dasharray="10 10"/>
      <g transform="translate(${x + 64} ${y - 4})"><path d="M-30 -30H30L24 4H-24Z" fill="${C.coral}" ${OUT}/><circle cx="-14" cy="8" r="7" fill="${INK}"/><circle cx="14" cy="8" r="7" fill="${INK}"/>
        <path d="M-20 -30l8 -14l8 14M2 -30l10 -16l10 16" fill="${C.pink}" ${THIN}/></g></g>`;
  }
  function meadowArch(x, y) {   // Star Meadow's crystal door
    return `<g class="place door"><path d="M${x - 36} ${y}V${y - 70}C${x - 36} ${y - 118} ${x + 36} ${y - 118} ${x + 36} ${y - 70}V${y}" fill="#E6F7FF" fill-opacity=".7" ${OUT}/>
      <path d="M${x - 22} ${y}V${y - 66}C${x - 22} ${y - 96} ${x + 22} ${y - 96} ${x + 22} ${y - 66}V${y}Z" fill="${C.lilac}" fill-opacity=".55" stroke="#fff" stroke-width="3"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${x - 25 + (i % 3) * 25}" cy="${y - 70 + Math.floor(i / 3) * 34}" r="7" fill="${[C.pink, C.gold, C.sky, C.mint, C.lilac, C.rose][i]}" ${THIN}/>`).join('')}${twinkle(x + 40, y - 112, 8, C.gold)}</g>`;
  }
  function garden(x, y) { return `<g class="place garden">${[[-60, 0, C.rose], [0, -30, C.gold], [56, -6, C.lilac], [-20, 20, C.sky]].map(([dx, dy, c]) => `<path d="M${x + dx} ${y + dy}V${y + dy - 60}" stroke="#5FBF6A" stroke-width="7"/>${[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="${x + dx + 16 * Math.cos(a * Math.PI / 180)}" cy="${y + dy - 60 + 16 * Math.sin(a * Math.PI / 180)}" rx="12" ry="9" transform="rotate(${a} ${x + dx + 16 * Math.cos(a * Math.PI / 180)} ${y + dy - 60 + 16 * Math.sin(a * Math.PI / 180)})" fill="${c}" ${THIN}/>`).join('')}<circle cx="${x + dx}" cy="${y + dy - 60}" r="9" fill="${C.gold}" ${THIN}/>`).join('')}</g>`; }
  function workshop(x, y) {   // the Tiara Workshop: a crystal cave with a giant tiara on top, its gems chiming
    const crystal = (cx, cy, h, c, r = 0) => `<path d="M${cx} ${cy}l-12 ${-h * 0.6}l12 ${-h * 0.4}l12 ${h * 0.4}Z" transform="rotate(${r} ${cx} ${cy})" fill="${c}" ${THIN}/>`;
    return `<g class="place workshop"><path d="M${x - 88} ${y}C${x - 84} ${y - 70} ${x - 50} ${y - 112} ${x} ${y - 112}C${x + 50} ${y - 112} ${x + 86} ${y - 70} ${x + 90} ${y}Z" fill="#CFE9F7" ${OUT}/>
      ${crystal(x - 60, y - 40, 50, C.sky, -14)}${crystal(x + 62, y - 36, 54, C.lilac, 12)}${crystal(x - 30, y - 80, 40, C.mint, -6)}${crystal(x + 34, y - 84, 44, C.pink, 8)}
      <path d="M${x - 24} ${y}V${y - 34}C${x - 24} ${y - 58} ${x + 24} ${y - 58} ${x + 24} ${y - 34}V${y}Z" fill="${C.lilac}" ${OUT}/>${A.heart(x, y - 30, 6, '#fff')}
      <path d="M${x - 44} ${y - 112}L${x - 36} ${y - 150}L${x - 18} ${y - 126}L${x} ${y - 166}L${x + 18} ${y - 126}L${x + 36} ${y - 150}L${x + 44} ${y - 112}Z" fill="${C.gold}" ${OUT}/>
      <circle cx="${x}" cy="${y - 132}" r="7" fill="${C.rose}" ${THIN}/><circle cx="${x - 30}" cy="${y - 128}" r="4" fill="${C.sky}"/><circle cx="${x + 30}" cy="${y - 128}" r="4" fill="${C.mint}"/>${twinkle(x + 52, y - 160, 8, '#fff')}${twinkle(x - 56, y - 140, 6, C.gold)}</g>`;
  }
  function flowerArch(x, y) {   // the Fairy Garden's flower gate
    return `<g class="place flowergate"><path d="M${x - 34} ${y + 10}V${y - 30}C${x - 34} ${y - 74} ${x + 34} ${y - 74} ${x + 34} ${y - 30}V${y + 10}" fill="none" stroke="#5FBF6A" stroke-width="9" stroke-linecap="round"/>
      ${[[-34, -10], [-30, -46], [-12, -66], [12, -66], [30, -46], [34, -10]].map(([dx, dy], i) => `<circle cx="${x + dx}" cy="${y + dy}" r="9" fill="${[C.pink, C.gold, C.lilac, C.rose, C.sky, C.pink][i]}" ${THIN}/><circle cx="${x + dx}" cy="${y + dy}" r="3" fill="#fff"/>`).join('')}</g>`;
  }
  function gemDoor(x, y) {   // the Tiara Workshop's gem door
    return `<g class="place gemdoor"><path d="M${x - 26} ${y + 10}V${y - 34}L${x} ${y - 62}L${x + 26} ${y - 34}V${y + 10}Z" fill="${C.sky}" ${OUT}/>
      <path d="M${x - 14} ${y + 10}V${y - 26}L${x} ${y - 44}L${x + 14} ${y - 26}V${y + 10}Z" fill="${C.lav}" ${THIN}/><path d="M${x - 6} ${y - 30}l6 -10l6 10l-6 8Z" fill="${C.pink}" ${THIN}/>${twinkle(x + 30, y - 60, 7, '#fff')}</g>`;
  }
  function fogCloud(x, y, s = 1, land = '') {
    return `<g class="fog" data-fog="${land}" role="button" aria-label="The Grey Fog" opacity=".96"><path d="M${x - 150 * s} ${y + 40 * s}C${x - 210 * s} ${y + 30 * s} ${x - 200 * s} ${y - 50 * s} ${x - 130 * s} ${y - 40 * s}C${x - 120 * s} ${y - 110 * s} ${x - 20 * s} ${y - 120 * s} ${x} ${y - 70 * s}C${x + 30 * s} ${y - 130 * s} ${x + 140 * s} ${y - 110 * s} ${x + 130 * s} ${y - 40 * s}C${x + 210 * s} ${y - 40 * s} ${x + 210 * s} ${y + 50 * s} ${x + 150 * s} ${y + 50 * s}C${x + 110 * s} ${y + 110 * s} ${x - 100 * s} ${y + 110 * s} ${x - 150 * s} ${y + 40 * s}Z" fill="#E9E4F2" stroke="#CFC6E0" stroke-width="4"/>
      <path d="M${x - 90 * s} ${y + 10 * s}q40 -24 80 0q40 -24 80 0" fill="none" stroke="#D6CDE6" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  function critter(id, x, y) {
    if (id === 'snail') return `<g class="critter" data-critter="snail"><path d="M${x - 22} ${y}H${x + 18}C${x + 26} ${y} ${x + 28} ${y - 14} ${x + 20} ${y - 16}" fill="#FFE3B0" ${THIN}/><circle cx="${x - 4}" cy="${y - 14}" r="14" fill="${C.coral}" ${THIN}/><path d="M${x - 4} ${y - 14}m-6 0a6 6 0 1 1 6 6" fill="none" stroke="${INK}" stroke-width="2"/><path d="M${x - 16} ${y - 26}L${x - 4} ${y - 44}L${x + 8} ${y - 26}Z" fill="${C.lilac}" ${THIN}/><circle cx="${x + 22}" cy="${y - 20}" r="2" fill="${INK}"/></g>`;
    if (id === 'bunny') return `<g class="critter" data-critter="bunny"><ellipse cx="${x - 8}" cy="${y - 36}" rx="5" ry="13" fill="#fff" ${THIN}/><ellipse cx="${x + 6}" cy="${y - 36}" rx="5" ry="13" fill="#fff" ${THIN}/><circle cx="${x}" cy="${y - 16}" r="14" fill="#fff" ${THIN}/><circle cx="${x - 5}" cy="${y - 18}" r="2" fill="${INK}"/><circle cx="${x + 5}" cy="${y - 18}" r="2" fill="${INK}"/><rect x="${x - 12}" y="${y - 4}" width="10" height="8" rx="3" fill="${C.rose}" ${THIN}/><rect x="${x + 2}" y="${y - 4}" width="10" height="8" rx="3" fill="${C.rose}" ${THIN}/></g>`;
    if (id === 'ladybug') return `<g class="critter" data-critter="ladybug"><circle cx="${x}" cy="${y - 10}" r="12" fill="${C.coral}" ${THIN}/><path d="M${x} ${y - 22}V${y + 2}" stroke="${INK}" stroke-width="2"/><circle cx="${x - 5}" cy="${y - 12}" r="2.5" fill="${INK}"/><circle cx="${x + 5}" cy="${y - 7}" r="2.5" fill="${INK}"/><circle cx="${x + 12}" cy="${y - 18}" r="6" fill="${INK}"/><path d="M${x + 12} ${y - 25}l-5 -5v8ZM${x + 12} ${y - 25}l5 -5v8Z" fill="${C.pink}"/></g>`;
    return `<g class="critter" data-critter="frog"><ellipse cx="${x}" cy="${y - 10}" rx="16" ry="12" fill="#8FDE96" ${THIN}/><circle cx="${x - 7}" cy="${y - 22}" r="6" fill="#8FDE96" ${THIN}/><circle cx="${x + 7}" cy="${y - 22}" r="6" fill="#8FDE96" ${THIN}/><circle cx="${x - 7}" cy="${y - 22}" r="2.2" fill="${INK}"/><circle cx="${x + 7}" cy="${y - 22}" r="2.2" fill="${INK}"/><path d="M${x - 8} ${y - 30}l4 -8l4 6l4 -6l4 8Z" fill="${C.gold}" ${THIN}/><path d="M${x - 5} ${y - 8}q5 4 10 0" fill="none" stroke="${INK}" stroke-width="2"/></g>`;
  }

  // The whole kingdom. st: { at, stars: [found], critters: [found], open: { bridge: true } (gates passed this session), quest: node id to glow }
  function kingdom(st = {}) {
    const unfog = st.unfog || {};
    const clouds = (a, b) => { const p = NODES[a], q = NODES[b], n = Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 34);
      return `<g class="steps">${Array.from({ length: n - 1 }, (_, i) => { const t = (i + 1) / n, x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t + Math.sin(t * Math.PI) * 18;
        return `<ellipse cx="${x}" cy="${y}" rx="22" ry="12" fill="#fff" stroke="#E3D9F5" stroke-width="3"/>`; }).join('')}</g>`; };
    const sky = uid('sky'), path = (a, b, cls = '') => { const p = NODES[a], q = NODES[b]; const mx = (p.x + q.x) / 2 + (q.y - p.y) * 0.12, my = (p.y + q.y) / 2 - (q.x - p.x) * 0.12;
      return `<path class="road ${cls}" d="M${p.x} ${p.y}Q${mx} ${my} ${q.x} ${q.y}" fill="none" stroke="#FFF6E9" stroke-width="22" stroke-linecap="round"/><path d="M${p.x} ${p.y}Q${mx} ${my} ${q.x} ${q.y}" fill="none" stroke="${C.blush}" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 16"/>`; };
    const bA = NODES.bridgeA, bB = NODES.bridgeB, fixed = !!(st.open || {}).bridge;
    const planks = Array.from({ length: 9 }, (_, i) => { const t = (i + 0.5) / 9, x = bA.x + (bB.x - bA.x) * t, y = bA.y + (bB.y - bA.y) * t - Math.sin(t * Math.PI) * 26, miss = !fixed && (i === 3 || i === 4 || i === 6);
      return miss ? '' : `<rect x="${x - 8}" y="${y - 13}" width="16" height="26" rx="3" transform="rotate(${-39} ${x} ${y})" fill="#E9B872" ${THIN}/>`; }).join('');
    const rainbow = ['#FF7AA8', '#FFB257', '#FFE066', '#7FE0A0', '#7FC8FF', '#B79BFF'].map((c, i) => `<path d="M${bA.x - 10} ${bA.y + 6 + i * 4}Q${(bA.x + bB.x) / 2} ${(bA.y + bB.y) / 2 - 60 + i * 4} ${bB.x + 10} ${bB.y + 6 + i * 4}" fill="none" stroke="${c}" stroke-width="4"/>`).join('');
    const found = new Set(st.stars || []), met = new Set(st.critters || []);
    // each land's colour comes back with its story (chapters.js colour(): 0.3 grey to 1): a saturate filter per land
    const tints = {}, colour = st.colour || {};
    for (const [land, c] of Object.entries(colour)) if (c < 1) tints[land] = uid('tint');
    const tintDefs = Object.keys(tints).length ? `<defs>${Object.entries(tints).map(([land, id]) => `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feColorMatrix type="saturate" values="${colour[land].toFixed(2)}"/></filter>`).join('')}</defs>` : '';
    const g = (land, body) => tints[land] ? `<g data-tint="${land}" filter="url(#${tints[land]})">${body}</g>` : body;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="kingdom" role="img" aria-label="The kingdom">
      <defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9EE"/><stop offset=".45" stop-color="#E6DBFF"/><stop offset="1" stop-color="#CBEBFF"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#${sky})"/>
      ${[[120, 140, 1.2], [760, 200, 1], [880, 760, 0.8], [90, 860, 0.9], [520, 1380, 1.1], [420, 120, 0.7]].map(([x, y, s]) => `<g class="drift" opacity=".9"><path d="M${x - 70 * s} ${y + 20 * s}C${x - 90 * s} ${y - 6 * s} ${x - 54 * s} ${y - 26 * s} ${x - 30 * s} ${y - 14 * s}C${x - 20 * s} ${y - 44 * s} ${x + 30 * s} ${y - 44 * s} ${x + 36 * s} ${y - 14 * s}C${x + 64 * s} ${y - 24 * s} ${x + 84 * s} ${y + 6 * s} ${x + 66 * s} ${y + 20 * s}Z" fill="#fff"/></g>`).join('')}
      ${[[60, 330], [940, 290], [930, 640], [60, 1000], [930, 1380], [480, 260], [140, 1420]].map(([x, y], i) => `<g class="tw" style="animation-delay:${i * 0.4}s">${twinkle(x, y, 10, i % 2 ? C.gold : '#fff')}</g>`).join('')}
      ${tintDefs}
      ${island(500, 720, 230, 70)}${g('read', island(282, 410, 150, 54, '#C8F2B8', '#D2BCF5', C.sky))}${g('math', island(790, 488, 150, 56, '#BFEFD4', '#B9A7E6', C.mint))}
      ${g('wand', island(752, 950, 130, 46, '#D8F7B8', '#C9B2F0', C.gold))}${g('garden', island(262, 1150, 160, 56, '#C8F2B8', '#D2BCF5', C.rose))}${g('spell', island(752, 1200, 150, 54, '#CDEFF7', '#C2B4F0', C.lilac))}
      ${path('castle', 'sign')}${path('sign', 'tower')}${path('castle', 'bridgeA')}${path('bridgeB', 'mine')}${path('castle', 'door')}${path('door', 'meadow')}
      <g class="bridge ${fixed ? 'fixed' : 'broken'}" data-gate="bridge">${rainbow}${planks}</g>
      ${g('read', bush(170, 430, 1.1) + bush(380, 460, 0.8, '#A7E8A0') + flower(330, 440, C.rose) + flower(220, 380, C.gold) + mushroom(210, 450))}
      ${bush(330, 760, 0.9)}${flower(640, 740, C.lilac)}${flower(380, 700, C.gold)}${mushroom(670, 770, C.lilac)}${bush(690, 720, 0.8, '#A7E8A0')}
      ${g('math', bush(880, 500, 0.9) + flower(700, 470, C.pink) + mushroom(860, 460, C.gold))}
      ${g('wand', flower(700, 930, C.rose) + flower(800, 960, C.gold) + flower(840, 930, C.lilac) + flower(680, 965, C.sky) + bush(860, 975, 0.8))}
      ${STARS.filter(s => !found.has(s.id)).map(s => `<g class="find star" data-star="${s.id}" role="button" aria-label="A hidden star"><circle cx="${s.x}" cy="${s.y}" r="36" fill="transparent"/>${star(s.x, s.y, 13, C.gold, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`)}</g>`).join('')}
      ${CRITTERS.filter(c => !met.has(c.id)).map(c => critter(c.id, c.x, c.y).replace(/<g class="critter"([^>]*)>/, `<g class="critter find" role="button" aria-label="${c.name}"$1><circle cx="${c.x}" cy="${c.y - 20}" r="40" fill="transparent"/>`)).join('')}
      ${g('read', towerHouse(282, 392))}${g('math', mineHill(800, 468))}${castle(500, 700)}${g('wand', meadowArch(580, 900))}
      ${g('read', `<g class="place signpost"><path d="M372 560V500" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M372 560V500" stroke="#E9B872" stroke-width="5"/><path d="M372 504H316l-12 12l12 12H372Z" fill="${C.cream}" ${THIN}/><path d="M372 518H426l12 12l-12 12H372Z" fill="${C.cream}" ${THIN}/>${star(334, 516, 5, C.lilac)}${heart(410, 530, 5, C.pink)}</g>`)}
      ${unfog.garden ? clouds('castle', 'garden') + g('garden', flowerArch(381, 941)) : ''}${unfog.workshop ? clouds('door', 'workshop') + g('spell', gemDoor(666, 1040)) : ''}
      ${g('garden', garden(262, 1140))}${g('spell', workshop(752, 1186))}
      ${unfog.garden ? '' : fogCloud(262, 1110, 1.15, 'garden')}${unfog.workshop ? '' : fogCloud(752, 1160, 1.05, 'workshop')}
      ${st.quest && NODES[st.quest] ? `<g class="glow"><circle cx="${NODES[st.quest].x}" cy="${NODES[st.quest].y}" r="54" fill="${C.gold}" opacity=".25"/><circle cx="${NODES[st.quest].x}" cy="${NODES[st.quest].y}" r="54" fill="none" stroke="${C.gold}" stroke-width="8" stroke-dasharray="4 14" stroke-linecap="round"/></g>` : ''}
    </svg>`;
  }

  // ---- backdrops behind a round ----
  function backdrop(land) {
    if (land === 'read') {   // inside Story Tower: curved shelves of books, a round starry window, books flying
      const shelf = y => `<path d="M-20 ${y}Q200 ${y + 30} 420 ${y}" fill="none" stroke="#8B5FBF" stroke-width="10"/>` + Array.from({ length: 16 }, (_, i) => { const x = i * 26 - 4, h = 44 + (i * 37 % 20), c = [C.rose, C.sky, C.gold, C.mint, C.lilac, C.coral][i % 6];
        return `<rect x="${x}" y="${y - h + Math.sin(i / 15 * Math.PI) * 26}" width="20" height="${h}" rx="3" fill="${c}" ${THIN}/>`; }).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="backdrop">
        <rect width="400" height="800" fill="#5E3D8F"/><rect width="400" height="800" fill="#7B57B5" opacity=".6"/>
        <circle cx="200" cy="150" r="88" fill="#2C1E57" stroke="#E9B872" stroke-width="10"/>${[[170, 120], [230, 150], [190, 190], [150, 160], [244, 104]].map(([x, y], i) => `<g class="tw" style="animation-delay:${i * .5}s">${twinkle(x, y, 8, i % 2 ? C.gold : '#fff')}</g>`).join('')}
        <path d="M112 150H288M200 62V238" stroke="#E9B872" stroke-width="6"/>
        ${shelf(330)}${shelf(470)}${shelf(610)}
        <rect y="720" width="400" height="80" fill="#B07BD6"/><ellipse cx="200" cy="760" rx="170" ry="26" fill="${C.pink}" opacity=".7"/>
        ${[[70, 250, C.rose], [330, 270, C.sky], [300, 420, C.mint]].map(([x, y, c], i) => `<g class="flap" style="animation-delay:${i * .3}s" transform="translate(${x} ${y})"><path d="M0 0L-22 -10L-22 12L0 22Z" fill="${c}" ${THIN}/><path d="M0 0L22 -10L22 12L0 22Z" fill="${shade(c, .3)}" ${THIN}/></g>`).join('')}
      </svg>`;
    }
    if (land === 'garden') {   // the Fairy Garden: giant flowers that open, fireflies, a mint and pink sky
      const bloom = (x, y, r, c) => `<g>${[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="${x + r * Math.cos(a * Math.PI / 180)}" cy="${y + r * Math.sin(a * Math.PI / 180)}" rx="${r * 0.75}" ry="${r * 0.5}" transform="rotate(${a} ${x + r * Math.cos(a * Math.PI / 180)} ${y + r * Math.sin(a * Math.PI / 180)})" fill="${c}" ${THIN}/>`).join('')}<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="${C.gold}" ${THIN}/></g>`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="backdrop">
        <rect width="400" height="800" fill="#2F6E64"/><rect width="400" height="420" fill="#3E8577"/>
        ${[[60, 120], [330, 80], [200, 40], [370, 300], [30, 360]].map(([x, y], i) => `<g class="tw" style="animation-delay:${i * .4}s"><circle cx="${x}" cy="${y}" r="5" fill="#FFF3A6"/><circle cx="${x}" cy="${y}" r="14" fill="#FFF3A6" opacity=".25"/></g>`).join('')}
        <path d="M40 800V420M350 800V380M200 800V560" stroke="#5FBF6A" stroke-width="12"/>
        ${bloom(40, 420, 46, C.pink)}${bloom(350, 380, 40, C.lilac)}${bloom(200, 560, 34, C.rose)}
        <path d="M0 700C80 660 160 720 240 690C300 668 360 690 400 680V800H0Z" fill="#4FA58A"/>
        ${[[90, 740, C.gold], [300, 750, C.sky], [180, 770, C.pink]].map(([x, y, c]) => bloom(x, y, 12, c)).join('')}</svg>`;
    }
    if (land === 'spell') {   // inside the Tiara Workshop: crystal walls, a tiara on a velvet cushion, gems that chime
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="backdrop">
        <rect width="400" height="800" fill="#3B4F8C"/><path d="M0 0H400V260C330 300 300 220 230 270C160 320 100 230 40 280L0 300Z" fill="#4E66A8"/>
        ${[[50, 200, C.sky], [340, 220, C.lilac], [300, 120, C.mint], [90, 90, C.pink], [200, 60, C.gold]].map(([x, y, c], i) => `<path d="M${x} ${y}l-16 -34l16 -22l16 22Z" fill="${c}" ${THIN}/><circle cx="${x}" cy="${y - 28}" r="30" fill="${c}" opacity=".18"/>`).join('')}
        <ellipse cx="200" cy="742" rx="120" ry="34" fill="${C.berry}" ${OUT}/><path d="M150 722L160 682L180 708L200 664L220 708L240 682L250 722Z" fill="${C.gold}" ${OUT}/><circle cx="200" cy="696" r="7" fill="${C.rose}" ${THIN}/>
        ${[[110, 650], [300, 660], [200, 610]].map(([x, y], i) => `<g class="tw" style="animation-delay:${i * .5}s">${twinkle(x, y, 9, '#fff')}</g>`).join('')}</svg>`;
    }
    if (land === 'wand') {   // Star Meadow by night: deep blue sky, stars, soft grass
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="backdrop">
        <rect width="400" height="800" fill="#2A2F6B"/><circle cx="320" cy="110" r="44" fill="#FFF3D1"/><circle cx="338" cy="96" r="40" fill="#2A2F6B"/>
        ${Array.from({ length: 16 }, (_, i) => [(i * 97) % 380 + 10, (i * 53) % 420 + 30]).map(([x, y], i) => `<g class="tw" style="animation-delay:${(i % 6) * .4}s">${twinkle(x, y, i % 3 ? 5 : 8, i % 2 ? C.gold : '#fff')}</g>`).join('')}
        <path d="M0 640C90 600 170 660 250 630C320 604 370 626 400 616V800H0Z" fill="#3D6E5E"/><path d="M0 700C100 680 200 720 400 690V800H0Z" fill="#4C8A70"/></svg>`;
    }
    // the Gem Mine: a deep cave, glowing crystals, candy-striped rails, lanterns
    const cluster = (x, y, s, c) => `<g>${[[-14, 6, -20], [0, 0, 0], [14, 8, 18]].map(([dx, dy, r]) => `<path d="M${x + dx * s} ${y + dy * s}l${-9 * s} ${-26 * s}l${9 * s} ${-14 * s}l${9 * s} ${14 * s}Z" transform="rotate(${r} ${x + dx * s} ${y + dy * s})" fill="${c}" ${THIN}/>`).join('')}<ellipse cx="${x}" cy="${y - 10 * s}" rx="${40 * s}" ry="${30 * s}" fill="${c}" opacity=".18"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="backdrop">
      <rect width="400" height="800" fill="#2D2350"/><path d="M0 0H400V210C330 250 300 180 240 220C180 260 120 190 60 230C30 250 0 230 0 230Z" fill="#3D2F6B"/>
      <path d="M0 800V620C80 580 140 640 200 600C260 560 330 620 400 590V800Z" fill="#45367A"/>
      ${cluster(60, 210, 1.2, C.pink)}${cluster(340, 250, 1, C.sky)}${cluster(320, 640, 1.3, C.mint)}${cluster(70, 620, 1.1, C.gold)}${cluster(200, 120, .8, C.lilac)}
      ${[[90, 330], [310, 380]].map(([x, y]) => `<path d="M${x} 0V${y - 30}" stroke="#8B6A3E" stroke-width="3"/><rect x="${x - 12}" y="${y - 30}" width="24" height="32" rx="6" fill="${C.gold}" ${THIN}/><circle cx="${x}" cy="${y - 14}" r="30" fill="${C.gold}" opacity=".2"/>`).join('')}
      <path d="M-10 730H410" stroke="${INK}" stroke-width="12"/><path d="M-10 730H410" stroke="#fff" stroke-width="6" stroke-dasharray="14 14"/><path d="M-10 730H410" stroke="${C.rose}" stroke-width="6" stroke-dasharray="14 14" stroke-dashoffset="14"/>
    </svg>`;
  }

  root.SparkleWorld = { W, H, NODES, EDGES, LANDS_FOGGED, STARS, CRITTERS, route, gateOn, nearest, kingdom, backdrop, critter };
})(typeof window !== 'undefined' ? window : globalThis);
