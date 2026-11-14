// Pearl's app drawings: one light line per app, as few strokes as the idea needs, on a 24 x 24 grid.
// make-looks.mjs draws every Pearl icon from these: each app's Home Screen icon (<app>/icon-layers.svg and its pngs:
// the line in light on the dark ground, with the app's coloured dot), its pebble everywhere else in aOS and its own
// screens (<app>/icon-pebble.svg), and aOS Home's grid (aOS/glyphs.js). Pearl's id is 'layers', the look it replaced.
// Change a drawing here and run node aOS/scripts/make-looks.mjs.
export const LINES = {
  mail: '<rect x="4" y="6.5" width="16" height="11" rx="3"/><path d="M5.5 8.5 12 13l6.5-4.5"/>',
  calendar: '<rect x="4" y="6" width="16" height="14" rx="3.5"/><path d="M4.5 10.5h15M8.5 4v3.5M15.5 4v3.5"/>',
  weather: '<path d="M7.5 18h9.2a3.4 3.4 0 0 0 .3-6.8A5.2 5.2 0 0 0 7 10.6 3.7 3.7 0 0 0 7.5 18z"/>',
  house: '<path d="M5 11.2 12 5l7 6.2V18a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18z"/>',
  clock: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4l2.8 1.8"/>',
  drinks: '<path d="M8 4.5h8l-.6 4.8a3.4 3.4 0 0 1-6.8 0zM12 12.8v6.2M9 19h6"/>',
  fitness: '<path d="M7 8.5v7M17 8.5v7M4.5 10.5v3M19.5 10.5v3M7 12h10"/>',
  improve: '<path d="M8 16.5h8a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4zM8 16.5 6.5 19.5M12 14V9.2M9.8 11.2 12 9l2.2 2.2"/>',
  meals: '<path d="M4.5 12h15a7.5 6.5 0 0 1-15 0zM10 5.5c-.8.9.8 1.6 0 2.5M14 5.5c-.8.9.8 1.6 0 2.5"/>',
  money: '<circle cx="12" cy="12" r="7.5"/><path d="M14.2 9.8c-.4-.9-1.2-1.3-2.2-1.3-1.3 0-2.2.7-2.2 1.7 0 2.3 4.4 1.3 4.4 3.6 0 1-.9 1.7-2.2 1.7-1 0-1.8-.4-2.2-1.3M12 7.2v1.3M12 15.5v1.3"/>',
  news: '<rect x="4.5" y="5" width="15" height="14" rx="3"/><path d="M8 9.5h8M8 13h8M8 16.5h4.5"/>',
  notes: '<path d="M6 7.5h12M6 12h12M6 16.5h7"/>',
  orders: '<path d="M4.5 8.2 12 4.5l7.5 3.7v7.6L12 19.5l-7.5-3.7zM4.5 8.2 12 12l7.5-3.8M12 12v7.5"/>',
  places: '<path d="M12 19.8s5.8-5.2 5.8-9.6a5.8 5.8 0 0 0-11.6 0c0 4.4 5.8 9.6 5.8 9.6z"/><circle cx="12" cy="10.2" r="2"/>',
  podcasts: '<circle cx="12" cy="11" r="1.6"/><path d="M8.6 14.6a4.8 4.8 0 1 1 6.8 0M6.2 17a8.2 8.2 0 1 1 11.6 0M12 14.5V20"/>',
  school: '<path d="M5.5 18.5 6.6 14.6 15.4 5.8a1.9 1.9 0 0 1 2.8 2.8L9.4 17.4zM14 7.2l2.8 2.8"/>',
  sparkle: '<path d="M12 4.5c.6 3.9 3.1 6.4 7 7-3.9.6-6.4 3.1-7 7-.6-3.9-3.1-6.4-7-7 3.9-.6 6.4-3.1 7-7z"/>',
  travel: '<path d="M19.5 4.5 4.5 11l5.8 2.2L19.5 4.5l-6 15-3.2-6.3"/>',
};

// The night ground of every Pearl icon: near-black blue, a little lighter low down, as the screens are
export const GROUND = [['0', '#0B1A37'], ['.5', '#050C1D'], ['1', '#01030A']];
