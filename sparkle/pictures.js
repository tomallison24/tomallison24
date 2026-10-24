// Sparkle Kingdom's word pictures: every word a question shows as a picture (content.js PIC), drawn in
// code in the game's storybook style (art.js): a plum outline, flat pastel colour with a soft highlight,
// big friendly eyes, chosen so a 5-year-old names each one with exactly its word (a top hat for "hat",
// a teacup for "cup" and a tall mug for "mug"). window.SparklePics: word -> (uid) => the inner markup of a
// 0 0 100 100 SVG (uid gives ids that are unique on the page). app.js draws them; where a word has no
// drawing it falls back to the phone's emoji. Three parts, drawn side by side: animals, food and nature,
// objects and vehicles.

// ======== pics-animals ========
'use strict';

// Sparkle Kingdom's picture words, part one: animals. A child sees a word (or hears a sound) and
// taps the matching picture, so each animal is the most obvious, picture-book version of its word.
// Same look as art.js: a soft plum outline (never black), flat colour (true to life where that
// makes the animal easier to name), one gentle highlight, a soft shadow under animals that stand,
// and big friendly eyes with pink cheeks. The horse, zebra and unicorn share the mascot unicorn's
// shape from art.js, so the unicorn here is the same friend the child plays with.
//
// Each picture is a function (uid) => SVG markup for a viewBox of 0 0 100 100, without the
// <svg> wrapper. uid(prefix) gives a unique id, for a picture that needs one (a clip path).
(function (root) {
  const P = root.SparklePics = root.SparklePics || {};
  const A = {};   // this file's pictures, added to SparklePics at the bottom
  const INK = '#4B2E6F';
  // Every picture is wrapped in a <g> with round joins and caps (at the bottom), so the shapes leave them out.
  const O = `stroke="${INK}" stroke-width="3"`, T = `stroke="${INK}" stroke-width="2"`;
  const PINK = '#FF8FC7', ROSE = '#FF5FA8', LILAC = '#B79BFF', LAV = '#D9CCFF', MINT = '#7FE0C7', SKY = '#8FD3FF', GOLD = '#FFC94A', CREAM = '#FFF6E9';
  const f = n => +n.toFixed(1);

  // ---- little pieces ----
  const shadow = (rx = 30, cx = 50, cy = 90) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.6" fill="${INK}" opacity=".12"/>`;
  const shine = (cx, cy, rx, ry, rot = -25) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity=".5"/>`;
  const eye = (x, y, r = 4) => `<ellipse cx="${x}" cy="${y}" rx="${f(r * .86)}" ry="${r}" fill="${INK}"/><circle cx="${f(x + r * .3)}" cy="${f(y - r * .38)}" r="${f(r * .4)}" fill="#fff"/><circle cx="${f(x - r * .32)}" cy="${f(y + r * .45)}" r="${f(r * .17)}" fill="#fff"/>`;
  const eyes = (x1, x2, y, r) => eye(x1, y, r) + eye(x2, y, r);
  const blush = (x, y, rx = 4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${f(rx * .62)}" fill="${PINK}" opacity=".6"/>`;
  const line = (d, w = 2, c = INK, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${extra ? ' ' + extra : ''}/>`;
  const limb = (d, w, fill) => line(d, w, INK) + line(d, w - 4.6, fill);           // a leg, tail or trunk: a fat stroke with an outline
  const mouth = (x, y, w = 3) => line(`M${x - w} ${y}Q${x} ${f(y + w * .9)} ${x + w} ${y}`, 2);
  const catMouth = (x, y, s = 1) => line(`M${x} ${y}v${f(2 * s)}M${f(x - 4 * s)} ${f(y + 2 * s)}Q${f(x - 2 * s)} ${f(y + 4.6 * s)} ${x} ${f(y + 2 * s)}Q${f(x + 2 * s)} ${f(y + 4.6 * s)} ${f(x + 4 * s)} ${f(y + 2 * s)}`, 1.8);
  const mirror = s => s + `<g transform="matrix(-1 0 0 1 100 0)">${s}</g>`;      // the left half, and the same flipped for the right
  const clip = (uid, shape) => { const id = (uid || (p => p + Math.random().toString(36).slice(2, 8)))('pa'); return [id, `<defs><clipPath id="${id}">${shape}</clipPath></defs>`]; };
  const legs = (xs, y1, y2, w, c) => xs.map(x => limb(`M${x} ${y1}V${y2}`, w, c)).join('');

  // The horse family (horse, zebra, unicorn), drawn on the mascot unicorn's lines (art.js) and
  // scaled into the 100 box.
  const equine = (uid, o) => {
    const S = `stroke="${INK}" stroke-width="7.5"`, s = `stroke="${INK}" stroke-width="5"`;
    const L = o.legs || 0, leg = (x, c) => `<path d="M${x} 150V${186 + L}" stroke="${INK}" stroke-width="22"/><path d="M${x} 150V${186 + L}" stroke="${c}" stroke-width="13"/><rect x="${x - 10}" y="${182 + L}" width="20" height="12" rx="5" fill="${o.hoof}" ${s}/>`;
    const BODY = '<ellipse cx="112" cy="130" rx="64" ry="40"/>', NECK = '<path d="M150 112C152 86 160 66 176 58L204 92C190 100 182 118 178 134Z"/>';
    const [b, bc] = clip(uid, BODY), [n, nc] = clip(uid, NECK);
    return `${bc}${nc}${shadow(32, 47, f((o.dy || 12) + (194 + L) * .38 + 1.8))}<g transform="translate(3 ${o.dy || 12}) scale(.38)">
      ${o.tail(S)}${leg(76, o.back)}${leg(150, o.back)}
      <ellipse cx="112" cy="130" rx="64" ry="40" fill="${o.body}" ${S}/>${o.bodyMarks ? `<g clip-path="url(#${b})">${o.bodyMarks}</g><ellipse cx="112" cy="130" rx="64" ry="40" fill="none" ${S}/>` : ''}
      ${leg(92, o.body)}${leg(166, o.body)}${o.legMarks || ''}
      <path d="M150 112C152 86 160 66 176 58L204 92C190 100 182 118 178 134Z" fill="${o.body}" ${S}/>${o.neckMarks ? `<g clip-path="url(#${n})">${o.neckMarks}</g>` : ''}
      <path d="M168 52C190 40 226 50 232 78C238 102 222 116 204 112C190 110 176 98 170 84C162 72 160 60 168 52Z" fill="${o.body}" ${S}/>${o.faceMarks || ''}
      <ellipse cx="222" cy="98" rx="14" ry="11" fill="${o.nose}" ${s}/><circle cx="220" cy="96" r="2.6" fill="${INK}"/><circle cx="229" cy="99" r="2.4" fill="${INK}"/>
      <path d="M176 56L170 30L190 48Z" fill="${o.body}" ${S}/><path d="M176 50L174 38L184 47Z" fill="${PINK}"/>
      ${o.horn || ''}
      <ellipse cx="198" cy="76" rx="8.5" ry="10.5" fill="${INK}"/><ellipse cx="200.5" cy="72" rx="3.4" ry="3.9" fill="#fff"/><circle cx="195.5" cy="80.5" r="1.7" fill="#fff"/><path d="M190 66l-5 -4M196 63l-2 -6" stroke="${INK}" stroke-width="3"/>
      <path d="M208 106Q214 110 220 108" fill="none" stroke="${INK}" stroke-width="4"/><ellipse cx="206" cy="92" rx="9" ry="5.5" fill="${PINK}" opacity=".6"/>
      ${o.mane(S)}</g>`;
  };

  Object.assign(A, {
    cat: () => { const c = '#FFB866', d = '#EE8A3A', l = '#FFE6C9';
      return `${shadow(26)}${limb('M68 84C84 86 90 72 84 62', 9, c)}
      <path d="M30 88C28 70 37 58 50 58C63 58 72 70 70 88Z" fill="${c}" ${O}/><ellipse cx="50" cy="77" rx="9" ry="9" fill="${l}"/>
      ${mirror(`<ellipse cx="41" cy="88" rx="6.5" ry="4" fill="${c}" ${O}/><path d="M28 36L25 10L46 23Z" fill="${c}" ${O}/><path d="M30.5 29L29 17L39 23Z" fill="${PINK}"/>`)}
      <ellipse cx="50" cy="40" rx="26" ry="21" fill="${c}" ${O}/>
      ${line('M44 20.5l1.5 6M50 19.5v7M56 20.5l-1.5 6M24.6 36h5M25 42h4.5M75.4 36h-5M75 42h-4.5', 2.6, d)}
      <ellipse cx="50" cy="49" rx="9" ry="6" fill="${l}"/>
      ${eyes(40.5, 59.5, 38, 4.6)}<path d="M47.3 45h5.4l-2.7 3.2Z" fill="${ROSE}" stroke="${INK}" stroke-width="1.2"/>${catMouth(50, 48)}
      ${line('M37 48L22 46M37 51L22 53M63 48L78 46M63 51L78 53', 1.5, INK, 'opacity=".75"')}
      ${blush(33, 47, 3.5)}${blush(67, 47, 3.5)}${shine(37, 27, 6, 2.8)}`; },

    bat: () => { const w = '#7C68C4', b = '#A08BE0';
      return `<g transform="translate(0 4)">${mirror(`<path d="M40 48C30 36 16 34 5 42C10 46 10 52 8 58C14 55 19 57 21 63C25 58 30 59 34 64C35 58 37 54 41 54Z" fill="${w}" ${O}/>${line('M38 50L15 43M38 53L23 60', 1.6, INK, 'opacity=".35"')}<path d="M38 38L35 18L48 31Z" fill="${b}" ${O}/><path d="M39.5 33L38 24L44.5 30Z" fill="${PINK}"/>`)}
      <ellipse cx="50" cy="52" rx="17" ry="19" fill="${b}" ${O}/><ellipse cx="50" cy="62" rx="9" ry="7.5" fill="${LAV}"/>
      ${line('M45 70.5v4M55 70.5v4', 3)}
      ${eyes(43.5, 56.5, 47, 4.4)}${mouth(50, 55, 3.5)}<path d="M47 55.8l1.1 2.8 1.2-2.3ZM53 55.8l-1.1 2.8-1.2-2.3Z" fill="#fff" stroke="${INK}" stroke-width="1"/>
      ${blush(38.5, 54, 3.2)}${blush(61.5, 54, 3.2)}${shine(42, 39, 5, 2.4)}</g>`; },

    pig: () => { const p = '#FFB8D4', s = '#FF9CC6';
      return `${shadow(32, 48)}${line('M19 56c-7-1-9 6-4 8s5-4 0-5', 2.6)}${legs([28, 40, 58, 68], 72, 86, 12, p)}
      <ellipse cx="44" cy="60" rx="27" ry="19" fill="${p}" ${O}/>
      <path d="M54 34L50 19L63 27Z" fill="${p}" ${O}/><path d="M82 34L86 19L73 27Z" fill="${p}" ${O}/>
      <circle cx="68" cy="46" r="19" fill="${p}" ${O}/>
      <ellipse cx="69" cy="53" rx="9.5" ry="7" fill="${s}" ${T}/><ellipse cx="66" cy="53" rx="1.7" ry="2.6" fill="${INK}"/><ellipse cx="72" cy="53" rx="1.7" ry="2.6" fill="${INK}"/>
      ${eyes(61, 76, 41.5, 3.8)}${mouth(69, 62, 3)}${blush(56, 50, 3.5)}${blush(83, 49, 3.2)}${shine(32, 48, 8, 3, -15)}`; },

    dog: () => { const c = '#E3AE72', e = '#A8673F', m = '#FFF1DE';
      return `${shadow(32, 48)}${limb('M22 56C14 50 12 40 17 33', 8, c)}${legs([28, 38, 58, 68], 68, 87, 9, c)}
      <ellipse cx="44" cy="60" rx="25" ry="16" fill="${c}" ${O}/><path d="M30 50C36 46 44 50 42 56C40 61 32 61 29 57Z" fill="${e}" opacity=".55"/>
      <circle cx="68" cy="41" r="19" fill="${c}" ${O}/>
      ${line('M55 56Q68 65 81 56', 7.5)}${line('M55 56Q68 65 81 56', 3.6, ROSE)}<circle cx="68" cy="64" r="3.4" fill="${GOLD}" ${T}/>
      <path d="M53 28C42 28 39 46 45 56C52 55 55 44 56 35Z" fill="${e}" ${O}/><path d="M83 28C94 28 97 46 91 56C84 55 81 44 80 35Z" fill="${e}" ${O}/>
      <ellipse cx="68" cy="49" rx="10" ry="7.5" fill="${m}"/>
      <path d="M65.5 52.5h5v3.5a2.5 2.5 0 0 1-5 0Z" fill="${ROSE}" stroke="${INK}" stroke-width="1.4"/>
      ${line('M68 48.5v2.6M63.5 50.8Q66 53.6 68 51.1Q70 53.6 72.5 50.8', 1.8)}
      <ellipse cx="68" cy="45.5" rx="4.4" ry="3.2" fill="${INK}"/><circle cx="69.4" cy="44.5" r="1.1" fill="#fff"/>
      ${eyes(61, 75, 37, 3.8)}${blush(58, 47, 3)}${blush(78, 47, 3)}${shine(61, 28, 5, 2.4)}`; },

    fox: () => { const o = '#F5873A', w = CREAM, k = '#7A4636', H = 'M23 30C24 20 37 17 50 17C63 17 76 20 77 30C78 40 64 53 50 60C36 53 22 40 23 30Z';
      return `${shadow(32, 54)}
      <path d="M62 86C84 90 97 74 91 56C87 45 77 43 72 51C78 60 78 72 64 76Z" fill="${o}" ${O}/><path d="M91 57C87 45 77 43 72 51C78 57 85 59 91 57Z" fill="${w}" ${T}/>
      <path d="M32 88C30 70 38 58 50 58C62 58 70 70 68 88Z" fill="${o}" ${O}/><path d="M42 62Q50 86 58 62Q50 59 42 62Z" fill="${w}"/>
      ${mirror(`<ellipse cx="41" cy="88" rx="6" ry="4" fill="${k}" ${O}/><path d="M31 32L25 7L47 21Z" fill="${o}" ${O}/><path d="M27.4 16.5L25 7L33.5 12.5Z" fill="${k}"/><path d="M33 27L31 18.5L40 22.5Z" fill="${w}"/>`)}
      <path d="${H}" fill="${o}"/><path d="M24 34C32 40 42 41 50 46C58 41 68 40 76 34C73 44 62 54 50 60C38 54 27 44 24 34Z" fill="${w}"/><path d="${H}" fill="none" ${O}/>
      ${eyes(39.5, 60.5, 32, 4.2)}<ellipse cx="50" cy="51.5" rx="3.8" ry="2.8" fill="${INK}"/><circle cx="51.2" cy="50.7" r="1" fill="#fff"/>
      ${line('M47 55.2Q50 57.6 53 55.2', 1.8)}${blush(32, 40, 3.4)}${blush(68, 40, 3.4)}${shine(36, 22, 5, 2.2)}`; },

    bug: () => { const r = '#FF5D5D', h = '#5A3C80';
      return `${shadow(30, 50, 91)}${mirror(line('M26 50L14 43M23 62L10 64M27 75L17 84', 3.2) + line('M44 16C41 9 37 7 32 7', 2.4) + `<circle cx="32" cy="7" r="2.6" fill="${INK}"/>`)}
      <circle cx="50" cy="27" r="15" fill="${h}" ${O}/>
      ${mirror(`<circle cx="44" cy="23" r="4.8" fill="#fff"/><ellipse cx="44.8" cy="23.6" rx="2.6" ry="3" fill="${INK}"/><circle cx="45.6" cy="22.4" r="1" fill="#fff"/>`)}
      <circle cx="50" cy="59" r="28" fill="${r}" ${O}/>${line('M50 31.5V86.5', 2.4)}
      ${mirror('<circle cx="38.5" cy="47" r="5.5" fill="' + INK + '"/><circle cx="34.5" cy="64" r="5" fill="' + INK + '"/><circle cx="41.5" cy="78" r="4" fill="' + INK + '"/>')}
      ${shine(35, 42, 6, 3)}${shine(65, 42, 2.5, 1.5)}`; },

    frog: () => { const g = '#7ED36A', l = '#DDF6C2';
      return `${shadow(38)}${mirror(`<ellipse cx="27" cy="76" rx="13" ry="11" fill="${g}" ${O}/><path d="M12 86C12 82 20 82 26 84C30 85 31 89 26 90H14C12 90 12 88 12 86Z" fill="${g}" ${O}/>`)}
      <ellipse cx="50" cy="68" rx="21" ry="19" fill="${g}" ${O}/><ellipse cx="50" cy="73" rx="13" ry="12" fill="${l}"/>
      ${mirror(`<ellipse cx="41" cy="87.5" rx="5.5" ry="3.5" fill="${g}" ${O}/><circle cx="34" cy="30" r="11" fill="${g}" ${O}/>`)}
      <ellipse cx="50" cy="46" rx="29" ry="18" fill="${g}" ${O}/>
      ${eyes(34, 66, 30, 5.6)}<circle cx="47" cy="42" r="1.2" fill="${INK}"/><circle cx="53" cy="42" r="1.2" fill="${INK}"/>
      ${line('M34 50Q50 61 66 50', 2.6)}${blush(28, 52, 4)}${blush(72, 52, 4)}${shine(26, 22, 3.5, 2)}${shine(40, 36, 6, 2.2, -10)}`; },

    snake: () => { const s = '#56C596', d = '#2F9A72', B = 'M12 84C32 90 54 88 66 80C78 72 72 60 58 58C44 56 36 48 42 38C46 31 54 29 60 31';
      return `${shadow(36, 46)}<path d="M15 80L3 86L15 89Z" fill="${s}" ${O}/>${line(B, 15)}${line(B, 10, s)}${line(B, 4, d, 'stroke-dasharray=".1 9"')}
      ${line('M63 39v7M63 46l-3 3M63 46l3 3', 2.2, ROSE)}
      <ellipse cx="63" cy="30" rx="13.5" ry="10.5" fill="${s}" ${O}/>
      ${eyes(57.5, 68.5, 27.5, 3.4)}${mouth(63, 35, 3)}${blush(53, 33, 2.6)}${blush(73, 33, 2.6)}${shine(56, 22, 4, 1.8)}`; },

    goat: () => { const c = '#F1E4CF', h = '#9C8A70', bd = '#D8C3A3', hf = '#8C7B6A';
      return `${shadow(33, 48)}<g transform="translate(-8 -9) scale(1.12)"><path d="M21 55C16 52 14 46 16 42C19 45 22 50 23 53Z" fill="${c}" ${O}/>
      ${[28, 38, 56, 64].map(x => limb(`M${x} 66V85`, 8, c) + `<rect x="${x - 4}" y="84" width="8" height="5" rx="2" fill="${hf}" ${T}/>`).join('')}
      <ellipse cx="42" cy="60" rx="24" ry="15" fill="${c}" ${O}/>
      <path d="M63 29C60 18 54 13 49 15C54 18 57 23 59 31Z" fill="${h}" ${O}/><path d="M77 29C80 18 86 13 91 15C86 18 83 23 81 31Z" fill="${h}" ${O}/>
      <path d="M59 36C51 33 45 37 47 40C51 42 56 41 59 40Z" fill="${c}" ${O}/><path d="M81 36C89 33 95 37 93 40C89 42 84 41 81 40Z" fill="${c}" ${O}/>
      <path d="M65 54L70 71L75 54Z" fill="${bd}" ${O}/>
      <ellipse cx="70" cy="42" rx="13" ry="16" fill="${c}" ${O}/><ellipse cx="70" cy="51" rx="8.5" ry="6" fill="#F7D6CC"/>
      <ellipse cx="67.5" cy="50" rx="1.3" ry="1.9" fill="${INK}"/><ellipse cx="72.5" cy="50" rx="1.3" ry="1.9" fill="${INK}"/>${line('M67 54.2Q70 56.4 73 54.2', 1.6)}
      ${eyes(64.5, 75.5, 39, 3.4)}${blush(61, 47, 2.6)}${blush(79, 47, 2.6)}${shine(32, 51, 7, 2.6, -12)}</g>`; },

    bear: () => { const b = '#B57A4A', l = '#F3D4B0';
      return `${shadow(30)}${mirror(`<circle cx="29" cy="23" r="8.5" fill="${b}" ${O}/><circle cx="29.5" cy="23.5" r="4.2" fill="${l}"/>`)}
      <ellipse cx="50" cy="71" rx="23" ry="18" fill="${b}" ${O}/><ellipse cx="50" cy="74" rx="13" ry="11" fill="${l}"/>
      ${mirror(`<ellipse cx="29" cy="68" rx="6" ry="9.5" transform="rotate(20 29 68)" fill="${b}" ${O}/><ellipse cx="36" cy="87" rx="8.5" ry="5" fill="${b}" ${O}/><ellipse cx="36" cy="87" rx="4" ry="2.4" fill="${l}"/>`)}
      <ellipse cx="50" cy="40" rx="25" ry="21" fill="${b}" ${O}/>
      <ellipse cx="50" cy="48" rx="10.5" ry="8" fill="${l}"/><ellipse cx="50" cy="44.5" rx="4.4" ry="3.2" fill="${INK}"/><circle cx="51.4" cy="43.5" r="1.1" fill="#fff"/>
      ${line('M50 47.5v2.6M46 50Q48 52.8 50 50.2Q52 52.8 54 50', 1.8)}
      ${eyes(40, 60, 36, 4.2)}${blush(32, 46, 3.6)}${blush(68, 46, 3.6)}${shine(38, 26, 6, 2.6)}`; },

    mouse: () => { const g = '#BDB7D2', p = '#FFB3DA', TL = 'M20 78C7 80 3 68 10 62C14 58 19 61 17 65';
      return `${shadow(32, 50)}${line(TL, 5.2)}${line(TL, 2, p)}
      <ellipse cx="38" cy="73" rx="22" ry="15" fill="${g}" ${O}/><ellipse cx="32" cy="87.5" rx="5.5" ry="3" fill="${p}" ${T}/><ellipse cx="48" cy="87.5" rx="5.5" ry="3" fill="${p}" ${T}/>
      <circle cx="74" cy="25" r="10.5" fill="${g}" ${O}/><circle cx="74" cy="25.5" r="6" fill="${p}"/>
      <circle cx="55" cy="27" r="12.5" fill="${g}" ${O}/><circle cx="55" cy="28" r="7.5" fill="${p}"/>
      <path d="M47 52C46 38 57 30 68 32C79 34 88 45 92 55C86 62 74 64 63 63C53 62 47 59 47 52Z" fill="${g}" ${O}/>
      <circle cx="91.5" cy="55" r="3.6" fill="${ROSE}" ${T}/>${line('M86 58.5L98 54M86 60.5L98 64', 1.4)}
      ${eye(72, 45, 4.4)}${line('M79 59.5Q82 62 85 59.5', 1.7)}${blush(74, 54, 3.4)}${shine(26, 66, 6, 2.6)}`; },

    bee: uid => { const y = '#FFD23F', [id, cp] = clip(uid, '<ellipse cx="46" cy="60" rx="32" ry="22"/>');
      return `${cp}<ellipse cx="37" cy="31" rx="10" ry="16" transform="rotate(-28 37 31)" fill="#EAF7FF" ${O}/><ellipse cx="53" cy="29" rx="9" ry="14" transform="rotate(18 53 29)" fill="#EAF7FF" ${O}/>
      <path d="M16 57L4 60.5L16 64Z" fill="${INK}" ${T}/>
      ${line('M62 40C60 30 56 26 51 25M72 41C74 31 79 27 84 27', 2.2)}<circle cx="51" cy="25" r="2.8" fill="${INK}"/><circle cx="84" cy="27" r="2.8" fill="${INK}"/>
      <ellipse cx="46" cy="60" rx="32" ry="22" fill="${y}"/><g clip-path="url(#${id})">${line('M27 36Q22 60 27 84M43 36Q38 60 43 84', 8.5)}</g><ellipse cx="46" cy="60" rx="32" ry="22" fill="none" ${O}/>
      ${eyes(61.5, 73.5, 56, 4.3)}${mouth(67.5, 65, 3.2)}${blush(56.5, 63, 3)}${blush(78.5, 63, 3)}${shine(28, 31, 3, 6, 30)}`; },

    rabbit: () => { const w = '#FFFFFF', s = '#EFE8FB';
      return `${shadow(26)}${mirror(`<path d="M41 30C34 18 34 4 40.5 3C47 2 49 18 47 30Z" fill="${w}" ${O}/><path d="M41.6 25C38 17 38 9.5 40.8 8.6C43.8 8 44.8 17 44.4 25Z" fill="${PINK}"/>`)}
      <ellipse cx="50" cy="72" rx="20" ry="17" fill="${w}" ${O}/><ellipse cx="50" cy="76" rx="11" ry="10" fill="${s}"/>
      ${mirror(`<ellipse cx="37" cy="88" rx="8" ry="4.5" fill="${w}" ${O}/>`)}
      <ellipse cx="50" cy="44" rx="20" ry="17" fill="${w}" ${O}/>
      ${eyes(42.5, 57.5, 41, 4)}<path d="M47.8 47.3h4.4l-2.2 2.4Z" fill="${ROSE}"/>
      ${line('M50 49.6v1.6M46.6 51.2Q48.3 53.2 50 51.2Q51.7 53.2 53.4 51.2', 1.6)}<path d="M48.2 52.6h3.6v3.2h-3.6Z" fill="#fff" stroke="${INK}" stroke-width="1.3"/>
      ${blush(37.5, 48, 3.4)}${blush(62.5, 48, 3.4)}
      <g transform="rotate(30 52 72)"><path d="M45.5 60H58.5L52 91Z" fill="#FF9A3C" ${T}/>${line('M49.5 69h3M50.5 75h2.5', 1.5, '#D9711E')}<path d="M52 63C46 57 46 53 50 55C51 51 54 51 54 55C58 53 59 57 52 63Z" fill="#6CC24A" ${T}/></g>
      ${mirror(`<ellipse cx="45" cy="67" rx="4.6" ry="3.6" fill="${w}" ${T}/>`)}${shine(43, 33, 5, 2.2)}`; },

    tiger: uid => { const o = '#FFA94D', w = CREAM, [id, cp] = clip(uid, '<ellipse cx="44" cy="62" rx="26" ry="16"/>');
      return `${cp}${shadow(32, 48)}${limb('M20 58C11 56 9 46 14 40', 7, o)}${line('M10.5 46l4.6 .6M11.4 51.5l4.4-.8', 2.4)}${legs([28, 38, 58, 68], 68, 87, 10, o)}
      ${line('M24 80h6M54 81h6M64 80h6', 2.4)}
      <ellipse cx="44" cy="62" rx="26" ry="16" fill="${o}"/><g clip-path="url(#${id})">${line('M30 44q3.5 7 0 13M40 44q3.5 8 0 14M50 44q3.5 8 0 14M21 50q3 5 0 9', 3.6)}</g><ellipse cx="44" cy="62" rx="26" ry="16" fill="none" ${O}/>
      <circle cx="55.5" cy="29" r="6" fill="${o}" ${O}/><circle cx="80.5" cy="29" r="6" fill="${o}" ${O}/><circle cx="55.5" cy="29" r="3" fill="${PINK}"/><circle cx="80.5" cy="29" r="3" fill="${PINK}"/>
      <circle cx="68" cy="44" r="18.5" fill="${o}" ${O}/>
      ${line('M68 26.6v6.4M62.5 27.6l1.6 4.6M73.5 27.6l-1.6 4.6M50.4 40h5M50.8 46.5h4.6M85.6 40h-5M85.2 46.5h-4.6', 2.7)}
      <ellipse cx="68" cy="52.5" rx="10" ry="7" fill="${w}"/>
      <path d="M65 48h6l-3 3.4Z" fill="${ROSE}" stroke="${INK}" stroke-width="1.2"/>${catMouth(68, 51.2, .9)}
      ${eyes(61, 75, 41, 3.9)}${blush(57, 49, 3)}${blush(79, 49, 3)}`; },

    lion: () => { const b = '#F7C35C', m = '#E58A2E';
      let mane = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, a2 = a + Math.PI / 6, am = a + Math.PI / 12, R = 22, C = 31;
        mane += `${i ? '' : `M${f(68 + Math.cos(a) * R)} ${f(44 + Math.sin(a) * R)}`}Q${f(68 + Math.cos(am) * C)} ${f(44 + Math.sin(am) * C)} ${f(68 + Math.cos(a2) * R)} ${f(44 + Math.sin(a2) * R)}`; }
      return `${shadow(34, 50)}${limb('M20 60C11 60 7 50 11 43', 6, b)}<ellipse cx="11" cy="40" rx="5" ry="6" fill="${m}" ${O}/>${legs([28, 38, 58, 68], 68, 87, 10, b)}
      <ellipse cx="44" cy="62" rx="26" ry="16" fill="${b}" ${O}/>
      <path d="${mane}Z" fill="${m}" ${O}/>
      <circle cx="56.5" cy="32" r="5" fill="${b}" ${O}/><circle cx="79.5" cy="32" r="5" fill="${b}" ${O}/><circle cx="56.5" cy="32" r="2.4" fill="${PINK}"/><circle cx="79.5" cy="32" r="2.4" fill="${PINK}"/>
      <circle cx="68" cy="45" r="15" fill="${b}" ${O}/><ellipse cx="68" cy="52" rx="8" ry="5.5" fill="${CREAM}"/>
      <path d="M65.2 48h5.6l-2.8 3.2Z" fill="${ROSE}" stroke="${INK}" stroke-width="1.2"/>${catMouth(68, 51, .8)}
      ${eyes(62.2, 73.8, 42, 3.5)}${blush(58, 49, 2.6)}${blush(78, 49, 2.6)}${shine(32, 51, 7, 2.6, -12)}`; },

    ox: () => { const b = '#A8673F', m = '#F2C9AE', d = '#7E4A2C', TL = 'M16 56C10 60 9 68 10 73';
      return `${shadow(36, 48)}${line(TL, 5.4)}${line(TL, 2.2, b)}<ellipse cx="10" cy="76" rx="3.4" ry="4.8" fill="${d}" ${T}/>
      ${[26, 37, 52, 62].map(x => limb(`M${x} 66V85`, 11, b) + `<rect x="${x - 5.5}" y="83.5" width="11" height="5.5" rx="2.4" fill="${d}" ${T}/>`).join('')}
      <ellipse cx="40" cy="58" rx="27" ry="18" fill="${b}" ${O}/>
      <path d="M53 30C42 31 35 24 33 12C40 18 47 21 56 22Z" fill="${CREAM}" ${O}/><path d="M75 30C86 31 93 24 95 12C88 18 81 21 72 22Z" fill="${CREAM}" ${O}/>
      <ellipse cx="49" cy="35" rx="6.5" ry="3.6" transform="rotate(-20 49 35)" fill="${b}" ${O}/><ellipse cx="79" cy="35" rx="6.5" ry="3.6" transform="rotate(20 79 35)" fill="${b}" ${O}/>
      <path d="M52 32C52 24 58 20 64 20C70 20 76 24 76 32L75 48C74 56 54 56 53 48Z" fill="${b}" ${O}/>
      <path d="M58 23C59 17 63 18 64 22C65 17 69 17 70 23Z" fill="${d}" ${T}/>
      <ellipse cx="64" cy="50" rx="12.5" ry="8" fill="${m}" ${T}/><ellipse cx="59.5" cy="49" rx="1.8" ry="2.6" fill="${INK}"/><ellipse cx="68.5" cy="49" rx="1.8" ry="2.6" fill="${INK}"/>
      <circle cx="64" cy="57.5" r="4" fill="none" stroke="${INK}" stroke-width="4.6"/><circle cx="64" cy="57.5" r="4" fill="none" stroke="${GOLD}" stroke-width="2.2"/>
      ${eyes(58, 70, 35, 3.6)}${blush(54, 42, 2.8)}${blush(74, 42, 2.8)}${shine(28, 49, 8, 3, -15)}`; },

    elephant: () => { const g = '#B9B3CF', l = '#D3CEE3';
      return `${shadow(36, 48)}${line('M18 56C13 59 12 65 13 70', 2.4)}<path d="M13 69l-2.5 4.5h5Z" fill="${INK}" ${T}/>${legs([28, 40, 57, 68], 66, 86, 12, g)}
      <ellipse cx="44" cy="57" rx="27" ry="19" fill="${g}" ${O}/>
      ${limb('M80 50C88 55 91 63 90 71C89 77 93 80 96 76', 10.5, g)}
      <circle cx="69" cy="43" r="17" fill="${g}" ${O}/>
      <path d="M79 54C80 59 84 61 88 59C85 58 83 56 83 53Z" fill="#fff" ${T}/>
      <path d="M61 27C46 25 41 43 45 55C49 64 60 62 63 54Z" fill="${l}" ${O}/><path d="M58 32C50 32 47 43 49 51C52 57 58 56 60 51Z" fill="${PINK}" opacity=".45"/>
      ${eye(73.5, 39.5, 3.8)}${line('M70 52.5Q73.5 55.5 77.5 53', 1.8)}${blush(77, 47, 2.8)}${shine(30, 46, 8, 3, -15)}`; },

    monkey: () => { const b = '#A8673F', f2 = '#FFD7B5';
      return `${shadow(28)}${limb('M34 82C16 86 8 72 14 62C18 56 25 60 22 65', 6, b)}
      <ellipse cx="50" cy="72" rx="18" ry="16" fill="${b}" ${O}/><ellipse cx="50" cy="75" rx="10.5" ry="10" fill="${f2}"/>
      ${mirror(`<ellipse cx="40" cy="88" rx="7" ry="4" fill="${f2}" ${O}/><circle cx="27" cy="40" r="8.5" fill="${b}" ${O}/><circle cx="27.5" cy="40" r="4.6" fill="${f2}"/>`)}
      <circle cx="50" cy="38" r="22" fill="${b}" ${O}/>
      <path d="M50 30C45 22 33 25 32 35C31 43 35 50 40 53C44 56 56 56 60 53C65 50 69 43 68 35C67 25 55 22 50 30Z" fill="${f2}"/>
      ${eyes(42.5, 57.5, 35, 4)}<circle cx="48" cy="44" r="1.1" fill="${INK}"/><circle cx="52" cy="44" r="1.1" fill="${INK}"/>${line('M43 47.5Q50 53.5 57 47.5', 2)}
      ${blush(37, 45, 3)}${blush(63, 45, 3)}
      <path d="M63 73C76 73 86 64 85 51C81 60 73 65 62 66Z" fill="#FFE066" ${T}/>${line('M85 51l.6-3', 2.6, '#8A6A2E')}
      <ellipse cx="65" cy="68" rx="4.6" ry="4" fill="${f2}" ${T}/><ellipse cx="36" cy="66" rx="4.6" ry="4" fill="${f2}" ${T}/>${shine(41, 21, 5, 2.2)}`; },

    kangaroo: () => { const k = '#D99A5E', l = '#F6DDB6';
      return `${shadow(38, 46)}<path d="M40 70C30 78 16 84 4 88C13 92 30 91 44 84Z" fill="${k}" ${O}/>
      <path d="M38 88C38 84 48 83 60 84C70 85 75 88 71 90H40C38 90 38 89 38 88Z" fill="${k}" ${O}/>
      <path d="M36 80C28 66 32 44 45 36C52 32 60 34 62 42C66 54 69 70 63 82C57 90 42 90 36 80Z" fill="${k}" ${O}/>
      <path d="M51 44C59 46 63 60 61 74C59 82 51 84 49 76C47 64 47 52 51 44Z" fill="${l}"/>
      <ellipse cx="39" cy="75" rx="9.5" ry="11" fill="${k}" ${O}/>
      <path d="M51 61L50 53L55.5 58ZM58 58L61 51L62.5 59Z" fill="${k}" ${T}/><circle cx="56" cy="64" r="7" fill="${k}" ${T}/>${eye(58, 63, 2)}<circle cx="62.6" cy="65" r="1.1" fill="${INK}"/>
      <path d="M46 68Q55 73 65 66C65 74 63 82 57 84C51 85 47 80 46 68Z" fill="${l}" ${T}/>
      ${limb('M59 47Q67 51 66 57', 5, k)}
      <path d="M51.5 23L48 5L59.5 17Z" fill="${k}" ${O}/><path d="M52 18L50.4 10L56 15Z" fill="${PINK}"/>
      <path d="M47 30C45 20 55 14 63 16C71 18 81 24 83 29C83 34 76 36 68 36C58 37 49 36 47 30Z" fill="${k}" ${O}/>
      <path d="M58 19L62 3L66.5 18Z" fill="${k}" ${O}/>
      <ellipse cx="81.6" cy="28.6" rx="2.6" ry="2" fill="${INK}"/>${eye(63, 24, 3.5)}${blush(67, 30.5, 2.8)}${line('M74 32Q77 33.6 80 32', 1.6)}${shine(42, 50, 2.6, 6, 20)}`; },

    dinosaur: () => { const d = LILAC, s = '#9A7DF0', l = LAV;
      return `${shadow(38, 46)}<path d="M28 64C16 66 8 72 3 80C12 82 24 78 32 74Z" fill="${d}" ${O}/>${legs([28, 38, 54, 63], 70, 87, 11, d)}
      <path d="M54 56C58 42 62 28 70 18L80 22C74 32 70 46 68 64Z" fill="${d}" ${O}/>
      <ellipse cx="44" cy="63" rx="24" ry="15" fill="${d}" ${O}/><ellipse cx="44" cy="71" rx="15" ry="4.5" fill="${l}"/>
      <ellipse cx="79" cy="17" rx="12" ry="8.5" fill="${d}" ${O}/>
      ${[[36, 55, 3.2], [46, 53, 2.6], [28, 61, 2.4], [53, 58.5, 2], [66, 36, 2.2], [63.5, 46, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${s}"/>`).join('')}
      ${eye(79, 14, 3.1)}<circle cx="89" cy="14" r="1" fill="${INK}"/>${line('M83.5 20Q86.5 21.6 89.5 19', 1.6)}${blush(79.5, 21, 2.6)}${shine(32, 54, 6, 2.4, -12)}`; },

    dragon: () => { const b = MINT, l = '#E8FFF7';
      return `${shadow(30, 46)}<path d="M34 80C20 84 10 78 9 64C15 70 24 72 32 70Z" fill="${b}" ${O}/><path d="M9 65L3 55L15 59Z" fill="${PINK}" ${T}/>
      <path d="M44 54C36 40 24 28 8 24C12 32 12 38 10 44C16 42 20 46 20 52C25 50 29 54 30 60Z" fill="${LILAC}" ${O}/>${line('M42 52L12 28M40 55L21 50', 1.8, INK, 'opacity=".4"')}
      <path d="M31 58l-7-2 5-5ZM29 68l-7 1 4-6Z" fill="${PINK}" ${T}/>
      <ellipse cx="46" cy="66" rx="18" ry="19" fill="${b}" ${O}/><ellipse cx="52" cy="70" rx="10" ry="13" fill="${l}"/>${line('M45 63h13M44 70h16M45.5 77h13', 2, b)}
      <ellipse cx="40" cy="87" rx="8" ry="4.5" fill="${b}" ${O}/><ellipse cx="56" cy="87" rx="8" ry="4.5" fill="${b}" ${O}/>
      <path d="M50 25L47 12L57 21Z" fill="${GOLD}" ${O}/><path d="M61 22L64.5 9L70 22Z" fill="${GOLD}" ${O}/>
      <ellipse cx="58" cy="36" rx="17" ry="15" fill="${b}" ${O}/>
      <ellipse cx="72" cy="42" rx="10" ry="7.5" fill="#B8F2E2" ${O}/><circle cx="75" cy="39.5" r="1.2" fill="${INK}"/><circle cx="79" cy="40.5" r="1.2" fill="${INK}"/>
      ${line('M66 46.5Q71 49.5 76 47', 1.8)}
      <path d="M81 44C85 38 91 40 94 34C95 40 99 42 97 47C99 50 96 54 92 52C88 54 84 50 81 48Z" fill="${GOLD}" ${T}/><path d="M84 46C88 44 90 45 92 41C93 45 94 47 91 49C88 50 86 48 84 46Z" fill="#FF8A3C"/>
      ${limb('M57 60Q63 63 62 68', 5, b)}
      ${eye(57, 31, 4.6)}${blush(51, 41, 3.2)}${shine(48, 26, 5, 2.2)}`; },

    unicorn: uid => { const cols = ['#FF9BD0', '#B79BFF', '#8FD3FF'];
      return equine(uid, { body: '#FFFFFF', back: '#EFE6FF', hoof: '#C9B6F2', nose: '#FFB3DA',
        tail: S => `<path d="M52 108C24 100 14 126 22 148C30 168 22 182 34 186C40 170 50 160 46 140C58 152 66 140 60 120Z" fill="${cols[0]}" ${S}/><path d="M40 122C32 134 34 150 38 162" fill="none" stroke="${cols[1]}" stroke-width="6"/><path d="M50 128C46 140 48 150 50 156" fill="none" stroke="${cols[2]}" stroke-width="5"/>`,
        horn: `<path d="M184 44L204 2L208 50Z" fill="${GOLD}" stroke="${INK}" stroke-width="7.5"/><path d="M189 38L204 34M192 28L205 24M196 18L205 15" stroke="#E0A030" stroke-width="3"/>`,
        mane: S => [[170, 44, 15], [160, 60, 15], [154, 78, 14], [150, 96, 13], [176, 34, 11]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${cols[i % 3]}" ${S}/>`).join('') + `<path d="M182 40C190 36 194 44 188 52C184 58 176 54 178 48" fill="${cols[1]}" ${S}/>` });
    },

    horse: uid => { const c = '#B9763F', m = '#5E3A26';
      return equine(uid, { body: c, back: '#A5662F', hoof: '#5E3A26', nose: '#D9A27A', dy: 5.2, legs: 24,
        tail: S => `<path d="M52 108C24 100 14 126 22 148C30 168 22 182 34 186C40 170 50 160 46 140C58 152 66 140 60 120Z" fill="${m}" ${S}/>`,
        faceMarks: '<path d="M205 56C211 64 216 76 218 86L211 86C209 76 206 66 201 59Z" fill="#fff"/>',
        mane: S => `<path d="M178 44C160 46 148 64 144 88C142 102 144 112 150 120C154 106 156 94 161 84C166 70 176 60 188 52Z" fill="${m}" ${S}/><path d="M183 45C194 40 199 50 192 59C188 55 186 50 183 45Z" fill="${m}" ${S}/>` });
    },

    zebra: uid => { const w = '#FFFFFF', st = `stroke="${INK}" stroke-width="9" fill="none"`;
      return equine(uid, { body: w, back: '#EFE8FB', hoof: INK, nose: '#9A88B8', dy: 5.2, legs: 24,
        tail: S => `<path d="M50 112C36 116 30 132 32 152" fill="none" stroke="${INK}" stroke-width="13"/><path d="M50 112C36 116 30 132 32 152" fill="none" stroke="#fff" stroke-width="5"/><path d="M32 146C22 156 24 172 30 178C36 170 42 160 38 148Z" fill="${INK}" ${S}/>`,
        bodyMarks: `<path d="M64 86Q58 112 66 128M84 86Q78 116 86 138M104 86Q98 118 106 146M124 86Q118 118 126 146M144 86Q138 114 146 136M164 96Q158 112 166 124M70 160Q90 156 104 166M120 166Q136 156 154 162" ${st}/>`,
        legMarks: `<path d="M84 168h16M84 182h16M84 196h16M142 168h16M142 182h16M142 196h16M68 168h16M68 182h16M68 196h16M158 168h16M158 182h16M158 196h16" stroke="${INK}" stroke-width="6"/>`,
        neckMarks: `<path d="M150 104L184 112M154 88L192 100M160 74L196 88M168 62L198 76" ${st}/>`,
        faceMarks: `<path d="M182 60l8 6M186 52l8 6M212 56l-4 8M222 62l-6 6" stroke="${INK}" stroke-width="6"/>`,
        mane: S => `<path d="M178 46C164 48 154 64 148 86C146 94 144 104 146 112L156 108C160 92 166 76 178 64C182 60 186 56 190 54Z" fill="${INK}" ${S}/>${'<path d="M156 98l-9-2M160 84l-10-3M166 70l-10-4M175 58l-8-6" stroke="#fff" stroke-width="4"/>'}` });
    },

    butterfly: () => { const bd = '#9C7FE0';
      return `${mirror(`<path d="M48 48C40 24 18 12 9 22C2 32 12 52 47 56Z" fill="${PINK}" ${O}/><path d="M48 58C32 57 15 65 19 78C23 89 40 85 48 64Z" fill="${MINT}" ${O}/><circle cx="26" cy="33" r="6" fill="${GOLD}" ${T}/><circle cx="15.5" cy="27" r="2.4" fill="#fff"/><circle cx="31" cy="73" r="4.5" fill="#fff" ${T}/>${line('M47 29C44 20 40 16 35 15', 2.2)}<circle cx="35" cy="15" r="2.6" fill="${INK}"/>`)}
      <ellipse cx="50" cy="60" rx="5" ry="20" fill="${bd}" ${O}/><circle cx="50" cy="36" r="8.5" fill="${bd}" ${O}/>
      ${eyes(46.8, 53.2, 35, 2.4)}${mouth(50, 39.5, 1.8)}${shine(18, 33, 3.5, 2, -40)}`; },

    octopus: () => { const p = '#FF9BCB', A = ['M30 52C24 62 14 70 9 66', 'M36 58C34 70 28 80 22 82', 'M45 60C45 72 42 82 37 88', 'M55 60C55 72 58 82 63 88', 'M64 58C66 70 72 80 78 82', 'M70 52C76 62 86 70 91 66'];
      return `${A.map(d => line(d, 11)).join('')}${A.map(d => line(d, 6.4, p)).join('')}
      <path d="M24 50C22 24 36 10 50 10C64 10 78 24 76 50C76 58 64 62 50 62C36 62 24 58 24 50Z" fill="${p}" ${O}/>
      ${eyes(41, 59, 37, 5)}${mouth(50, 47, 4)}${blush(33, 45, 4)}${blush(67, 45, 4)}${shine(37, 20, 7, 3)}
      <circle cx="86" cy="22" r="4" fill="none" stroke="${SKY}" stroke-width="2.2"/><circle cx="92" cy="11" r="2.6" fill="none" stroke="${SKY}" stroke-width="2"/>`; },

    alligator: () => { const g = '#6CC06A', d = '#4E9E55';
      return `${shadow(46, 50, 88)}${limb('M23 74L19 86', 8, g)}${limb('M33 76L31 87', 8, g)}${limb('M56 76L58 87', 8, g)}${limb('M64 74L68 86', 8, g)}
      ${[[20, 67.5], [28, 64.5], [36, 62.5], [44, 61.5], [52, 61.5], [60, 62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${d}" ${T}/>`).join('')}
      <path d="M5 77C15 67 30 61 46 60C56 60 64 61 70 63L70 80C56 82 40 81 28 80C17 80 9 79 5 77Z" fill="${g}" ${O}/>
      <path d="M66 71L91 72C94 75 92 79 86 79L68 79Z" fill="${g}" ${O}/>
      <path d="M72 70l2 3.6 2-3.6ZM79 70l2 3.6 2-3.6ZM86 70l2 3.4 2-3.4Z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
      <path d="M62 60C68 52 78 51 83 56L96 64C98 67 96 70 92 70L66 70Z" fill="${g}" ${O}/>
      <circle cx="73" cy="53" r="6.5" fill="${g}" ${O}/>${eye(74, 52.5, 3.6)}<circle cx="93" cy="64" r="1.2" fill="${INK}"/>
      ${blush(77, 64, 3)}${shine(30, 66, 7, 2.2, -10)}`; },

    duck: () => { const w = '#FFFFFF', s = '#EFE8FB';
      return `<path d="M22 62L8 48L26 54Z" fill="${w}" ${O}/>
      <path d="M14 60C14 48 28 46 42 52C50 55 60 56 68 54C80 52 86 64 80 72C74 80 60 82 44 82C26 82 14 74 14 60Z" fill="${w}" ${O}/>
      <path d="M28 62C40 56 54 58 58 64C50 72 36 72 28 62Z" fill="${s}" ${T}/>
      <circle cx="66" cy="39" r="16" fill="${w}" ${O}/>
      <path d="M78 38C88 35 96 38 96 43C96 47 88 48 79 46Z" fill="#FFA23A" ${T}/>${line('M81 42.6h12', 1.4)}
      ${eye(68, 34, 3.8)}${blush(70, 44, 3)}${shine(58, 30, 5, 2.2)}
      <ellipse cx="50" cy="82" rx="46" ry="7.5" fill="${SKY}" opacity=".65"/>${line('M10 86q5-3 10 0t10 0M70 87q5-3 10 0t10 0', 2.2, '#5BB8E8')}`; },

    fish: uid => { const o = '#FFA24A', d = '#FF7F2A', B = 'M20 50C26 32 56 26 74 36C82 40 87 45 88 50C87 55 82 60 74 64C56 74 26 68 20 50Z', [id, cp] = clip(uid, `<path d="${B}"/>`);
      return `${cp}<path d="M26 50L7 33C4 44 4 56 7 67Z" fill="${d}" ${O}/><path d="M38 34C42 20 58 20 64 33Z" fill="${d}" ${O}/><path d="M46 66L42 78L57 68Z" fill="${d}" ${O}/>
      <path d="${B}" fill="${o}"/><g clip-path="url(#${id})">${line('M62 30C56 42 56 58 62 72', 9)}${line('M62 30C56 42 56 58 62 72', 5, '#fff')}</g><path d="${B}" fill="none" ${O}/>
      <path d="M46 50C40 52 38 58 42 61C47 59 49 55 46 50Z" fill="${d}" ${T}/>
      ${eye(73, 46, 4.6)}${line('M80 55Q83 57 86 54', 1.8)}${blush(72, 56, 3)}${shine(36, 40, 7, 2.4)}
      <circle cx="91" cy="31" r="3.2" fill="none" stroke="${SKY}" stroke-width="2"/><circle cx="95" cy="21" r="2" fill="none" stroke="${SKY}" stroke-width="1.8"/>`; },

    whale: () => { const b = '#6DB6EE', l = '#D4EEFF', B = 'M8 62C8 42 24 32 44 32C62 32 72 42 78 54C80 60 84 62 88 62C86 76 70 82 48 82C24 82 8 76 8 62Z';
      return `${limb('M72 66C84 62 88 50 88 38', 10, b)}<path d="M88 40C82 31 75 30 70 32C74 37 81 41 88 41ZM88 40C90 31 95 27 99 27C98 33 95 39 88 41Z" fill="${b}" ${O}/>
      <path d="${B}" fill="${b}"/><path d="M12 70C26 80 62 82 84 70C78 79 64 82 48 82C30 82 18 78 12 70Z" fill="${l}"/><path d="${B}" fill="none" ${O}/>
      <path d="M36 31C34 22 28 18 21 20C27 13 34 16 36 22C38 14 44 11 51 13C44 17 40 22 39 31Z" fill="${SKY}" ${T}/><circle cx="20" cy="27" r="2" fill="${SKY}"/><circle cx="52" cy="20" r="2" fill="${SKY}"/>
      ${eye(26, 52, 4.4)}${line('M16 62Q26 68 37 62', 2)}${blush(37, 56, 3.6)}${shine(30, 39, 7, 2.6, -15)}
      ${line('M4 88q6-4 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0', 2.6, '#5BB8E8')}`; },

    ant: () => { const a = '#D2654E';
      return `${shadow(38, 48)}${line('M43 62L33 70L25 86M47 64L46 76L41 87M51 63L59 72L63 87', 3.2)}
      ${line('M62 36C60 26 62 18 68 13M72 37C76 27 82 22 89 22', 2.4)}<circle cx="68" cy="13" r="2.8" fill="${a}" ${T}/><circle cx="89" cy="22" r="2.8" fill="${a}" ${T}/>
      <ellipse cx="25" cy="57" rx="17" ry="14" fill="${a}" ${O}/><ellipse cx="46" cy="59" rx="8.5" ry="7" fill="${a}" ${O}/>
      <circle cx="67" cy="47" r="14" fill="${a}" ${O}/>
      ${eyes(61.5, 73, 45, 3.8)}${mouth(67, 52.5, 2.8)}${blush(58, 51.5, 2.6)}${blush(77, 51.5, 2.6)}${shine(19, 50, 6, 2.6)}`; },

    chick: () => { const y = '#FFD84A', o = '#FF9F2E', FT = 'M44 79V87M40 90l4-3 4 3M44 87v3.6';
      return `${shadow(30)}${line(FT, 4.6)}${line(FT, 2.2, o)}<g transform="translate(12 0)">${line(FT, 4.6)}${line(FT, 2.2, o)}</g>
      <path d="M47 33C44 25 47 22 50 28C51 21 56 22 54 31Z" fill="${y}" ${O}/>
      <circle cx="50" cy="55" r="25" fill="${y}" ${O}/>
      <ellipse cx="27" cy="60" rx="5" ry="8.5" transform="rotate(25 27 60)" fill="${y}" ${O}/><ellipse cx="73" cy="60" rx="5" ry="8.5" transform="rotate(-25 73 60)" fill="${y}" ${O}/>
      <path d="M76 88L77.5 81L81 84L84.5 79L88 83L91 80C94 86 89 90 83 90C79 90 77 89.5 76 88Z" fill="${CREAM}" ${T}/>
      ${eyes(41.5, 58.5, 50, 4.3)}<path d="M45.5 57.5L50 54.5L54.5 57.5L50 62.5Z" fill="${o}" ${T}/>${line('M45.8 57.5h8.4', 1.4)}
      ${blush(35.5, 58, 3.6)}${blush(64.5, 58, 3.6)}${shine(38, 38, 6, 3)}`; },

    crab: () => { const r = '#FF7A62', l = '#FFB3A1';
      return `${shadow(34)}${mirror(['M29 64L17 66L11 76', 'M29 70L20 78L17 87', 'M33 75L27 84L26 90'].map(d => limb(d, 6, r)).join('') + limb('M33 54L22 40', 6.5, r)
        + `<path d="M12 36C8 26 14 18 22 20L19 27L28 28C29 36 18 41 12 36Z" fill="${r}" ${O}/>` + limb('M43 50V40', 4.8, r) + `<circle cx="43" cy="35.5" r="5.6" fill="#fff" ${T}/>` + eye(43.6, 35.6, 3.4))}
      <ellipse cx="50" cy="62" rx="26" ry="16" fill="${r}" ${O}/>
      ${mouth(50, 66, 4)}${blush(38, 64, 3.5)}${blush(62, 64, 3.5)}<circle cx="44" cy="54" r="1.6" fill="${l}"/><circle cx="56" cy="54" r="1.6" fill="${l}"/><circle cx="50" cy="52" r="1.6" fill="${l}"/>${shine(36, 54, 6, 2.4)}`; },
  });

  for (const [k, draw] of Object.entries(A)) P[k] = uid => `<g stroke-linejoin="round" stroke-linecap="round">${draw(uid)}</g>`;
})(typeof window !== 'undefined' ? window : globalThis);

// ======== pics-things ========
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

// ======== pics-objects ========
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

