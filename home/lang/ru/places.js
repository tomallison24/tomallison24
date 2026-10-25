// Russian for Places (places/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
// What kind of place it is (parse.js, KINDS): ours, so translated wherever it shows
const KIND = {
  'Restaurant': 'Ресторан', 'Fast food': 'Фастфуд', 'Café': 'Кафе', 'Bar': 'Бар', 'Pub': 'Паб', 'Beer garden': 'Пивной сад', 'Ice cream': 'Мороженое',
  'Bakery': 'Пекарня', 'Food court': 'Фуд-корт', 'Nightclub': 'Ночной клуб', 'Brewery': 'Пивоварня', 'Winery': 'Винодельня', 'Wine shop': 'Винный магазин',
  'Museum': 'Музей', 'Gallery': 'Галерея', 'Arts center': 'Арт-центр', 'Theater': 'Театр', 'Cinema': 'Кинотеатр', 'Music venue': 'Концертная площадка',
  'Concert hall': 'Концертный зал', 'Stadium': 'Стадион', 'Attraction': 'Достопримечательность', 'Viewpoint': 'Смотровая площадка', 'Zoo': 'Зоопарк',
  'Aquarium': 'Аквариум', 'Theme park': 'Парк развлечений', 'Park': 'Парк', 'Garden': 'Сад', 'Nature reserve': 'Заповедник', 'Beach': 'Пляж', 'Peak': 'Вершина',
  'Trail': 'Тропа', 'Campsite': 'Кемпинг', 'Playground': 'Детская площадка', 'Hotel': 'Отель', 'Motel': 'Мотель', 'Guest house': 'Гостевой дом', 'Hostel': 'Хостел',
  'Supermarket': 'Супермаркет', 'Mall': 'Торговый центр', 'Department store': 'Универмаг', 'Clothes shop': 'Магазин одежды', 'Bookshop': 'Книжный магазин',
  'Market': 'Рынок', 'Spa': 'Спа', 'Gym': 'Спортзал', 'Sports center': 'Спортивный центр', 'Golf course': 'Поле для гольфа', 'Library': 'Библиотека',
  'Place of worship': 'Храм', 'Castle': 'Замок', 'Monument': 'Памятник', 'Memorial': 'Мемориал', 'Historic site': 'Историческое место', 'City': 'Город',
  'Town': 'Город', 'Village': 'Деревня', 'Island': 'Остров', 'Shop': 'Магазин',
};
// A line joined with " · " (a kind, a city, how far): the kind and "here" translated, the rest (the place's) left as it is
const ATOM = Object.assign({ 'here': 'здесь', 'Today': 'Сегодня' }, KIND);
const joined = s => s.split(' · ').map(p => ATOM[p] || p).join(' · ');
// Opening hours as parse.js writes them ("Mon–Fri 8 AM–5 PM", one line a part): Russian days and a 24-hour clock
const DAY = { Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб', Sun: 'Вс', Holidays: 'Праздники' };
const D = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Holidays)';
const hours = s => s
  .replace(new RegExp('(AM|PM|closed|\\d) (?=' + D + '\\b)', 'g'), '$1\n')        // each part on its own line again
  .replace(/(\d{1,2})(?::(\d\d))? (AM|PM)/g, (_, h, m, ap) => ((+h % 12) + (ap === 'PM' ? 12 : 0)) + ':' + (m || '00'))
  .replace(new RegExp('\\b' + D + '\\b', 'g'), d => DAY[d])
  .replace(/\bclosed\b/g, 'выходной').replace(/Open 24 hours/g, 'Круглосуточно');
const list = s => (s === 'Been' ? '«Уже были»' : '«Хочу сходить»');

aosLang.add(Object.assign({
  // the page
  'Places': 'Места',
  'Which list': 'Какой список',
  'Want to go': 'Хочу сходить',
  'Been': 'Уже были',
  'Settings': 'Настройки',
  'Design': 'Дизайн',
  'Show the map': 'Показать карту',
  'Show the list': 'Показать список',
  'Search your places and businesses': 'Поиск по местам и заведениям',
  'Search businesses here': 'Искать заведения здесь',
  'Sort and filter': 'Сортировка и фильтр',
  'Soonest': 'Ближайшие по дате',
  'Nearest': 'Рядом',
  'Newest': 'Новые',
  'Recent': 'Недавние',
  'Top rated': 'Лучшие',
  'Coming up': 'Скоро',
  'Someday': 'Когда-нибудь',
  'Date passed': 'Дата прошла',
  '🍽️ Food & drink': '🍽️ Еда',
  '🎭 Things to do': '🎭 Досуг',
  '🛍️ Shops': '🛍️ Магазины',
  'Nothing matches': 'Ничего не найдено',
  'Nowhere yet': 'Пока пусто',
  'Nothing rated yet': 'Оценок пока нет',
  'Try another word or tag.': 'Попробуйте другое слово или тег.',
  'Tap + to add one.': 'Нажмите +, чтобы добавить.',
  'Open a place and tap Been.': 'Откройте место и нажмите «Уже были».',
  'None of your places match.': 'Среди ваших мест совпадений нет.',
  'Businesses': 'Заведения',
  'Businesses, nearest first': 'Заведения, сначала ближайшие',
  'Untitled': 'Без названия',
  'here': 'здесь',
  'Today': 'Сегодня',
  'Undo': 'Отменить',
  'Close': 'Закрыть',
  'Cancel': 'Отмена',
  'Save': 'Сохранить',
  'Add': 'Добавить',

  // the map
  'Show where I am': 'Показать, где я',
  'Show all places': 'Показать все места',
  'Zoom in to see businesses': 'Приблизьте, чтобы увидеть заведения',
  'Loading businesses…': 'Загрузка заведений…',
  'Couldn’t load businesses right now': 'Сейчас не удалось загрузить заведения',
  'Directions': 'Маршрут',
  'Location isn’t available here.': 'Геопозиция здесь недоступна.',
  'Location is off for Places. Allow it in Settings → Privacy → Location Services.': 'Геопозиция для Мест выключена. Разрешите её: Настройки → Конфиденциальность → Службы геолокации.',
  'Couldn’t find where you are.': 'Не удалось определить, где вы.',

  // adding
  'Add a place': 'Добавить место',
  'Name, type or address': 'Название, тип или адрес',
  'Search for a place': 'Найти место',
  'Add where I am': 'Добавить, где я',
  'Paste a map link': 'Вставить ссылку на карту',
  'In Maps: Share, then Copy': 'В Картах: Поделиться, затем Скопировать',
  'Type it in': 'Ввести вручную',
  'Touch and hold, then Paste the link here': 'Нажмите и удерживайте, затем вставьте ссылку',
  'Map link': 'Ссылка на карту',
  'No matches on OpenStreetMap. Try fewer words, or add it by hand.': 'В OpenStreetMap ничего не найдено. Попробуйте меньше слов или добавьте вручную.',
  'Search isn’t reachable right now. Check your connection.': 'Поиск сейчас недоступен. Проверьте подключение.',
  'That doesn’t look like a map link.': 'Это не похоже на ссылку на карту.',
  'That’s a short link, which Places can’t open. Search for the place by name instead.': 'Это короткая ссылка, Места не могут её открыть. Найдите место по названию.',

  // a place
  'Place': 'Место',
  'New place': 'Новое место',
  'Name': 'Название',
  'Want to go or been': 'Хочу сходить или уже были',
  'Your rating': 'Ваша оценка',
  'Rating': 'Оценка',
  'Price': 'Цена',
  'Planned for': 'Запланировано на',
  'Went on': 'Дата визита',
  'Date': 'Дата',
  'Clear': 'Очистить',
  'Went again today': 'Снова были сегодня',
  '📅 Added from the Family calendar.': '📅 Добавлено из Семейного календаря.',
  'Notes and tags': 'Заметки и теги',
  'Notes': 'Заметки',
  'What to order, who recommended it… Add #tags like #brunch': 'Что заказать, кто посоветовал… Добавьте #теги, например #бранч',
  'From OpenStreetMap': 'Из OpenStreetMap',
  'Open in Apple Maps': 'Открыть в Apple Картах',
  'Delete place': 'Удалить место',
  'Pinned on the map': 'Отмечено на карте',
  'No map pin': 'Нет метки на карте',
  'Looking it up…': 'Ищем…',
  'No hours, phone or website.': 'Нет часов работы, телефона и сайта.',
  'Open 24 hours': 'Круглосуточно',
  'Give it a name first.': 'Сначала дайте название.',
  'Deleted place': 'Место удалено',
  'This phone couldn’t save: storage is full.': 'Не удалось сохранить: память телефона заполнена.',

  // the family's Sheet
  'aOS’s phrase for the Notes Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.': 'Фраза aOS для таблицы Заметок больше не совпадает со скриптом. Владелец обновляет её в aOS: Профиль → Google Таблицы.',
  'The Notes Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).': 'В таблице Заметок старый скрипт. Владелец вставляет новый и разворачивает новую версию (aOS/SHEETS.md).',
  'The Notes Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.': 'В скрипте таблицы Заметок всё ещё SECRET = ‘CHANGE-ME’. Владелец меняет его и разворачивает новую версию.',
  'The Sheet was busy. Trying again shortly.': 'Таблица занята. Скоро повторим.',
  'Couldn’t reach the Sheet. Trying again later.': 'Не удалось связаться с таблицей. Повторим позже.',
  'The Sheet didn’t answer as expected. Trying again later.': 'Таблица ответила не так, как ожидалось. Повторим позже.',
  'Sync didn’t work. Trying again later.': 'Синхронизация не удалась. Повторим позже.',
  'Synced': 'Синхронизировано',
  'Syncing…': 'Синхронизация…',
  'Not synced': 'Не синхронизировано',
}, KIND), [
  // the title's line: "12 places · Synced"
  [/^(\d+) places?( · (Synced|Syncing…|Not synced))?$/, m => m[1] + ' ' + aosLang.plural(m[1], 'место', 'места', 'мест') + (m[2] ? ' · ' + ({ Synced: 'Синхронизировано', 'Syncing…': 'Синхронизация…', 'Not synced': 'Не синхронизировано' })[m[3]] : '')],
  // stars
  [/^(\d) out of 5 stars$/, m => m[1] + ' из 5 звёзд'],
  [/^(\d) stars?$/, m => m[1] + ' ' + aosLang.plural(m[1], 'звезда', 'звезды', 'звёзд')],
  // visits
  [/^Been (\d+) times\. Before that: (.+)\.$/, m => 'Были ' + m[1] + ' ' + aosLang.plural(m[1], 'раз', 'раза', 'раз') + '. До этого: ' + m[2].split(', ').map(x => ATOM[x] || x).join(', ') + '.'],
  // toasts
  [/^Already in (Been|Want to go)$/, m => 'Уже в списке ' + list(m[1])],
  [/^Added to (Been|Want to go)$/, m => 'Добавлено в ' + list(m[1])],
  [/^Moved to (Been|Want to go)$/, m => 'Перенесено в ' + list(m[1])],
  [/^Deleted (.+)$/, m => 'Удалено: ' + m[1]],
  // opening hours (the place's sheet, a business's card on the map)
  [new RegExp('^(🕒 )?(?=.*\\b(?:AM|PM|' + D.slice(3, -1) + ')\\b)(?:' + D + '|\\d)'), m => hours(m.input)],
  // last: a line joined with " · "
  [/^.+ · .+$/, m => joined(m[0])],
]);
})();
