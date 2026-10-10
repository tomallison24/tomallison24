// Tests the grocery sections (home/aisles.js) on everyday shopping-list
// items, written the way people type them.
//   node notes/scripts/aisles-test.mjs
import '../../home/aisles.js';
const { sectionOf, key, groceryName, SECTIONS } = globalThis.NotesAisles;

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; if (!cond || process.env.VERBOSE) console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };

const CASES = {
  produce: ['Bananas', 'apples', 'Avocados x3', 'Lemons', 'limes', 'Strawberries', 'blueberries', 'Tomatoes', 'cherry tomatoes', 'Potatoes', 'sweet potatoes', 'Onions', 'red onion', 'Garlic', 'Ginger', 'Carrots', 'Celery', 'Broccoli', 'Spinach', 'Romaine lettuce', 'Cucumber', 'Zucchini', 'Bell peppers', 'Jalapeños', 'Mushrooms', 'Green beans', 'Cilantro', 'green onions', 'Salad mix', 'Grapes', 'Watermelon', 'Fresh basil', 'Kale', 'Corn on the cob'],
  bakery: ['Bread', 'Sourdough loaf', 'Bagels', 'Hamburger buns', 'Hot dog buns', 'Tortillas', 'Flour tortillas', 'English muffins', 'Croissants', 'Pita bread', 'Birthday cake', 'Garlic bread', 'Sandwich bread'],
  deli: ['Ham', 'Sliced turkey', 'Salami', 'Hummus', 'Rotisserie chicken', 'Deli meat', 'Prosciutto', 'Potato salad'],
  meat: ['Chicken breasts', 'Chicken thighs', 'Ground beef', '1 lb ground turkey', 'Bacon', 'Pork chops', 'Steak', 'Sausages', 'Hot dogs', 'Lamb', 'Chicken wings', 'Ribeye', 'Burgers', 'Meatballs', 'Chicken for tacos'],
  seafood: ['Salmon', 'Shrimp', 'Cod fillets', 'Tilapia', 'Scallops', 'Crab legs', 'Smoked salmon', 'Mussels'],
  dairy: ['Milk', '2% milk', 'Whole milk', 'Oat milk', 'Eggs', 'a dozen eggs', '6x eggs', 'Butter', 'Cheddar cheese', 'Shredded mozzarella', 'Parmesan', 'Greek yogurt', 'Strawberry yogurt', 'Sour cream', 'Cream cheese', 'Heavy cream', 'Half & half', 'Coffee creamer', 'Cottage cheese', 'String cheese', 'Chocolate milk'],
  frozen: ['Ice cream', 'Frozen peas', 'Frozen pizza', 'Frozen berries', 'Waffles', 'Popsicles', 'Tater tots', 'French fries', 'Ice', 'Bag of ice', 'Sweet potato fries'],
  pantry: ['Flour', 'Sugar', 'Brown sugar', 'Salt', 'Black pepper', 'Salt and pepper', 'Olive oil', 'Vegetable oil', 'Vinegar', 'Ketchup', 'Mustard', 'Mayo', 'Peanut butter', 'Honey', 'Strawberry jam', 'Maple syrup', 'Cereal', 'Oats', 'Oatmeal', 'Pasta', 'Spaghetti', 'Rice', 'Brown rice', 'Black beans', 'Canned tomatoes', 'Chickpeas', 'Chicken broth', 'Chicken stock', 'Tomato soup', 'Chicken noodle soup', 'Pasta sauce', 'Marinara', 'Soy sauce', 'Baking soda', 'Baking powder', 'Vanilla extract', 'Cinnamon', 'Tuna', 'Olives', 'Chocolate chips', 'Coconut milk', 'Bread crumbs', 'Mac and cheese', 'Taco seasoning', 'Cake mix', 'Lentils', 'Applesauce'],
  snacks: ['Chips', 'Tortilla chips', 'Potato chips', 'Crackers', 'Pretzels', 'Popcorn', 'Almonds', 'Cookies', 'Chocolate chip cookies', 'Oreos', 'Granola bars', 'Candy', 'Dark chocolate', 'Trail mix', 'Salsa', 'Gum', 'Peanut butter cookies', 'Goldfish'],
  drinks: ['Water', 'Sparkling water', 'Orange juice', 'Apple juice', 'Coke', 'Diet coke', 'La Croix', 'Seltzer', 'Beer', 'Red wine', 'Coffee', 'Ground coffee', 'Coffee beans', 'Tea', 'Green tea bags', 'Kombucha', 'Lemonade', 'Gatorade', 'Club soda', 'Coconut water'],
  household: ['Paper towels', 'Toilet paper', 'Tissues', 'Napkins', 'Trash bags', 'Aluminum foil', 'Plastic wrap', 'Ziploc bags', 'Sandwich bags', 'Dish soap', 'Dishwasher pods', 'Laundry detergent', 'Bleach', 'Sponges', 'Clorox wipes', 'Batteries', 'Light bulbs', 'Coffee filters', 'Candles', 'Paper plates'],
  personal: ['Shampoo', 'Conditioner', 'Toothpaste', 'Toothbrush', 'Floss', 'Deodorant', 'Razors', 'Shaving cream', 'Sunscreen', 'Hand soap', 'Body wash', 'Lotion', 'Tampons', 'Ibuprofen', 'Tylenol', 'Vitamins', 'Band-aids', 'Q-tips', 'Mouthwash', 'Hand cream'],
  baby: ['Diapers', 'Baby wipes', 'Formula', 'Baby food'],
  pets: ['Dog food', 'Cat food', 'Cat litter', 'Dog treats'],
  other: ['Birthday card', 'Stamps', 'Gift for Sofia'],
};
const wrong = [];
for (const [want, items] of Object.entries(CASES)) for (const t of items) {
  const got = sectionOf(t);
  ok(`"${t}" → ${want}`, got === want, got);
  if (got !== want) wrong.push(`${t}: ${got}`);
}
const total = Object.values(CASES).flat().length;
console.log(`${total - wrong.length}/${total} everyday items in the right section`);

// Learning: what you chose for a name wins next time, however it's typed.
ok('learned: "Corn tortillas" moved to Pantry stays there', sectionOf('corn tortillas', { [key('Corn tortillas')]: 'pantry' }) === 'pantry');
ok('learned key ignores quantity, case, plural and notes', key('2 lbs Corn Tortillas (the yellow ones)') === key('corn tortilla'));
ok('learned: an unknown section id is ignored', sectionOf('Milk', { milk: 'nowhere' }) === 'dairy');
ok('empty or quantity-only: Other', sectionOf('') === 'other' && sectionOf('2x') === 'other');
ok('sections in store order, Other last', SECTIONS[0].id === 'produce' && SECTIONS.at(-1).id === 'other' && new Set(SECTIONS.map(s => s.id)).size === SECTIONS.length);
ok('grocery list names', groceryName('Groceries') && groceryName('Grocery') && groceryName('Shopping list') && groceryName('Costco run') && !groceryName('Home') && !groceryName('Family'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
