'use strict';

// Sparkle Kingdom's art, drawn in code as SVG: the princess and her unicorn (in layers, so every
// gown, tiara and mane swaps on the same character), the friends who host each land, the things in
// the Royal Boutique, and the little pieces (coins, gems, stars, gifts, clouds). The kingdom and the
// lands' backdrops are in world.js. The look: soft rounded shapes, a thick friendly outline, flat
// colour with a gentle highlight, big faces and eyes, in pastel pink, lilac, mint, gold and sky blue.
//
// Each function returns SVG markup (a string). A whole picture is an <svg>; a part is a <g> to put
// in one. Gradients get their own ids (uid) so many pictures can share a page.
(function (root) {
  let n = 0;
  const uid = p => `${p}${++n}`;
  const INK = '#4B2E6F';                       // the outline: a deep plum, softer than black
  const OUT = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const THIN = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;

  // ---- colours ----
  const C = {
    pink: '#FF8FC7', blush: '#FFB3DA', rose: '#FF5FA8', lilac: '#B79BFF', lav: '#D9CCFF', mint: '#7FE0C7', sky: '#8FD3FF',
    gold: '#FFC94A', amber: '#F5A623', cream: '#FFF6E9', white: '#FFFFFF', peach: '#FFC7A8', coral: '#FF8A7A', berry: '#C04B9A', teal: '#4FC3B8',
  };
  const SKIN = { s1: '#FFE3D1', s2: '#F6CDA9', s3: '#E3A878', s4: '#B97B52', s5: '#8A5634' };
  const HAIR = { gold: '#FFD25E', honey: '#E9A93F', brown: '#9A5B34', dark: '#4A2C22', black: '#2A1E26', red: '#E86A3A', pink: '#FF9BD0', lilac: '#B79BFF' };
  const STYLES = ['long', 'curly', 'bun', 'braids', 'puffs'];

  // ---- small pieces ----
  const star = (x, y, r, fill = C.gold, extra = '') => {
    const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r; p.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`); }
    return `<polygon points="${p.join(' ')}" fill="${fill}" ${extra}/>`;
  };
  const twinkle = (x, y, r, fill = '#fff') => `<path d="M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${fill}"/>`;
  const heart = (x, y, s, fill = C.rose) => `<path d="M${x} ${y + s * 0.9}C${x - s * 1.4} ${y - s * 0.1} ${x - s * 0.7} ${y - s * 1.1} ${x} ${y - s * 0.35}C${x + s * 0.7} ${y - s * 1.1} ${x + s * 1.4} ${y - s * 0.1} ${x} ${y + s * 0.9}Z" fill="${fill}"/>`;
  const svg = (vb, body, label = '', cls = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${cls ? `class="${cls}"` : ''} ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${body}</svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); let r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    const f = x => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k)));
    return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };

  function coin(size = 40, label = '') {
    const g = uid('cg');
    return svg('0 0 40 40', `<defs><radialGradient id="${g}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".55" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.amber}"/></radialGradient></defs>
      <circle cx="20" cy="20" r="17" fill="url(#${g})" ${THIN}/><circle cx="20" cy="20" r="11.5" fill="none" stroke="#E8952A" stroke-width="2" opacity=".7"/>${star(20, 20.5, 7, '#FFF4C7')}`, label, 'coin').replace('<svg ', `<svg width="${size}" height="${size}" `);
  }
  function gem(color = C.pink, size = 40) {
    const lt = shade(color, 0.45), dk = shade(color, -0.25);
    return svg('0 0 40 40', `<path d="M8 15L14 7H26L32 15L20 34Z" fill="${color}" ${THIN}/><path d="M8 15H32M14 7L17 15L20 34L23 15L26 7" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".5"/>
      <path d="M14 7L17 15H8Z" fill="${lt}"/><path d="M23 15L32 15L20 34Z" fill="${dk}" opacity=".6"/>${twinkle(13, 12, 3)}`).replace('<svg ', `<svg width="${size}" height="${size}" `);
  }
  function gift(size = 120) {
    return svg('0 0 120 120', `<ellipse cx="60" cy="108" rx="40" ry="6" fill="${INK}" opacity=".15"/>
      <rect x="20" y="52" width="80" height="54" rx="8" fill="${C.lilac}" ${OUT}/><rect x="14" y="38" width="92" height="20" rx="7" fill="${C.lav}" ${OUT}/>
      <rect x="53" y="38" width="14" height="68" fill="${C.pink}" ${THIN}/>
      <path d="M60 38C44 18 26 24 34 34C38 39 50 38 60 38C70 38 82 39 86 34C94 24 76 18 60 38Z" fill="${C.pink}" ${OUT}/>
      ${star(32, 76, 6, '#fff', 'opacity=".8"')}${star(88, 88, 5, '#fff', 'opacity=".8"')}${twinkle(98, 22, 7, C.gold)}${twinkle(20, 26, 5, C.gold)}`);
  }
  function cloud(w = 160, fill = '#fff', op = 1) {
    return svg('0 0 160 80', `<path d="M24 66C8 66 4 46 20 42C18 24 42 16 54 28C60 10 92 8 100 26C112 16 136 22 134 40C152 40 156 66 136 66Z" fill="${fill}" opacity="${op}"/>`).replace('<svg ', `<svg width="${w}" `);
  }

  // ---- the princess ----
  // look: { skin, hair, style }; wear: { gown, tiara, shoes, wand, cape, necklace } (item ids, ITEMS below)
  // mood: 'happy' | 'wow' | 'calm'. head: true draws just the head and shoulders (a portrait).
  function princess(look = {}, wear = {}, opt = {}) {
    const skin = SKIN[look.skin] || SKIN.s2, hair = HAIR[look.hair] || HAIR.brown, style = STYLES.includes(look.style) ? look.style : 'long';
    const hairD = shade(hair, -0.18), hairL = shade(hair, 0.35), skinD = shade(skin, -0.12);
    const gown = ITEMS[wear.gown] || ITEMS['gown-petal'], tiara = ITEMS[wear.tiara] || ITEMS['tiara-little'];
    const mood = opt.mood || 'happy';
    const parts = [];
    // cape, behind everything
    if (wear.cape && ITEMS[wear.cape]) parts.push(ITEMS[wear.cape].draw('back'));
    // hair behind the head
    const back = {
      long: `<path d="M58 74C40 120 44 176 56 196C70 206 130 206 144 196C156 176 160 120 142 74Z" fill="${hair}" ${OUT}/><path d="M66 150C64 170 70 186 76 194M134 150C136 170 130 186 124 194" fill="none" stroke="${hairD}" stroke-width="3" stroke-linecap="round"/>`,
      curly: `<path d="M50 80C30 104 36 132 44 148C34 168 52 188 70 186C82 200 118 200 130 186C148 188 166 168 156 148C164 132 170 104 150 80Z" fill="${hair}" ${OUT}/>`,
      bun: `<circle cx="100" cy="32" r="22" fill="${hair}" ${OUT}/><path d="M86 22C94 16 108 16 114 24" fill="none" stroke="${hairL}" stroke-width="3" stroke-linecap="round"/>`,
      braids: `<path d="M56 96C50 130 48 166 54 196" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M56 96C50 130 48 166 54 196" fill="none" stroke="${hair}" stroke-width="15" stroke-linecap="round"/>
        <path d="M144 96C150 130 152 166 146 196" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M144 96C150 130 152 166 146 196" fill="none" stroke="${hair}" stroke-width="15" stroke-linecap="round"/>
        ${[120, 142, 164, 186].map(y => `<path d="M${46 + (y - 120) * -0.05} ${y}l12 4M${154 + (y - 120) * 0.05} ${y}l-12 4" stroke="${hairD}" stroke-width="3" stroke-linecap="round"/>`).join('')}
        <circle cx="54" cy="200" r="7" fill="${C.pink}" ${THIN}/><circle cx="146" cy="200" r="7" fill="${C.pink}" ${THIN}/>`,
      puffs: `<circle cx="50" cy="52" r="26" fill="${hair}" ${OUT}/><circle cx="150" cy="52" r="26" fill="${hair}" ${OUT}/>`,
    }[style];
    parts.push(back);
    if (!opt.head) {
      // legs and shoes, under the skirt
      parts.push(`<path d="M88 270V292M112 270V292" stroke="${skinD}" stroke-width="10" stroke-linecap="round"/>`);
      parts.push((ITEMS[wear.shoes] || ITEMS['shoes-slipper']).draw());
      // the gown (skirt and bodice), arms
      parts.push(gown.draw());
      parts.push(`<path d="M70 158C58 176 56 196 64 204" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M70 158C58 176 56 196 64 204" fill="none" stroke="${skin}" stroke-width="9" stroke-linecap="round"/>
        <path d="M130 158C144 170 152 182 150 196" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M130 158C144 170 152 182 150 196" fill="none" stroke="${skin}" stroke-width="9" stroke-linecap="round"/>
        <circle cx="64" cy="206" r="8" fill="${skin}" ${THIN}/><circle cx="150" cy="198" r="8" fill="${skin}" ${THIN}/>`);
      parts.push(gown.top ? gown.top() : '');
      if (wear.wand && ITEMS[wear.wand]) parts.push(ITEMS[wear.wand].draw());
    } else {
      parts.push(`<path d="M52 196C56 168 78 156 100 156C122 156 144 168 148 196Z" fill="${gown.c || C.pink}" ${OUT}/>`);
    }
    // neck and head
    parts.push(`<rect x="91" y="134" width="18" height="22" rx="6" fill="${skinD}"/>`);
    if (wear.necklace && ITEMS[wear.necklace]) parts.push(ITEMS[wear.necklace].draw());
    parts.push(`<ellipse cx="100" cy="92" rx="46" ry="48" fill="${skin}" ${OUT}/>`);
    parts.push(`<ellipse cx="56" cy="98" rx="7" ry="10" fill="${skin}" ${THIN}/><ellipse cx="144" cy="98" rx="7" ry="10" fill="${skin}" ${THIN}/>`);
    // face: big eyes with shines, blush, a smile
    const eye = x => mood === 'happy'
      ? `<path d="M${x - 9} 100Q${x} 88 ${x + 9} 100" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
      : `<ellipse cx="${x}" cy="98" rx="8.5" ry="11" fill="${INK}"/><ellipse cx="${x + 2.5}" cy="93" rx="3.6" ry="4.2" fill="#fff"/><circle cx="${x - 3}" cy="103" r="1.8" fill="#fff"/>`;
    parts.push(eye(82) + eye(118));
    parts.push(`<ellipse cx="70" cy="114" rx="9" ry="6" fill="${C.pink}" opacity=".55"/><ellipse cx="130" cy="114" rx="9" ry="6" fill="${C.pink}" opacity=".55"/>`);
    parts.push(mood === 'wow' ? `<ellipse cx="100" cy="122" rx="6" ry="7.5" fill="${C.coral}" ${THIN}/>` : `<path d="M90 118Q100 128 110 118" fill="${C.coral}" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
    // hair in front: a fringe for every style
    const fringe = {
      long: `<path d="M54 92C50 54 78 38 100 40C126 40 152 56 146 92C136 74 124 66 112 62C106 72 92 78 78 76C70 80 60 86 54 92Z" fill="${hair}" ${OUT}/>`,
      curly: `<path d="M52 94C44 60 70 38 100 38C132 38 156 60 148 94C142 84 136 76 128 72C126 80 116 84 108 78C102 86 90 86 84 78C76 84 64 82 62 74C56 80 54 86 52 94Z" fill="${hair}" ${OUT}/>`,
      bun: `<path d="M56 88C52 56 76 42 100 42C126 42 150 56 144 88C132 70 118 62 100 60C82 62 68 70 56 88Z" fill="${hair}" ${OUT}/>`,
      braids: `<path d="M54 96C48 58 76 40 100 40C124 40 152 58 146 96C140 80 128 68 108 62C104 70 98 74 100 62C82 66 64 78 54 96Z" fill="${hair}" ${OUT}/>`,
      puffs: `<path d="M56 88C52 56 76 42 100 42C126 42 150 56 144 88C136 74 120 64 100 64C80 64 64 74 56 88Z" fill="${hair}" ${OUT}/>`,
    }[style];
    parts.push(fringe);
    parts.push(`<path d="M76 54C84 48 96 46 104 48" fill="none" stroke="${hairL}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`);
    parts.push(tiara.draw());
    const vb = opt.head ? '30 0 140 200' : '20 0 160 300';
    return svg(vb, `<g class="princess">${parts.join('')}</g>`, opt.label || '', opt.cls || '');
  }

  // ---- the unicorn ----
  // stage 0 foal, 1 young, 2 unicorn, 3 winged, 4 rainbow. wear: { mane, saddle, horn }.
  // opt (all optional, for the stable):
  //   mood   'happy' | 'calm' (the default: big open eye) | 'sleepy' | 'sad' (droopy half-closed eye
  //          looking down, a small frown, an ear flopped back over her mane) | 'sleep' (eye closed
  //          in a content curve, lashes) | 'eat' (happy eye, mouth open chewing)
  //   dirt   0..1 mud: a wavy band up each leg that rises with it, and splotches on her tummy that
  //          grow in number and size (0: none)
  //   foam   0..1 soap foam on her body and mane, more as it rises (0: none)
  //   shine  true: twinkles all around her (clean and happy)
  // In her viewBox (0 -6 250 210, at stage 2 and up): the mouth is at about (219, 116), the muzzle
  // (230, 106), the eye (198, 76), the mane down the neck from (172, 40) to (150, 96), the middle of
  // her back (112, 92), the hooves' bottoms at y 195. A foal or young one is drawn smaller about the
  // point (125, 200): x' = 125 + (x - 125) * s, y' = 200 + (y - 200) * s, s 0.82 (stage 0) or 0.9 (1).
  function unicorn(stage = 0, wear = {}, opt = {}) {
    const mane = ITEMS[wear.mane] || ITEMS['mane-candy'], cols = stage >= 4 ? ['#FF7AA8', '#FFB257', '#FFE066', '#7FE0A0', '#7FC8FF', '#B79BFF'] : mane.cols;
    const body = '#FFFFFF', bodyS = '#EFE6FF', hoof = stage >= 4 ? C.gold : '#C9B6F2';
    const s = [0.82, 0.9, 1, 1, 1][stage] || 1, mood = opt.mood || 'calm';
    const dirt = Math.max(0, Math.min(1, +opt.dirt || 0)), foam = Math.max(0, Math.min(1, +opt.foam || 0));
    const g = uid('ug'), parts = [];
    parts.push(`<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${bodyS}"/></linearGradient></defs>`);
    if (stage >= 4) parts.push(`<ellipse cx="128" cy="110" rx="118" ry="96" fill="${C.lav}" opacity=".35"/>`);
    // tail (in its own group, like the legs and the head, so the stables can swish it: class tl, lf/lb, hd)
    parts.push('<g class="tl">');
    parts.push(`<path d="M52 108C24 100 14 126 22 148C30 168 22 182 34 186C40 170 50 160 46 140C58 152 66 140 60 120Z" fill="${cols[0]}" ${OUT}/>`);
    parts.push(`<path d="M40 122C32 134 34 150 38 162" fill="none" stroke="${cols[1] || cols[0]}" stroke-width="6" stroke-linecap="round"/><path d="M50 128C46 140 48 150 50 156" fill="none" stroke="${cols[2] || cols[0]}" stroke-width="5" stroke-linecap="round"/></g>`);
    // wings (stage 3 and up), behind the body
    if (stage >= 3) parts.push(`<path d="M104 96C92 54 120 30 150 40C138 50 160 52 148 64C162 68 152 82 138 82C142 92 124 100 104 96Z" fill="#fff" ${OUT}/><path d="M118 70C126 60 136 56 146 56M120 84C128 78 138 76 144 76" fill="none" stroke="${C.lav}" stroke-width="3" stroke-linecap="round"/>`);
    // legs (back pair a little darker)
    const leg = (x, back) => `<g class="${back ? 'lb' : 'lf'} l${x}"><path d="M${x} 146V187" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><path d="M${x} 146V187" stroke="${back ? bodyS : body}" stroke-width="11" stroke-linecap="round"/><path d="M${x - 9} 196V188Q${x} 181 ${x + 9} 188V196Z" fill="${hoof}" ${THIN}/>${legMud([x], x)}</g>`;
    // mud (opt.dirt): a wavy band of mud up each leg that rises with it, and soft splotches on her
    // tummy; all kept inside the legs and body they sit on
    const MUD = '#A87A5A', MUDL = '#C79D7B', mc = (x, y, r, fill) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}"/>`;
    const clipped = (shape, body) => { const cl = uid('um'); return `<defs><clipPath id="${cl}">${shape}</clipPath></defs><g clip-path="url(#${cl})">${body}</g>`; };
    const legMud = (xs, k0 = 0) => {
      if (!dirt) return '';
      const top = 188 - 26 * dirt;
      const band = (x, i) => { i += k0; const t = top + (i % 2 ? 3 : 0);
        return `M${x - 12} ${t + 2}Q${x - 6} ${t - 3} ${x - 1} ${t + 1.5}Q${x + 5} ${t + 5} ${x + 12} ${t}V200H${x - 12}Z`; };
      const d = xs.map(band).join(''), drips = dirt > 0.4 ? xs.map((x, i) => { i += k0; const dx = x + (i % 2 ? 4 : -3), dy = top - 4 - 8 * dirt * (i % 2 ? 0.6 : 1), r = 1.8 + 1.4 * dirt; return mc(dx, dy, r + 1.3, INK) + mc(dx, dy, r, MUD); }).join('') : '';
      return clipped(xs.map(x => `<rect x="${x - 10}" y="140" width="20" height="57" rx="9"/>`).join(''),
        `<path d="${d}" fill="${MUD}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>${drips}` + xs.map((x, i) => mc(x - 3, top + 7 + ((i + k0) % 2 ? 3 : 0), 1.8, MUDL)).join(''));
    };
    const bodyMud = () => {
      if (!dirt) return '';
      const k = 0.75 + 0.4 * dirt, spots = [[120, 160, 8], [78, 154, 7], [154, 152, 6.5], [100, 146, 5], [62, 138, 5.5]].slice(0, Math.ceil(dirt * 5));
      const dots = spots.flatMap(([x, y, r]) => { r *= k; return [[x, y, r], [x + r * 0.75, y - r * 0.3, r * 0.6], [x - r * 0.65, y + r * 0.35, r * 0.55]]; });
      return clipped('<path d="M50 118C50 98 72 90 104 92C134 94 160 92 176 112C186 126 178 152 160 158C136 164 96 164 70 158C54 154 48 136 50 118Z"/>', dots.map(([x, y, r]) => mc(x, y, r + 1.4, INK)).join('') + dots.map(([x, y, r]) => mc(x, y, r, MUD)).join('')
        + spots.map(([x, y, r]) => mc(x - r * k * 0.3, y - r * k * 0.3, r * k * 0.28, MUDL)).join(''));
    };
    parts.push(leg(76, true) + leg(150, true));
    // body
    parts.push(`<path d="M50 118C50 98 72 90 104 92C134 94 160 92 176 112C186 126 178 152 160 158C136 164 96 164 70 158C54 154 48 136 50 118Z" fill="url(#${g})" ${OUT}/>`);
    parts.push(bodyMud());
    parts.push(leg(92, false) + leg(166, false));
    // saddle
    if (wear.saddle && ITEMS[wear.saddle]) parts.push(ITEMS[wear.saddle].draw());
    // neck and head
    parts.push('<g class="hd">');
    parts.push(`<path d="M144 112C146 84 156 62 174 52L200 90C188 100 180 120 176 136Z" fill="${body}" ${OUT}/>`);
    parts.push(`<path d="M166 52C176 38 200 36 212 52C220 64 230 80 238 94C244 106 238 118 224 119C214 120 205 116 197 110C186 104 174 96 169 84C164 72 160 62 166 52Z" fill="${body}" ${OUT}/>`);
    parts.push(`<path d="M226 92C236 96 242 106 238 113C235 118 228 120 220 118C214 117 210 114 207 110C216 106 222 100 226 92Z" fill="${C.blush}" opacity=".55"/><path d="M226 101Q232 102 232 108" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`);
    if (!['sad', 'eat'].includes(mood)) parts.push(`<path d="M213 114Q219 117 225 116" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`);
    // ear
    const ear = `<path d="M176 56L170 30L190 48Z" fill="${body}" ${OUT}/><path d="M176 50L174 38L184 47Z" fill="${C.pink}"/>`;
    if (mood !== 'sad') parts.push(ear);
    // horn (none on the foal's first days: a tiny bump), spiral lines
    const hornC = (ITEMS[wear.horn] || {}).c || C.gold;
    if (stage === 0) parts.push(`<path d="M186 44L194 26L200 44Z" fill="${hornC}" ${THIN}/>`);
    else parts.push(`<path d="M184 44L204 ${stage >= 2 ? 2 : 14}L208 50Z" fill="${hornC}" ${OUT}/><path d="M189 38L204 34M192 28L205 24M196 18L205 15" stroke="${shade(hornC, -0.25)}" stroke-width="2.5" stroke-linecap="round"/>`);
    if (wear.horn && ITEMS[wear.horn] && ITEMS[wear.horn].glow) parts.push(twinkle(212, 12, 8, '#fff') + twinkle(176, 18, 5, C.gold));
    // eye
    parts.push(mood === 'happy' || mood === 'eat' ? `<path d="M190 78Q198 68 206 78" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
      : mood === 'sleepy' ? `<path d="M190 76Q198 84 206 76" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`
      : mood === 'sleep' ? `<path d="M189 75Q198 85 207 75" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M191 80l-3 4M197 82.5l-1 4.5M203 81l2 4" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
      : mood === 'sad' ? `<ellipse cx="198" cy="79" rx="8" ry="9.5" fill="${INK}"/><circle cx="200" cy="81" r="3" fill="#fff"/><circle cx="195" cy="85.5" r="1.5" fill="#fff"/>
        <path d="M186 78.5L211 72V58H186Z" fill="${body}"/><path d="M189 78Q199 76.5 207.5 72" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M193 66Q199 65 203 60" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
      : `<ellipse cx="198" cy="76" rx="8" ry="10" fill="${INK}"/><ellipse cx="200.5" cy="72" rx="3.3" ry="3.8" fill="#fff"/><circle cx="195.5" cy="80" r="1.6" fill="#fff"/><path d="M190 66l-5 -4M196 63l-2 -6" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`);
    parts.push(`<ellipse cx="206" cy="92" rx="8" ry="5" fill="${C.pink}" opacity="${mood === 'sad' ? '.35' : '.6'}"/>`);
    // the mouth, for the stable's moods (the others have none, as always)
    if (mood === 'sad') parts.push(`<path d="M213 117Q219 113 225 116" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`);
    if (mood === 'eat') parts.push(`<path d="M211 112Q219 110 227 113Q225 121 218 121.5Q212 120 211 112Z" fill="${INK}"/><path d="M213.5 118Q218 115.5 223.5 117.5Q220.5 121 216.5 120.5Z" fill="${C.coral}"/>`);
    // mane: puffs of colour down the neck
    const puffs = [[170, 44, 15], [160, 60, 15], [154, 78, 14], [150, 96, 13], [176, 34, 11]];
    parts.push(puffs.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${cols[i % cols.length]}" ${OUT}/>`).join(''));
    parts.push(`<path d="M182 40C190 36 194 44 188 52C184 58 176 54 178 48" fill="${cols[1 % cols.length]}" ${OUT}/>`);
    // a sad ear lies back flat over her mane
    if (mood === 'sad') parts.push(`<path d="M190 51C180 46 168 50 161 62C171 64 181 61 190 57Z" fill="${body}" ${OUT}/><path d="M185 53.5C178 52 172 55 168 59.5C175 60.5 180 59 185 56.5Z" fill="${C.pink}"/>`);
    parts.push('</g>');
    if (stage >= 4 || (ITEMS[wear.mane] && ITEMS[wear.mane].sparkle)) parts.push(twinkle(150, 50, 6) + twinkle(140, 100, 5) + twinkle(60, 170, 6));
    // soap foam (opt.foam): little clouds of bubbles on her back and mane
    if (foam) {
      const k = 0.75 + 0.4 * foam, at = [[112, 94], [162, 56], [76, 104], [146, 98], [178, 36], [132, 118], [92, 126], [158, 82], [58, 122], [120, 104]];
      const on = at.slice(0, Math.ceil(foam * at.length));
      const puff = ([x, y], i) => [[x, y, 7.5], [x - 7, y + 3, 5.5], [x + 7, y + 2, 6], [x + (i % 2 ? 2 : -2), y - 6, 5]].map(([a, b, r]) => [a, b, r * k]);
      parts.push(on.map((p, i) => { const c = puff(p, i);
        return c.map(([x, y, r]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 1.6).toFixed(1)}" fill="${C.lav}"/>`).join('') + c.map(([x, y, r]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff"/>`).join('')
          + `<circle cx="${(p[0] + 9 * k).toFixed(1)}" cy="${(p[1] - 9 * k).toFixed(1)}" r="${(2.6 * k).toFixed(1)}" fill="#fff" stroke="${C.lilac}" stroke-width="1.2"/><circle cx="${(p[0] - 3).toFixed(1)}" cy="${(p[1] - 2).toFixed(1)}" r="${(1.8 * k).toFixed(1)}" fill="none" stroke="${C.lav}" stroke-width="1"/>`; }).join(''));
    }
    // shine: twinkles all round her
    if (opt.shine) parts.push(twinkle(30, 34, 9, C.gold) + twinkle(122, 58, 7, C.pink) + twinkle(240, 130, 7, C.gold) + twinkle(14, 98, 6, C.sky) + twinkle(196, 150, 6, C.pink) + twinkle(236, 22, 6, C.gold) + twinkle(64, 76, 4.5, C.sky));
    const vb = '0 -6 250 210';
    return svg(vb, `<g class="unicorn" transform="translate(${(1 - s) * 125} ${(1 - s) * 200}) scale(${s})">${parts.join('')}</g>`, opt.label || '', opt.cls || '');
  }

  // ---- the friends ----
  function owl(opt = {}) {   // Professor Hoot, the owl librarian of Story Tower
    const b = '#A27BD8', l = '#D9C8FF';
    return svg('0 0 200 200', `<ellipse cx="100" cy="190" rx="50" ry="7" fill="${INK}" opacity=".15"/>
      <path d="M44 40L60 66H140L156 40L128 56H72Z" fill="${b}" ${OUT}/>
      <ellipse cx="100" cy="116" rx="64" ry="72" fill="${b}" ${OUT}/><ellipse cx="100" cy="138" rx="42" ry="46" fill="${l}"/>
      ${[120, 136, 152].map(y => `<path d="M80 ${y}q6 6 12 0M108 ${y}q6 6 12 0" fill="none" stroke="${b}" stroke-width="3" stroke-linecap="round"/>`).join('')}
      <circle cx="74" cy="92" r="24" fill="#fff" ${OUT}/><circle cx="126" cy="92" r="24" fill="#fff" ${OUT}/>
      <circle cx="76" cy="94" r="11" fill="${INK}"/><circle cx="124" cy="94" r="11" fill="${INK}"/><circle cx="80" cy="89" r="4" fill="#fff"/><circle cx="128" cy="89" r="4" fill="#fff"/>
      <circle cx="74" cy="92" r="29" fill="none" stroke="${C.gold}" stroke-width="5"/><circle cx="126" cy="92" r="29" fill="none" stroke="${C.gold}" stroke-width="5"/><path d="M100 90h0" stroke="${C.gold}" stroke-width="5"/>
      <path d="M92 110L100 124L108 110Z" fill="${C.amber}" ${THIN}/>
      <path d="M38 120C24 138 30 166 46 172C46 150 50 132 38 120ZM162 120C176 138 170 166 154 172C154 150 150 132 162 120Z" fill="${shade(b, -0.12)}" ${OUT}/>
      <path d="M78 182l-6 10M86 184l0 10M114 184l0 10M122 182l6 10" stroke="${C.amber}" stroke-width="5" stroke-linecap="round"/>
      <rect x="64" y="22" width="72" height="12" rx="3" fill="${INK}"/><path d="M76 22L100 6L124 22Z" fill="${INK}"/><path d="M128 28q10 6 8 22" fill="none" stroke="${C.gold}" stroke-width="3"/>${star(136, 54, 6)}`, opt.label || 'Professor Hoot', opt.cls || '');
  }
  function dragon(opt = {}) {   // Pebble, the baby dragon of the Gem Mine
    const b = '#7FE0C7', d = '#45B79C';
    return svg('0 0 220 200', `<ellipse cx="110" cy="190" rx="60" ry="7" fill="${INK}" opacity=".15"/>
      <path d="M150 150C186 150 200 126 206 104C192 112 182 108 186 96C174 112 168 130 140 132Z" fill="${b}" ${OUT}/><path d="M200 106l12 -8l-2 14Z" fill="${C.pink}" ${THIN}/>
      <path d="M70 92C40 70 36 44 52 30C56 52 74 62 86 72ZM150 92C180 70 184 44 168 30C164 52 146 62 134 72Z" fill="${C.lilac}" ${OUT}/>
      <ellipse cx="110" cy="138" rx="52" ry="48" fill="${b}" ${OUT}/><ellipse cx="110" cy="148" rx="32" ry="32" fill="#E8FFF7"/>
      ${[130, 146, 162].map(y => `<path d="M88 ${y}h44" stroke="${b}" stroke-width="3" stroke-linecap="round"/>`).join('')}
      <path d="M82 182v6M98 184v6M122 184v6M138 182v6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="110" cy="80" rx="52" ry="44" fill="${b}" ${OUT}/>
      <path d="M84 42L80 22L96 36ZM136 42L140 22L124 36Z" fill="${C.gold}" ${OUT}/>
      ${[[104, 36], [116, 36]].map(([x, y]) => `<path d="M${x - 5} ${y + 4}L${x} ${y - 6}L${x + 5} ${y + 4}Z" fill="${C.pink}" ${THIN}/>`).join('')}
      <ellipse cx="90" cy="78" rx="10" ry="12" fill="${INK}"/><ellipse cx="130" cy="78" rx="10" ry="12" fill="${INK}"/><circle cx="93" cy="73" r="4" fill="#fff"/><circle cx="133" cy="73" r="4" fill="#fff"/>
      <ellipse cx="110" cy="102" rx="20" ry="12" fill="#B8F2E2" ${THIN}/><circle cx="103" cy="100" r="2.4" fill="${INK}"/><circle cx="117" cy="100" r="2.4" fill="${INK}"/>
      <ellipse cx="76" cy="96" rx="8" ry="5" fill="${C.pink}" opacity=".6"/><ellipse cx="144" cy="96" rx="8" ry="5" fill="${C.pink}" opacity=".6"/>
      <path d="M64 136C50 144 52 160 62 162M156 136C170 144 168 160 158 162" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M64 136C50 144 52 160 62 162M156 136C170 144 168 160 158 162" fill="none" stroke="${b}" stroke-width="9" stroke-linecap="round"/>
      <g transform="translate(150 150) rotate(-12)">${gem(C.pink, 30).replace(/<svg[^>]*>/, '<svg x="-15" y="-30" width="30" height="30" viewBox="0 0 40 40">')}</g>`, opt.label || 'Pebble the dragon', opt.cls || '');
  }
  function fairy(kind = 'gemma', opt = {}) {   // Gemma (Tiara Workshop) and Bloom (Fairy Garden)
    const dress = kind === 'bloom' ? C.mint : C.lilac, hair = kind === 'bloom' ? '#FF9BD0' : '#FFD25E', skin = kind === 'bloom' ? SKIN.s4 : SKIN.s1;
    return svg('0 0 200 220', `<path d="M100 92C60 40 20 60 40 96C20 120 64 134 100 112ZM100 92C140 40 180 60 160 96C180 120 136 134 100 112Z" fill="#E6F7FF" opacity=".9" ${THIN}/>
      <path d="M100 110L66 196H134Z" fill="${dress}" ${OUT}/><path d="M72 182q14 10 28 0q14 10 28 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="100" cy="72" r="34" fill="${hair}" ${OUT}/><circle cx="100" cy="80" r="28" fill="${skin}" ${OUT}/>
      <path d="M72 76C74 54 92 46 104 48C118 50 130 60 128 76C120 66 108 62 96 62C86 64 78 70 72 76Z" fill="${hair}" ${OUT}/>
      <ellipse cx="90" cy="84" rx="5" ry="6.5" fill="${INK}"/><ellipse cx="110" cy="84" rx="5" ry="6.5" fill="${INK}"/><circle cx="91.5" cy="81.5" r="2" fill="#fff"/><circle cx="111.5" cy="81.5" r="2" fill="#fff"/>
      <path d="M93 96Q100 102 107 96" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><ellipse cx="82" cy="94" rx="5" ry="3.5" fill="${C.pink}" opacity=".6"/><ellipse cx="118" cy="94" rx="5" ry="3.5" fill="${C.pink}" opacity=".6"/>
      ${kind === 'bloom' ? `<circle cx="78" cy="50" r="8" fill="${C.gold}" ${THIN}/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${78 + 11 * Math.cos(a * Math.PI / 180)}" cy="${50 + 11 * Math.sin(a * Math.PI / 180)}" r="6" fill="${C.rose}" ${THIN}/>`).join('')}` : star(100, 38, 11)}
      <path d="M134 128L156 106" stroke="${C.gold}" stroke-width="5" stroke-linecap="round"/>${star(160, 102, 10)}${twinkle(176, 86, 6, C.gold)}`, opt.label || (kind === 'bloom' ? 'Bloom the fairy' : 'Gemma the fairy'), opt.cls || '');
  }

  // ---- the Royal Boutique: what she can buy, and the story gifts ----
  // kind: what it is; c: its colour; price in coins (0 = a story gift, never sold); draw(): its layer
  const gownDraw = (c, trim, pattern) => () => {
    const d = shade(c, -0.18), id = uid('gw');
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 0.25)}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
      <path d="M78 160C66 200 44 238 32 266C60 282 140 282 168 266C156 238 134 200 122 160Z" fill="url(#${id})" ${OUT}/>
      <path d="M36 258C62 272 138 272 164 258" fill="none" stroke="${trim}" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 166C98 200 92 236 84 270M100 166C104 200 112 236 120 270" fill="none" stroke="${d}" stroke-width="2.5" opacity=".6"/>
      ${pattern || ''}`;
  };
  const bodice = (c, trim) => () => `<path d="M76 150C76 140 88 136 100 136C112 136 124 140 124 150L122 172C110 178 90 178 78 172Z" fill="${c}" ${OUT}/><path d="M80 168C92 174 108 174 120 168" fill="none" stroke="${trim}" stroke-width="5" stroke-linecap="round"/>`;
  const tiaraDraw = (c, jewel, big) => () => `<path d="M70 ${big ? 50 : 54}L76 ${big ? 22 : 36}L88 44L100 ${big ? 12 : 28}L112 44L124 ${big ? 22 : 36}L130 ${big ? 50 : 54}Z" fill="${c}" ${OUT}/>
      <circle cx="100" cy="${big ? 30 : 40}" r="${big ? 7 : 5}" fill="${jewel}" ${THIN}/><circle cx="78" cy="${big ? 32 : 42}" r="3.5" fill="${jewel}"/><circle cx="122" cy="${big ? 32 : 42}" r="3.5" fill="${jewel}"/>${twinkle(100, big ? 6 : 20, 5, '#fff')}`;
  const ITEMS = {
    'gown-petal': { kind: 'gown', name: 'Petal gown', c: C.pink, price: 0, draw: gownDraw(C.pink, '#fff', ''), top: bodice(C.rose, '#fff') },
    'gown-lilac': { kind: 'gown', name: 'Lilac dream', c: C.lilac, price: 30, draw: gownDraw(C.lilac, C.gold, ''), top: bodice('#9C7DF0', C.gold) },
    'gown-mint': { kind: 'gown', name: 'Mint garden gown', c: C.mint, price: 35, draw: gownDraw(C.mint, '#fff', [[60, 236], [100, 250], [140, 236], [80, 206], [120, 206]].map(([x, y]) => heart(x, y, 5, '#fff')).join('')), top: bodice('#4FC3A7', '#fff') },
    'gown-starry': { kind: 'gown', name: 'Starry night gown', c: '#7A6BDB', price: 50, draw: gownDraw('#7A6BDB', C.gold, [[58, 240], [96, 220], [140, 244], [118, 196], [76, 202], [104, 256]].map(([x, y]) => star(x, y, 6)).join('')), top: bodice('#5C4CC2', C.gold) },
    'gown-sky': { kind: 'gown', name: 'Cloud gown', c: C.sky, price: 40, draw: gownDraw(C.sky, '#fff', '<path d="M40 252c10-10 22-10 30 0c8-10 22-10 30 0c8-10 22-10 30 0c8-10 22-10 30 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>'), top: bodice('#5BB6F0', '#fff') },
    'gown-sunshine': { kind: 'gown', name: 'Sunshine gown', c: C.gold, price: 45, draw: gownDraw(C.gold, C.rose, ''), top: bodice(C.amber, C.rose) },
    'gown-rainbow': { kind: 'gown', name: 'Rainbow gown', c: C.pink, price: 60, draw: () => { const id = uid('rb'); return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${['#FF7AA8', '#FFB257', '#FFE066', '#7FE0A0', '#7FC8FF', '#B79BFF'].map((c, i) => `<stop offset="${i / 5}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
      <path d="M78 160C66 200 44 238 32 266C60 282 140 282 168 266C156 238 134 200 122 160Z" fill="url(#${id})" ${OUT}/><path d="M36 258C62 272 138 272 164 258" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`; }, top: bodice('#FF7AA8', '#fff') },
    'tiara-little': { kind: 'tiara', name: 'Little tiara', c: C.gold, price: 0, draw: tiaraDraw(C.gold, C.pink, false) },
    'tiara-star': { kind: 'tiara', name: 'Star tiara', c: C.gold, price: 25, draw: () => tiaraDraw(C.gold, C.sky, false)() + star(100, 24, 14, C.gold, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`) },
    'tiara-crown': { kind: 'tiara', name: 'Royal crown', c: C.gold, price: 50, draw: tiaraDraw(C.gold, C.rose, true) },
    'tiara-flowers': { kind: 'tiara', name: 'Flower crown', c: C.pink, price: 30, draw: () => [62, 78, 94, 110, 126, 140].map((x, i) => `<circle cx="${x}" cy="${54 - Math.sin(i / 5 * Math.PI) * 12}" r="9" fill="${[C.pink, C.gold, C.lilac, C.mint, C.rose, C.sky][i]}" ${THIN}/><circle cx="${x}" cy="${54 - Math.sin(i / 5 * Math.PI) * 12}" r="3" fill="#fff"/>`).join('') },
    'tiara-moon': { kind: 'tiara', name: 'Moon tiara', c: '#E9E4FF', price: 40, draw: () => tiaraDraw('#E9E4FF', C.lilac, false)() + `<path d="M108 14A14 14 0 1 0 108 40A11 11 0 1 1 108 14Z" fill="${C.gold}" ${THIN}/>` },
    'shoes-slipper': { kind: 'shoes', name: 'Glass slippers', c: C.sky, price: 0, draw: () => `<ellipse cx="86" cy="292" rx="12" ry="6" fill="${C.sky}" ${THIN}/><ellipse cx="114" cy="292" rx="12" ry="6" fill="${C.sky}" ${THIN}/>` },
    'shoes-sparkle': { kind: 'shoes', name: 'Sparkle shoes', c: C.pink, price: 20, draw: () => `<ellipse cx="86" cy="292" rx="12" ry="6" fill="${C.pink}" ${THIN}/><ellipse cx="114" cy="292" rx="12" ry="6" fill="${C.pink}" ${THIN}/>${twinkle(80, 286, 4)}${twinkle(118, 286, 4)}` },
    'wand-star': { kind: 'wand', name: 'Star wand', c: C.gold, price: 15, draw: () => `<path d="M152 200L172 150" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M152 200L172 150" stroke="${C.lav}" stroke-width="4" stroke-linecap="round"/>${star(174, 144, 15, C.gold, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`)}${twinkle(192, 126, 6, C.gold)}` },
    'wand-heart': { kind: 'wand', name: 'Heart wand', c: C.rose, price: 20, draw: () => `<path d="M152 200L172 152" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M152 200L172 152" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M174 160C150 146 156 128 168 132C172 133 174 137 174 140C174 137 176 133 180 132C192 128 198 146 174 160Z" fill="${C.rose}" ${THIN}/>${twinkle(194, 130, 6, C.gold)}` },
    'wand-moon': { kind: 'wand', name: 'Moon wand', c: C.lilac, price: 30, draw: () => `<path d="M152 200L172 152" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M152 200L172 152" stroke="${C.gold}" stroke-width="4" stroke-linecap="round"/><path d="M182 132A16 16 0 1 0 182 162A12 12 0 1 1 182 132Z" fill="${C.lilac}" ${THIN}/>${twinkle(194, 128, 6, C.gold)}` },
    'cape-rose': { kind: 'cape', name: 'Rose cape', c: C.rose, price: 35, draw: () => `<path d="M76 146C58 190 52 240 48 276C80 288 120 288 152 276C148 240 142 190 124 146Z" fill="${C.berry}" ${OUT}/>` },
    'cape-stars': { kind: 'cape', name: 'Star cape', c: '#5C4CC2', price: 45, draw: () => `<path d="M76 146C58 190 52 240 48 276C80 288 120 288 152 276C148 240 142 190 124 146Z" fill="#5C4CC2" ${OUT}/>${star(56, 250, 5)}${star(146, 244, 5)}${star(60, 210, 4)}` },
    // story gifts (chapters.js): never sold, never a surprise
    'cape-wings': { kind: 'cape', name: 'Fairy wings', c: '#BFF3E6', price: 0, gift: true, draw: () => `<g opacity=".92"><path d="M96 158C70 112 28 104 22 132C18 156 52 172 92 166Z" fill="#CFF6EE" ${OUT}/><path d="M104 158C130 112 172 104 178 132C182 156 148 172 108 166Z" fill="#CFF6EE" ${OUT}/>
      <path d="M94 170C64 176 40 204 52 222C66 236 90 206 98 176Z" fill="#F6D2F0" ${OUT}/><path d="M106 170C136 176 160 204 148 222C134 236 110 206 102 176Z" fill="#F6D2F0" ${OUT}/>
      <path d="M90 162C70 142 48 132 34 134M110 162C130 142 152 132 166 134" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>${twinkle(30, 116, 6, C.gold)}${twinkle(172, 120, 6, '#fff')}${twinkle(54, 232, 5, '#fff')}` },
    'tiara-rainbow': { kind: 'tiara', name: 'Rainbow tiara', c: '#FF7AA8', price: 0, gift: true, draw: () => `<path d="M68 54L74 26L88 42L100 10L112 42L126 26L132 54Z" fill="${C.gold}" ${OUT}/>
      ${['#FF7AA8', '#FFB257', '#FFE066', '#7FE0A0', '#7FC8FF', '#B79BFF'].map((c, i) => `<circle cx="${75 + i * 10}" cy="${48 - Math.sin((i + 0.5) / 6 * Math.PI) * 6}" r="4.5" fill="${c}" ${THIN}/>`).join('')}
      <path d="M100 18L106 28L100 38L94 28Z" fill="#FF7AA8" ${THIN}/>${twinkle(100, 2, 6, '#fff')}${twinkle(72, 20, 4, C.gold)}${twinkle(128, 20, 4, C.gold)}` },
    'necklace-gem': { kind: 'necklace', name: 'Gem necklace', c: C.pink, price: 20, draw: () => `<path d="M88 146Q100 160 112 146" fill="none" stroke="${C.gold}" stroke-width="3"/>${'<g transform="translate(92 148)">' + `<path d="M2 4L5 0H11L14 4L8 13Z" fill="${C.pink}" ${THIN}/></g>`}` },
    'mane-candy': { kind: 'mane', name: 'Candy mane', cols: ['#FF9BD0', '#B79BFF', '#8FD3FF'], c: '#FF9BD0', price: 0, draw: null },
    'mane-sunset': { kind: 'mane', name: 'Sunset mane', cols: ['#FFB257', '#FF7AA8', '#FFE066'], c: '#FFB257', price: 30, draw: null },
    'mane-ocean': { kind: 'mane', name: 'Ocean mane', cols: ['#7FC8FF', '#7FE0C7', '#B79BFF'], c: '#7FC8FF', price: 30, draw: null },
    'mane-starlight': { kind: 'mane', name: 'Starlight mane', cols: ['#D9CCFF', '#FFFFFF', '#FFE066'], c: '#D9CCFF', price: 45, sparkle: true, draw: null },
    'saddle-heart': { kind: 'saddle', name: 'Heart saddle', c: C.rose, price: 25, draw: () => `<path d="M88 98C100 92 124 92 136 98L132 124C120 128 104 128 92 124Z" fill="${C.rose}" ${OUT}/>${heart(112, 110, 7, '#fff')}` },
    'saddle-gold': { kind: 'saddle', name: 'Golden saddle', c: C.gold, price: 40, draw: () => `<path d="M88 98C100 92 124 92 136 98L132 124C120 128 104 128 92 124Z" fill="${C.gold}" ${OUT}/>${star(112, 110, 8, '#fff')}<path d="M90 120L84 140M134 120L140 140" stroke="${C.gold}" stroke-width="4" stroke-linecap="round"/>` },
    'horn-gold': { kind: 'horn', name: 'Golden horn', c: C.gold, price: 0, draw: null },
    'horn-crystal': { kind: 'horn', name: 'Crystal horn', c: '#C8F0FF', price: 35, glow: true, draw: null },
    'horn-rose': { kind: 'horn', name: 'Rose gold horn', c: '#FFB3C7', price: 30, glow: true, draw: null },
  };
  const SLOTS = { gown: 'princess', tiara: 'princess', shoes: 'princess', wand: 'princess', cape: 'princess', necklace: 'princess', mane: 'unicorn', saddle: 'unicorn', horn: 'unicorn' };
  const STARTER = { gown: 'gown-petal', tiara: 'tiara-little', shoes: 'shoes-slipper', mane: 'mane-candy', horn: 'horn-gold' };

  // An item on its own, for the Boutique's shelves: the princess wearing just it, or the unicorn.
  function itemCard(id, look) {
    const it = ITEMS[id]; if (!it) return '';
    if (SLOTS[it.kind] === 'unicorn') return unicorn(2, { ...STARTER, [it.kind]: id }, { mood: 'calm' });
    return princess(look, { ...STARTER, [it.kind]: id }, { mood: 'calm' });
  }

  // little drawn icons for the quest, stickers and lands (no emoji in the game)
  function icon(kind, size = 30) {
    const body = {
      tower: `<path d="M12 34V10l8-6l8 6v24Z" fill="${C.lav}" ${THIN}/><path d="M10 10L20 1L30 10Z" fill="${C.lilac}" ${THIN}/><path d="M16 34v-7a4 4 0 0 1 8 0v7" fill="${C.berry}" ${THIN}/><circle cx="20" cy="16" r="3.5" fill="${C.gold}" ${THIN}/>`,
      book: `<path d="M20 9C14 5 8 5 4 7v24c4-2 10-2 16 2c6-4 12-4 16-2V7c-4-2-10-2-16 2Z" fill="#fff" ${THIN}/><path d="M20 9v24" stroke="${INK}" stroke-width="2.5"/><path d="M8 13c3-1 6-1 8 0M8 18c3-1 6-1 8 0M24 13c3-1 6-1 8 0M24 18c3-1 6-1 8 0" stroke="${C.lilac}" stroke-width="2" stroke-linecap="round"/>`,
      gem: `<path d="M7 15L13 7H27L33 15L20 34Z" fill="${C.pink}" ${THIN}/><path d="M7 15H33M13 7L17 15L20 34L23 15L27 7" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".5"/>`,
      star: star(20, 21, 15, C.gold, `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`),
      flower: `${[0, 72, 144, 216, 288].map(a => `<circle cx="${20 + 9 * Math.cos((a - 90) * Math.PI / 180)}" cy="${19 + 9 * Math.sin((a - 90) * Math.PI / 180)}" r="7" fill="${C.pink}" ${THIN}/>`).join('')}<circle cx="20" cy="19" r="5.5" fill="${C.gold}" ${THIN}/>`,
      tiara: `<path d="M6 30L8 12L14 21L20 7L26 21L32 12L34 30Z" fill="${C.gold}" ${THIN}/><circle cx="20" cy="22" r="3.5" fill="${C.rose}" ${THIN}/>`,
      sparkle: twinkle(20, 20, 16, C.gold) + twinkle(31, 9, 6, C.pink),
      unicorn: `<path d="M9 34C8 24 11 17 18 14L16 8L21 13C27 13 32 17 33 23C34 27 31 29 28 28C25 27 23 28 22 30C21 32 21 33 22 34Z" fill="#fff" ${THIN}/><path d="M21 13L27 2L26 15Z" fill="${C.gold}" ${THIN}/><circle cx="26" cy="20" r="1.8" fill="${INK}"/>`,
    }[kind] || '';
    return svg('0 0 40 40', body, '', 'ico').replace('<svg ', `<svg width="${size}" height="${size}" `);
  }

  root.SparkleArt = { icon, C, INK, SKIN, HAIR, STYLES, ITEMS, SLOTS, STARTER, uid, svg, star, twinkle, heart, shade, coin, gem, gift, cloud, princess, unicorn, owl, dragon, fairy, itemCard, esc };
})(typeof window !== 'undefined' ? window : globalThis);
