// Grocery sections for Notes' Reminders (and Meals' deals and shopping list): "Milk" goes under Dairy & Eggs,
// "Chicken thighs" under Meat, in the order you'd walk a supermarket.
//
// Worked out on the phone from the words alone; nothing is sent anywhere.
// The last word usually names the thing ("chocolate milk" is milk, "chicken
// soup" is soup), so words are tried from the end; two-word names that break
// that rule ("peanut butter", "ice cream", "baking soda") are listed as
// phrases and tried first, and "frozen" or "canned" in front decides on its
// own. Anything it doesn't know goes under Other; choosing a section for an
// item teaches the list (see index.html, "grocery sections").
//
//   NotesAisles.SECTIONS            [{id, name}] in store order, Other last
//   NotesAisles.sectionOf(title, learned)   a section id
//   NotesAisles.key(title)          the normalised name learning is keyed on
//   NotesAisles.groceryName(name)   whether a list's name sounds like groceries
//
// Tested by notes/scripts/aisles-test.mjs.
(function (root) {
  'use strict';
  const S = [
    ['produce', 'Produce',
      'apple banana orange lemon lime grape grapefruit strawberry blueberry raspberry blackberry berry cranberry cherry peach nectarine plum pear apricot fig kiwi mango papaya pineapple melon watermelon cantaloupe honeydew pomegranate clementine mandarin tangerine satsuma coconut avocado tomato potato yam onion shallot leek garlic ginger carrot celery broccoli broccolini cauliflower spinach lettuce romaine kale arugula rocket chard cabbage sprout cucumber zucchini courgette squash pumpkin eggplant aubergine pepper jalapeno jalapeño chili chilli chile mushroom corn asparagus artichoke beet beetroot radish turnip parsnip fennel okra cilantro coriander parsley basil mint dill rosemary thyme sage chive scallion herb salad fruit veg veggie vegetable produce greens microgreens edamame plantain lemongrass tomatillo rhubarb tofu',
      ['sweet potato', 'green bean', 'green onion', 'spring onion', 'bell pepper', 'snap pea', 'snow pea', 'bok choy', 'brussels sprout', 'collard green', 'mixed green', 'salad mix', 'bagged salad', 'baby carrot', 'cherry tomato', 'grape tomato']],
    ['bakery', 'Bakery',
      'bread loaf baguette bagel bun roll croissant muffin tortilla pita naan flatbread brioche sourdough ciabatta focaccia cake cupcake donut doughnut pastry danish pie scone biscuit wrap rye challah',
      ['english muffin', 'hamburger bun', 'hot dog bun', 'dinner roll', 'sandwich bread', 'pizza dough', 'pie crust']],
    ['deli', 'Deli',
      'deli lunchable ham salami prosciutto pepperoni pastrami bologna hummus pate pâté guacamole',
      ['rotisserie chicken', 'lunch meat', 'sliced turkey', 'turkey slice', 'deli meat', 'cold cut', 'ham slice', 'sliced ham', 'roast beef', 'chicken salad', 'potato salad', 'pasta salad', 'egg salad']],
    ['meat', 'Meat',
      'chicken beef steak pork bacon sausage lamb turkey mince veal brisket rib ribeye sirloin chop tenderloin loin chuck meatball burger patty wing thigh drumstick breast chorizo venison duck goose meat bratwurst brat kielbasa',
      ['ground beef', 'ground turkey', 'ground pork', 'ground chicken', 'hot dog', 'chicken breast', 'chicken thigh', 'pork chop', 'short rib', 'flank steak']],
    ['seafood', 'Seafood',
      'fish salmon cod tilapia halibut trout haddock mahi snapper bass shrimp prawn crab lobster scallop mussel clam oyster calamari squid octopus anchovy sardine seafood sushi',
      ['tuna steak', 'fish fillet', 'crab leg', 'smoked salmon']],
    ['dairy', 'Dairy & Eggs',
      'milk egg butter cheese cheddar mozzarella parmesan parmigiano feta brie gouda swiss provolone ricotta mascarpone halloumi gruyere yogurt yoghurt cream creamer kefir margarine ghee buttermilk',
      ['sour cream', 'cream cheese', 'cottage cheese', 'half and half', 'heavy cream', 'whipping cream', 'whipped cream', 'string cheese', 'almond milk', 'oat milk', 'soy milk']],
    ['frozen', 'Frozen',
      'frozen popsicle sorbet gelato ice waffle pizza fry',
      ['ice cream', 'ice pop', 'ice cube', 'frozen pizza', 'tater tot', 'french fry', 'fish stick', 'frozen yogurt', 'frozen fruit', 'frozen vegetable', 'frozen pea', 'frozen corn', 'hash brown', 'mozzarella stick']],
    ['pantry', 'Pantry',
      'flour sugar salt yeast vanilla cinnamon paprika cumin oregano turmeric nutmeg cardamom clove spice seasoning bouillon cornstarch oil vinegar ketchup mustard mayo mayonnaise sriracha relish honey jam jelly syrup molasses nutella applesauce cereal oat oatmeal granola muesli pasta spaghetti penne macaroni lasagna noodle ramen rice quinoa couscous lentil bean chickpea soup broth stock sauce marinara pesto paste tuna olive pickle caper canned breadcrumb crouton date raisin tahini dressing flake',
      ['peanut butter', 'almond butter', 'baking soda', 'baking powder', 'brown sugar', 'powdered sugar', 'olive oil', 'vegetable oil', 'coconut oil', 'soy sauce', 'hot sauce', 'black pepper', 'pepper flake', 'red pepper flake', 'chili powder', 'garlic powder', 'onion powder', 'maple syrup', 'chocolate chip', 'coconut milk', 'tomato sauce', 'tomato paste', 'pasta sauce', 'bread crumb', 'black bean', 'kidney bean', 'pinto bean', 'refried bean', 'mac and cheese', 'dried fruit', 'cake mix', 'pancake mix', 'salt and pepper', 'apple sauce', 'corn starch', 'ground ginger', 'ground cinnamon', 'ground cumin', 'ground nutmeg', 'coconut flake', 'corn flake']],
    ['snacks', 'Snacks & Sweets',
      'chip crisp cracker pretzel popcorn nut almond cashew peanut pistachio walnut pecan cookie biscotti candy chocolate gum bar dip salsa snack jerky goldfish oreo seed marshmallow',
      ['trail mix', 'granola bar', 'protein bar', 'rice cake', 'fruit snack', 'tortilla chip', 'potato chip', 'pop tart']],
    ['drinks', 'Drinks',
      'water juice soda pop coke cola sprite seltzer lacroix beer wine prosecco champagne vodka gin rum tequila whiskey bourbon cider coffee espresso tea kombucha lemonade gatorade powerade drink smoothie',
      ['sparkling water', 'club soda', 'tonic water', 'energy drink', 'la croix', 'orange juice', 'apple juice', 'coconut water', 'coffee bean', 'coffee pod', 'k cup', 'tea bag']],
    ['household', 'Household',
      'towel tissue napkin foil detergent bleach cleaner sponge wipe battery bulb lightbulb candle softener pod trash garbage ziploc ziplock lighter match filter straw',
      ['paper towel', 'toilet paper', 'trash bag', 'garbage bag', 'bin bag', 'plastic wrap', 'cling film', 'aluminum foil', 'tin foil', 'parchment paper', 'dish soap', 'dishwasher pod', 'dishwasher tablet', 'laundry detergent', 'fabric softener', 'dryer sheet', 'light bulb', 'paper plate', 'paper cup', 'freezer bag', 'sandwich bag', 'storage bag', 'swiffer pad', 'scrub pad', 'kitchen roll', 'toilet roll', 'paper roll', 'air freshener']],
    ['personal', 'Personal Care',
      'shampoo conditioner toothpaste toothbrush floss mouthwash deodorant razor lotion sunscreen soap tampon pad ibuprofen tylenol advil aspirin acetaminophen vitamin medicine bandaid bandage plaster makeup mascara chapstick moisturizer cologne perfume solution',
      ['body wash', 'hand soap', 'shaving cream', 'contact solution', 'cotton ball', 'cotton swab', 'q tip', 'band aid', 'hand cream', 'face cream', 'eye cream', 'body lotion', 'hair gel', 'dry shampoo', 'face wash', 'lip balm', 'nail polish']],
    ['baby', 'Baby',
      'diaper nappy formula pacifier',
      ['baby wipe', 'baby food', 'diaper cream', 'baby formula']],
    ['pets', 'Pets',
      'litter kibble',
      ['dog food', 'cat food', 'dog treat', 'cat treat', 'cat litter', 'puppy pad', 'poop bag', 'pet food', 'fish food']],
  ];
  const SECTIONS = S.map(([id, name]) => ({ id, name })).concat([{ id: 'other', name: 'Other' }]);
  const NAMES = Object.fromEntries(SECTIONS.map(s => [s.id, s.name]));

  // The forms a word might be listed under: "berries" -> "berry", "cookies" ->
  // "cookie", "tomatoes" -> "tomato", "loaves" -> "loaf".
  const ODD = { loaves: 'loaf', halves: 'half', leaves: 'leaf', knives: 'knife', fries: 'fry', mice: 'mouse' };
  function forms(w) {
    const f = [w];
    if (ODD[w]) f.push(ODD[w]);
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) {
      f.push(w.slice(0, -1));
      if (/ies$/.test(w)) f.push(w.slice(0, -3) + 'y');
      if (/(oes|ches|shes|sses|xes)$/.test(w)) f.push(w.slice(0, -2));
    }
    return f;
  }
  const single = w => ODD[w] || (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.replace(/ies$/, 'y').replace(/(o|ch|sh|x)es$/, '$1').replace(/s$/, '') : w);
  const UNITS = new Set('lb lbs pound pounds oz ounce ounces kg g gram grams ml l litre liter litres liters gal gallon gallons qt quart quarts pt pint pints pack packs pk ct count dozen doz bag bags box boxes bottle bottles jar jars bunch bunches tub tubs carton cartons packet packets tin tins of a an some the few more extra fresh organic large small medium big little whole chopped diced boneless skinless lean low fat free reduced'.split(' '));
  const QTY = /^(\d+([./]\d+)?|\d+x|x\d+|\d+(\.\d+)?(lb|lbs|oz|kg|g|ml|l|pk|ct|gal|qt|pt))$/;

  // The words that name the item: lowercase, no quantities, notes or brackets.
  function words(title) {
    const t = String(title || '').toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\s+(for|from|at)\s+.*$/, ' ')               // "chicken for tacos"
      .replace(/\s[-–—:]\s.*$/, ' ')                        // "milk - the green one"
      .replace(/[’']/g, '').replace(/&/g, ' and ')
      .replace(/[^a-z0-9ñéè.\/\s-]/g, ' ').replace(/-/g, ' ');
    return t.split(/\s+/).map(w => w.replace(/^[./]+|[./]+$/g, '')).filter(w => w && !QTY.test(w));
  }
  // Learning ignores sizes and words like "organic" too ("2 lbs organic carrots" is "carrot").
  const key = title => words(title).filter(w => !UNITS.has(w)).map(single).join(' ').replace(/^and\s+|\s+and$/g, '');

  const WORD = new Map(), ENDS = new Map();
  for (const [id, , ws, ps] of S) {
    for (const w of ws.split(/\s+/)) if (!WORD.has(w)) WORD.set(w, id);
    for (const p of ps) { const pw = p.split(' '), last = pw[pw.length - 1]; if (!ENDS.has(last)) ENDS.set(last, []); ENDS.get(last).push([pw, id]); }
  }
  for (const list of ENDS.values()) list.sort((a, b) => b[0].length - a[0].length);   // "red pepper flake" before "pepper flake"

  function sectionOf(title, learned) {
    const k = key(title);
    if (!k) return 'other';
    if (learned && Object.prototype.hasOwnProperty.call(learned, k) && NAMES[learned[k]]) return learned[k];
    const ws = words(title), fs = ws.map(forms);
    if (ws.includes('frozen')) return 'frozen';
    if (ws.includes('canned')) return 'pantry';
    const is = (i, w) => fs[i].includes(w);
    // From the last word back: a phrase ending here, else the word itself.
    for (let i = ws.length - 1; i >= 0; i--) {
      for (const f of fs[i]) for (const [pw, id] of ENDS.get(f) || []) {
        const at = i - pw.length + 1;
        if (at >= 0 && pw.every((w, j) => is(at + j, w))) return id;
      }
      for (const f of fs[i]) if (WORD.has(f)) return WORD.get(f);
    }
    return 'other';
  }

  const groceryName = name => /\b(grocer(y|ies)|shopping|supermarket|food shop|costco|trader joe|whole foods|aldi|safeway|kroger|publix|wegmans|tesco|sainsbury)/i.test(String(name || ''));

  root.NotesAisles = { SECTIONS, NAMES, sectionOf, key, groceryName };
})(typeof window !== 'undefined' ? window : globalThis);
