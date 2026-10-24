// Russian for Travel (travel/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
const pl = (n, one, few, many) => n + ' ' + aosLang.plural(n, one, few, many);
// "2 flights", "1 new booking", "3 emails": the app's plural() words
const NOUN = {
  'new booking': ['новая бронь', 'новые брони', 'новых броней'], 'rental car': ['прокат авто', 'проката авто', 'прокатов авто'],
  flight: ['рейс', 'рейса', 'рейсов'], hotel: ['отель', 'отеля', 'отелей'], car: ['машина', 'машины', 'машин'], ride: ['поездка на такси', 'поездки на такси', 'поездок на такси'],
  booking: ['бронь', 'брони', 'броней'], update: ['обновление', 'обновления', 'обновлений'], cancellation: ['отмена', 'отмены', 'отмен'],
  email: ['письмо', 'письма', 'писем'], trip: ['поездка', 'поездки', 'поездок'], detail: ['деталь', 'детали', 'деталей'], lookup: ['запрос', 'запроса', 'запросов'],
  night: ['ночь', 'ночи', 'ночей'],
};
const NOUNS = '(new booking|rental car|flight|hotel|car|ride|booking|update|cancellation|email|trip|detail|lookup|night)s?';
const N1 = new RegExp('^(\\d+) ' + NOUNS + '$');
const count = s => { const m = N1.exec(s); return m ? pl(m[1], ...NOUN[m[2]]) : s; };
const counts = s => s.split(', ').map(count).join(', ');
// "in 5 min", "in 3 h 20 min", "tomorrow", "in 4 days"; "just now", "5 min ago", "3 h ago", "2 days ago"
function when(s) {
  let m;
  if (s === 'tomorrow') return 'завтра';
  if (s === 'just now') return 'только что';
  if ((m = /^in (\d+) min$/.exec(s))) return 'через ' + m[1] + ' мин';
  if ((m = /^in (\d+) h(?: (\d+) min)?$/.exec(s))) return 'через ' + m[1] + ' ч' + (m[2] ? ' ' + m[2] + ' мин' : '');
  if ((m = /^in (\d+) days$/.exec(s))) return 'через ' + pl(m[1], 'день', 'дня', 'дней');
  if ((m = /^(\d+) min ago$/.exec(s))) return m[1] + ' мин назад';
  if ((m = /^(\d+) h ago$/.exec(s))) return m[1] + ' ч назад';
  if ((m = /^(\d+) days ago$/.exec(s))) return pl(m[1], 'день', 'дня', 'дней') + ' назад';
  return null;
}
const WHEN = /^(tomorrow|just now|in \d+ (?:min|h(?: \d+ min)?|days)|\d+ (?:min|h|days) ago)$/;
// One part of a line joined with " · " or " → ": ours is translated, the family's (a place, a code) is left as it is.
const ATOM = {
  'Now': 'Сейчас', 'Next': 'Далее', 'Synced': 'Синхронизировано', 'Not synced': 'Не синхронизировано', 'Syncing…': 'Синхронизация…', 'Offline': 'Нет сети',
  'Reading Gmail…': 'Читаем Gmail…', 'From anywhere': 'Откуда угодно', 'anywhere': 'куда угодно', 'any dates': 'любые даты',
};
function atom(s) {
  let m;
  if (ATOM[s]) return ATOM[s];
  const w = when(s); if (w) return w;
  if (N1.test(s)) return count(s);
  if ((m = /^(\d+) trips? coming up$/.exec(s))) return pl(m[1], 'поездка', 'поездки', 'поездок') + ' впереди';
  if ((m = /^Gmail checked (.+)$/.exec(s))) return 'Gmail проверен ' + (when(m[1]) || m[1]);
  if ((m = /^Terminal (.+)$/.exec(s))) return 'Терминал ' + m[1];
  if ((m = /^Gate (.+)$/.exec(s))) return 'Выход ' + m[1];
  if ((m = /^Seat (.+)$/.exec(s))) return 'Место ' + m[1];
  if ((m = /^Conf\. (.+)$/.exec(s))) return 'Бронь ' + m[1];
  if ((m = /^lands (.+)$/.exec(s))) return 'посадка ' + m[1];
  if ((m = /^Bags: belt (.+)$/.exec(s))) return 'Багаж: лента ' + m[1];
  if ((m = /^from (\d.*)$/.exec(s))) return 'с ' + m[1];
  return s;
}
const joined = s => s.split(' · ').map(p => p.split(' → ').map(atom).join(' → ')).join(' · ');
// Ipsy's toasts are a few sentences one after another
const SENT = [
  [/^Ipsy filled in (\d+) details?\. They’re marked to check\.\s*/, m => 'Дополнено деталей: ' + m[1] + '. Они отмечены «На проверку».'],
  [/^Ipsy read the email\. It doesn’t say anything more\.\s*/, () => 'Письмо прочитано: больше в нём ничего нет.'],
  [/^The email doesn’t state what’s missing, so Ipsy has nothing to read\. Your calendar, or you, can add it\.\s*/, () => 'В письме нет того, чего не хватает, и Ипси нечего читать. Добавить это можете вы или календарь.'],
  [/^(\d+) bookings? didn’t come from an email\.\s*/, m => 'Не из писем: ' + pl(m[1], 'бронь', 'брони', 'броней') + '.'],
  [/^Ipsy updated (\d+) bookings?(?: \((\d+) cancelled\))?\. Marked Check\.\s*/, m => 'Обновлено броней: ' + m[1] + (m[2] ? ' (отменено: ' + m[2] + ')' : '') + '. Отмечено «На проверку».'],
  [/^Ipsy read (\d+) emails?\. Everything matches\.\s*/, m => 'Прочитано писем: ' + m[1] + '. Всё совпадает.'],
  [/^That’s enough AI for today\. Try again tomorrow\.\s*/, () => 'Лимит ИИ на сегодня исчерпан. Повторите завтра.'],
  [/^Sign in with Face ID in aOS to use Ipsy\.\s*/, () => 'Войдите в aOS с Face ID, чтобы пользоваться Ипси.'],
  [/^Couldn’t reach Ipsy\. Try again in a moment\.\s*/, () => 'Не удалось связаться с Ипси. Повторите чуть позже.'],
  [/^Ipsy couldn’t read the emails just now\.\s*/, () => 'Ипси сейчас не может прочитать письма.'],
  [/^(\d+) bookings? you edited stays? as you typed\.\s*/, m => 'Изменённые вами брони (' + m[1] + ') остаются как есть.'],
];
function sentences(s) {
  const out = [];
  for (let rest = s; rest;) {
    const hit = SENT.find(([re]) => re.test(rest));
    if (!hit) return s;
    const m = hit[0].exec(rest); out.push(hit[1](m)); rest = rest.slice(m[0].length);
  }
  return out.join(' ');
}
// "the date from your calendar; the hotel by AI from the email"
const FILL = {
  'the date': 'дата', 'the flight number': 'номер рейса', 'the airline': 'авиакомпания', 'the departure airport': 'аэропорт вылета', 'the arrival airport': 'аэропорт прилёта',
  'the time': 'время', 'the landing time': 'время посадки', 'the hotel': 'отель', 'the check-in date': 'дата заезда', 'the check-out date': 'дата выезда', 'the company': 'компания',
  'the address': 'адрес', 'the pick-up place': 'место получения', 'the return': 'возврат',
  'from your calendar': 'из календаря', 'by AI from the email': 'ИИ из письма', 'from the airport’s flight board': 'с табло аэропорта',
};
const fill = s => s.split('; ').map(g => { const m = /^(.+?) (from your calendar|by AI from the email|from the airport’s flight board)$/.exec(g); return m ? m[1].split(', ').map(x => FILL[x] || x).join(', ') + ' ' + FILL[m[2]] : g; }).join('; ');
// what a check changed: "airline, date, time"
const SAY = { airline: 'авиакомпания', 'flight number': 'номер рейса', 'departure airport': 'аэропорт вылета', 'arrival airport': 'аэропорт прилёта', date: 'дата', time: 'время',
  'landing time': 'время посадки', hotel: 'отель', address: 'адрес', 'check-in date': 'дата заезда', 'check-out date': 'дата выезда', company: 'компания', 'pick-up place': 'место получения',
  'pick-up': 'получение', return: 'возврат', status: 'статус', cancelled: 'отменено' };
// a booking's field, as Ipsy's change lines name it (EDIT_LABEL)
const FIELD = { 'flight number': 'номер рейса', airline: 'авиакомпания', from: 'откуда', to: 'куда', departs: 'вылет', arrives: 'прилёт', terminal: 'терминал', gate: 'выход',
  confirmation: 'номер брони', seat: 'место', traveler: 'пассажир', notes: 'заметки', name: 'название', address: 'адрес', city: 'город', 'check-in': 'заезд', 'check-in time': 'время заезда',
  'check-out': 'выезд', 'check-out time': 'время выезда', phone: 'телефон', company: 'компания', 'pick-up place': 'место получения', 'pick-up': 'получение', 'drop-off': 'возврат',
  'drop-off place': 'место возврата', car: 'машина', title: 'название', place: 'место', starts: 'начало', ends: 'конец' };
const nothing = s => (s === 'nothing' ? 'пусто' : s);
const models = s => s.replace(/^Check /, 'Проверка ').replace(/; Ipsy /, '; Ипси ').replace(/ \(the last answer came from it\)/, ' (последний ответ от неё)').replace(/ \(but the last answer came from (.+?)\)/, ' (но последний ответ от $1)');

aosLang.add({
  // the page
  'Travel': 'Поездки',
  'Travel can’t be opened inside another page.': 'Поездки нельзя открыть внутри другой страницы.',
  'Trips': 'Поездки',
  'Explore': 'Обзор',
  'Sections': 'Разделы',
  'Look for new bookings in Gmail': 'Искать новые брони в Gmail',
  'Settings, sync and backup': 'Настройки, синхронизация и копия',
  'Which trips': 'Какие поездки',
  'Upcoming': 'Впереди',
  'Past': 'Прошлые',
  'To check': 'На проверку',
  'Paste a confirmation or a setup link': 'Вставить подтверждение или ссылку',
  'Add a booking': 'Добавить бронь',
  'Updated': 'Обновлено',
  'Syncing': 'Синхронизация',
  'Undo': 'Отменить',
  'Done': 'Готово',
  'Cancel': 'Отмена',
  'Close': 'Закрыть',

  // the trips
  'No trips yet': 'Поездок пока нет',
  'Look in Gmail now': 'Проверить Gmail',
  'Connect Gmail': 'Подключить Gmail',
  'Add a booking by hand': 'Добавить бронь вручную',
  'No past trips': 'Прошлых поездок нет',
  'Nothing coming up': 'Впереди ничего нет',
  'Ipsy is reading the emails…': 'Ипси читает письма…',
  'Have Ipsy check these': 'Проверить с Ипси',
  'Have Ipsy check': 'Проверить с Ипси',
  'Have Ipsy check this trip': 'Проверить поездку с Ипси',
  'Reads the newest email for each booking and updates what changed': 'Читает последнее письмо по каждой брони и вносит изменения',
  'Checking…': 'Проверка…',
  'Now': 'Сейчас',
  'Canceled': 'Отменено',
  'Needs a date': 'Нужна дата',
  'Check details': 'Проверьте',
  'Just me': 'Только я',
  'All day': 'Весь день',
  'In': 'Заезд',
  'Out': 'Выезд',
  'No date': 'Без даты',
  // live status
  'Scheduled': 'По расписанию',
  'Diverted': 'Перенаправлен',
  'Landed': 'Приземлился',
  'In the air': 'В полёте',
  'Boarding': 'Посадка',
  'Gate closed': 'Выход закрыт',
  'Delayed': 'Задерживается',
  'Check-in open': 'Регистрация открыта',
  'On time': 'Вовремя',

  // a trip
  'Back to trips': 'К поездкам',
  'Trip': 'Поездка',
  'Trip name': 'Название поездки',
  'Add the whole trip to your calendar': 'Добавить поездку в календарь',
  'Add a booking to this trip': 'Добавить бронь в поездку',
  'Private trip': 'Личная поездка',
  'Just me trip': 'Только для меня',
  'Private trip hides this trip and its emails from Ipsy.': 'Личная поездка скрыта от Ипси вместе с письмами.',
  'Just me trip: only you see it, not the family.': 'Только для меня: поездку видите только вы, семья — нет.',
  'Shared with the family.': 'Видна всей семье.',
  'Find more for this trip': 'Найти ещё для поездки',
  'Rental cars (Kayak)': 'Прокат авто (Kayak)',
  'Compares National, Enterprise, Hertz and others': 'Сравнивает National, Enterprise, Hertz и другие',
  'Opens nationalcar.com': 'Откроет nationalcar.com',
  'Ipsy can see this trip again': 'Ипси снова видит эту поездку',
  'Private: hidden from Ipsy': 'Личное: скрыто от Ипси',
  'Shared with the family again': 'Снова видно семье',
  'Just me: only you see it': 'Только я: видите только вы',

  // a booking
  'Booking': 'Бронь',
  'Flight': 'Рейс',
  'Hotel': 'Отель',
  'Rental car': 'Прокат авто',
  'Other': 'Другое',
  'New flight': 'Новый рейс',
  'New hotel': 'Новый отель',
  'New rental car': 'Новый прокат авто',
  'New other': 'Новая бронь',
  'The email has no date. Pick the day below (or your calendar may supply it).': 'В письме нет даты. Выберите день ниже (или его подставит календарь).',
  'The email has no dates. Fill them in below.': 'В письме нет дат. Заполните их ниже.',
  'Made from an event in your calendar. Check these details.': 'Создано из события календаря. Проверьте данные.',
  'Read from the words of the email. Check these details.': 'Прочитано из текста письма. Проверьте данные.',
  'Looks right': 'Всё верно',
  'Airline code': 'Код авиакомпании',
  'Flight number': 'Номер рейса',
  'From (airport)': 'Откуда (аэропорт)',
  'To (airport)': 'Куда (аэропорт)',
  'Departs': 'Вылет',
  'Lands': 'Посадка',
  'Terminal': 'Терминал',
  'Gate': 'Выход',
  'Confirmation': 'Номер брони',
  'Seat': 'Место',
  'Traveler': 'Пассажир',
  'Address': 'Адрес',
  'City': 'Город',
  'Check in': 'Заезд',
  'Check out': 'Выезд',
  'From': 'От',
  'To': 'До',
  'By': 'До',
  'Phone': 'Телефон',
  'Company': 'Компания',
  'Pick up at': 'Где получить',
  'Pick up': 'Получение',
  'Return': 'Возврат',
  'Return to (if different)': 'Где вернуть (если в другом месте)',
  'Car': 'Машина',
  'What': 'Что',
  'Where': 'Где',
  'Starts': 'Начало',
  'Ends': 'Конец',
  'Date': 'Дата',
  'Notes': 'Заметки',
  'Anything to remember': 'Что не забыть',
  'Train, tour, restaurant…': 'Поезд, экскурсия, ресторан…',
  'Open the email in Mail': 'Открыть письмо в Почте',
  'Open in Gmail': 'Открыть в Gmail',
  'In the browser': 'В браузере',
  'Map': 'Карта',
  'Add to calendar': 'Добавить в календарь',
  'This route on Google Flights': 'Этот маршрут в Google Flights',
  'Other hotels nearby': 'Другие отели рядом',
  'Google Hotels, same dates': 'Google Hotels, те же даты',
  'Mark as canceled': 'Отметить как отменённое',
  'Private': 'Личное',
  'Private hides this booking and its email from Ipsy.': '«Личное» скрывает бронь и её письмо от Ипси.',
  'Someone else’s booking, shared with the family.': 'Чужая бронь, видна семье.',
  'Just me: only you see it, not the family.': 'Только я: бронь видите только вы, семья — нет.',
  'Delete booking': 'Удалить бронь',
  'Tap again to delete': 'Нажмите ещё раз, чтобы удалить',
  'Added': 'Добавлено',
  'Not added: it needs a date.': 'Не добавлено: нужна дата.',
  'Thanks. Marked as checked.': 'Спасибо. Отмечено как проверенное.',
  'Deleted. It won’t come back from the email.': 'Удалено. Из письма бронь не вернётся.',
  'This phone couldn’t save Travel: storage is full. Your bookings are safe in the family’s Google Sheet.': 'Не удалось сохранить Поездки: память телефона заполнена. Брони в безопасности в семейной Google-таблице.',
  'This phone couldn’t save Travel: storage is full. Back up soon.': 'Не удалось сохранить Поездки: память телефона заполнена. Сделайте копию.',
  // live status
  'Live status': 'Статус онлайн',
  'Check again': 'Проверить снова',
  'Live status isn’t set up on this copy of the site.': 'Статус онлайн не настроен на этой копии сайта.',
  'Shows from 36 hours before take-off.': 'Появится за 36 часов до вылета.',
  'The flight data service’s monthly allowance is used up.': 'Месячный лимит сервиса данных о рейсах исчерпан.',
  'The flight data service refused the key.': 'Сервис данных о рейсах отклонил ключ.',
  'Couldn’t reach the flight data service.': 'Не удалось связаться с сервисом данных о рейсах.',
  'Couldn’t get the status just now.': 'Сейчас не удалось получить статус.',
  'Not checked yet.': 'Ещё не проверялось.',

  // add, paste
  'Paste a confirmation': 'Вставить подтверждение',
  'Read it': 'Прочитать',
  'Pasted text': 'Вставленный текст',
  'Paste the booking email here': 'Вставьте сюда письмо с бронью',
  'No flight, hotel or car booking found in that text. Add it by hand with the + button instead.': 'В тексте нет брони рейса, отеля или машины. Добавьте её вручную кнопкой +.',
  'Already here.': 'Уже есть.',
  'That’s an old Sheet setup link: there’s nothing to set up. Just sign in.': 'Это старая ссылка настройки таблицы: настраивать ничего не нужно. Просто войдите.',

  // Gmail
  'Reading Gmail': 'Читаем Gmail',
  'Up to date': 'Всё актуально',
  'Nothing new in Gmail.': 'В Gmail ничего нового.',
  'Signed out of Gmail. Your bookings stay.': 'Вы вышли из Gmail. Брони остаются.',
  'Gmail needs you to sign in again.': 'Gmail просит войти снова.',
  'No connection to Gmail': 'Нет связи с Gmail',
  'Gmail asked to slow down. Try again in a minute.': 'Gmail просит подождать. Повторите через минуту.',
  'Gmail access was declined.': 'Доступ к Gmail отклонён.',
  'Gmail needs one tap to sign in again: Settings → Connect Gmail.': 'Чтобы снова войти в Gmail, нажмите: Настройки → Подключить Gmail.',
  'cancellation': 'отмена',
  'no booking found in it': 'брони не найдено',
  'couldn’t be downloaded': 'не удалось скачать',

  // calendar
  'AI isn’t set up on this copy of the site.': 'ИИ не настроен на этой копии сайта.',
  'Connect Gmail first, so Travel can read the emails.': 'Сначала подключите Gmail, чтобы Поездки могли читать письма.',
  'Nothing is missing.': 'Ничего не упущено.',
  'Nothing to check.': 'Нечего проверять.',
  'Couldn’t check just now. Try again in a moment.': 'Сейчас не удалось проверить. Повторите чуть позже.',

  // Explore
  'Search flights, hotels and cars': 'Авиабилеты, отели и машины',
  'City or airport': 'Город или аэропорт',
  'Leaving': 'Туда',
  'Coming back': 'Обратно',
  'Swap': 'Поменять',
  'Swap from and to': 'Поменять местами',
  'Search on': 'Искать на',

  // Settings
  'Settings': 'Настройки',
  'Design': 'Дизайн',
  'Live flight status': 'Статус рейсов онлайн',
  'Smart help': 'Умная помощь',
  'Family calendar': 'Семейный календарь',
  'Ipsy fills in what’s missing': 'Ипси дополняет недостающее',
  'Ipsy checks by itself': 'Ипси проверяет без просьбы',
  'Ipsy can search Gmail': 'Ипси может искать в Gmail',
  'Backup': 'Резервная копия',
  'Back up everything': 'Сохранить всё',
  'One file with every booking': 'Один файл со всеми бронями',
  'Import a backup': 'Восстановить из копии',
  'Adds what isn’t here already': 'Добавит то, чего здесь ещё нет',
  'What Travel read': 'Что прочитали Поездки',
  'Look for new bookings now': 'Искать новые брони',
  'Not checked yet': 'Ещё не проверялось',
  'Read the last year again': 'Перечитать последний год',
  'Bookings you edited, checked or deleted stay as they are': 'Брони, которые вы меняли, проверяли или удаляли, останутся как есть',
  'Sign out of Gmail': 'Выйти из Gmail',
  'Signed in': 'Вход выполнен',
  'Read-only': 'Только чтение',
  'Using Mail’s sign-in from this browser.': 'Используется вход Почты в этом браузере.',
  'Nothing yet': 'Пока ничего',
  'No emails read yet.': 'Писем пока не прочитано.',
  'Not available on this copy of the site.': 'Недоступно на этой копии сайта.',
  'Not set up on this copy of the site.': 'Не настроено на этой копии сайта.',
  'On. Shares bookings with the Family calendar, both ways.': 'Вкл. Брони и Семейный календарь обмениваются в обе стороны.',
  'Off. Shares bookings with the Family calendar, both ways.': 'Выкл. Брони и Семейный календарь обмениваются в обе стороны.',
  'Off. Ipsy fills in a trip’s missing details from its email.': 'Выкл. Ипси дополняет недостающие данные поездки из письма.',
  'On. Ipsy checks new bookings that are missing details.': 'Вкл. Ипси проверяет новые брони с недостающими данными.',
  'Off. Ipsy checks new bookings that are missing details.': 'Выкл. Ипси проверяет новые брони с недостающими данными.',
  'Asks first. Ipsy checks new bookings that are missing details.': 'Сначала спросит. Ипси проверяет новые брони с недостающими данными.',
  'On. Lets Ipsy search and read your email in chats.': 'Вкл. Ипси может искать и читать вашу почту в чатах.',
  'Off. Lets Ipsy search and read your email in chats.': 'Выкл. Ипси может искать и читать вашу почту в чатах.',
  'Backup saved': 'Копия сохранена',
  'Backup saved to Downloads': 'Копия сохранена в Загрузки',
  'Backup canceled': 'Копирование отменено',
  'Couldn’t save the backup': 'Не удалось сохранить копию',
  'That file isn’t a Travel backup.': 'Этот файл — не копия Поездок.',
  // the family's Sheet
  'Sign in to sync with the family’s Google Sheet. Until then, Travel keeps everything on this phone.': 'Войдите, чтобы синхронизироваться с семейной Google-таблицей. А пока всё хранится на этом телефоне.',
  'The family’s Travel Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.': 'Семейная таблица Поездок ещё не настроена. Владелец настраивает её в aOS: Профиль → Google Таблицы.',
  'aOS’s phrase for the Travel Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.': 'Фраза aOS для таблицы Поездок больше не совпадает со скриптом. Владелец обновляет её в aOS: Профиль → Google Таблицы.',
  'The Travel Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).': 'В таблице Поездок старый скрипт. Владелец вставляет новый и разворачивает новую версию (aOS/SHEETS.md).',
  'The Travel Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.': 'В скрипте таблицы Поездок всё ещё SECRET = ‘CHANGE-ME’. Владелец меняет его и разворачивает новую версию.',
  'The Sheet was busy. Trying again shortly.': 'Таблица занята. Скоро повторим.',
  'Offline. Changes will sync when you’re back online.': 'Нет сети. Изменения синхронизируются, когда связь вернётся.',
  'Couldn’t reach the Sheet. Trying again later.': 'Не удалось связаться с таблицей. Повторим позже.',
  'The Sheet didn’t answer as expected. Trying again later.': 'Таблица ответила не так, как ожидалось. Повторим позже.',
  'Sync didn’t work. Trying again later.': 'Синхронизация не удалась. Повторим позже.',
  'Couldn’t get older trips from the Sheet. Try again later.': 'Не удалось получить старые поездки из таблицы. Повторите позже.',
  'Getting older trips from the Sheet…': 'Загружаем старые поездки из таблицы…',
  'Show older trips from the Sheet': 'Показать старые поездки из таблицы',
  'Sign in to see older trips.': 'Войдите, чтобы увидеть старые поездки.',

  // Ipsy here
  'Ask Ipsy about your trips': 'Спросите Ипси о поездках',
  'Hi, I’m Ipsy! I can tell you about your trips, fix or add a booking, check any flight live (delays, gates, where it is), find a flight number, look through your Gmail, or look something up on the web.': 'Привет, я Ипси! Расскажу о ваших поездках, исправлю или добавлю бронь, проверю любой рейс онлайн (задержки, выходы, где он сейчас), найду номер рейса, посмотрю ваш Gmail или поищу что-нибудь в интернете.',
  'When’s my next flight? Is it on time?': 'Когда мой следующий рейс? Он вовремя?',
  'What’s on my next trip?': 'Что в моей следующей поездке?',
  'Is anything on my trips not confirmed?': 'Есть ли в поездках что-то неподтверждённое?',
  'Check Gmail for bookings I’m missing': 'Найди в Gmail брони, которых у меня нет',
  'Ipsy runs on Claude, by Anthropic: what you ask, and the bookings and emails it reads, go there through the family server (flight look-ups go to AeroDataBox). Each change shows here with Undo, and it asks before deleting.': 'Ипси работает на Claude от Anthropic: ваши вопросы, а также брони и письма, которые читает Ипси, идут туда через семейный сервер (запросы о рейсах — в AeroDataBox). Каждое изменение появляется здесь с кнопкой «Отменить», а перед удалением Ипси спрашивает.',
  'Looking through your trips': 'Смотрю поездки',
  'Reading the details': 'Читаю детали',
  'Updating a booking': 'Обновляю бронь',
  'Adding a booking': 'Добавляю бронь',
  'Deleting a booking': 'Удаляю бронь',
  'Deleting bookings': 'Удаляю брони',
  'Deleting a trip': 'Удаляю поездку',
  'Moving a booking': 'Переношу бронь',
  'Renaming a trip': 'Переименовываю поездку',
  'Opening the trip': 'Открываю поездку',
  'Checking the flight live': 'Проверяю рейс онлайн',
  'Looking at the departure board': 'Смотрю табло вылетов',
  'Searching Gmail': 'Ищу в Gmail',
  'Reading an email': 'Читаю письмо',
  'Want me to fill in what your upcoming bookings are missing, by myself? I’ll send Claude a short excerpt of each email, and mark what I fill in': 'Дополнять недостающее в предстоящих бронях самостоятельно? Я отправлю Claude короткий отрывок каждого письма и отмечу дополненное как',
  'Check': 'На проверку',
  ', with Undo.': ', с кнопкой «Отменить».',
  'Yes, check them': 'Да, проверяй',
  'Not now': 'Не сейчас',
  'Sign in with Face ID in aOS and I can fill in what your bookings are missing.': 'Войдите в aOS с Face ID, и я дополню недостающее в бронях.',
}, [
  // the trips
  [WHEN, m => when(m[0])],
  [/^(\d+) to check$/, m => 'На проверку: ' + m[1]],
  [/^(\d+) canceled$/, m => 'Отменено: ' + m[1]],
  [/^Have Ipsy check (.+)$/, m => 'Проверить с Ипси: ' + m[1]],
  [/^Delayed (\d+) h(?: (\d+) min)?$/, m => 'Задержка ' + m[1] + ' ч' + (m[2] ? ' ' + m[2] + ' мин' : '')],
  [/^Delayed (\d+) min$/, m => 'Задержка ' + m[1] + ' мин'],
  [/^Late (\d+) min$/, m => 'Опоздание ' + m[1] + ' мин'],
  // a trip and a booking
  [/^(.+)’s trip, shared with the family\.$/, m => 'Поездка: ' + m[1] + '. Видна всей семье.'],
  [/^(.+)’s booking, shared with the family\.$/, m => 'Бронь: ' + m[1] + '. Видна всей семье.'],
  [/^Filled in (.+)\. Check these details\.$/, m => 'Дополнено: ' + fill(m[1]) + '. Проверьте данные.'],
  [/^From (.+)\.$/, m => 'От ' + m[1] + '.'],
  [/^No live data for (.+) on this date yet\.$/, m => 'Данных по ' + m[1] + ' на эту дату пока нет.'],
  [/^Departs (.+)$/, m => 'Вылет ' + m[1]],
  [/^Lands (.+)$/, m => 'Посадка ' + m[1]],
  [/^Checked (.+?)(?: · (.+))?\. Local times\.$/, m => 'Проверено ' + (when(m[1]) || m[1]) + (m[2] ? ' · ' + m[2] : '') + '. Местное время.'],
  [/^Added (\d+) bookings?\. Check the details\.$/, m => 'Добавлено броней: ' + m[1] + '. Проверьте данные.'],
  // a hotel's or a car's day: "Check in Sat 12 Oct · from 3:00 PM"; a timeline row: "Check in · Hilton"
  [/^(Check in|Check out|Pick up|Return) · (.+)$/, m => ({ 'Check in': 'Заезд', 'Check out': 'Выезд', 'Pick up': 'Получение', 'Return': 'Возврат' })[m[1]] + ' · ' + m[2]],
  [/^(Check in|Check out|Pick up|Return) (.+)$/, m => ({ 'Check in': 'Заезд', 'Check out': 'Выезд', 'Pick up': 'Получение', 'Return': 'Возврат' })[m[1]] + ' ' + joined(m[2])],
  // Gmail
  [/^Reading Gmail · (\d+) of (\d+)$/, m => 'Читаем Gmail · ' + m[1] + ' из ' + m[2]],
  [/^(\d+) emails? could not be downloaded$/, m => 'Не удалось скачать: ' + pl(m[1], 'письмо', 'письма', 'писем')],
  [/^Read (\d+) emails?\. Nothing new\.$/, m => 'Прочитано писем: ' + m[1] + '. Ничего нового.'],
  [/^Gmail returned (\d+)$/, m => 'Gmail ответил ' + m[1]],
  [/^Gmail sign-in didn’t work \((.+)\)\.$/, m => 'Вход в Gmail не удался (' + m[1] + ').'],
  [new RegExp('^\\d+ ' + NOUNS + '(, \\d+ ' + NOUNS + ')*$'), m => counts(m[0])],
  // calendar
  [/^Added (the trip|it) to the (.+) calendar\.$/, m => (m[1] === 'it' ? 'Добавлено' : 'Поездка добавлена') + ' в календарь «' + (m[2] === 'Family' ? 'Семья' : m[2]) + '».'],
  [/^The Family calendar couldn’t take it \((.+)\)\. Saving a calendar file instead\.$/, m => 'Семейный календарь не принял событие (' + m[1] + '). Сохраняем файл календаря.'],
  [/^Calendar file saved\. Open it to add (the trip|it) to your calendar\.$/, m => 'Файл календаря сохранён. Откройте его, чтобы добавить ' + (m[1] === 'it' ? 'бронь' : 'поездку') + ' в календарь.'],
  // Ipsy
  [/^Filled in (\d+) details? on (.+)\. Marked Check\.$/, m => 'Дополнено деталей: ' + m[1] + ' — ' + count(m[2]) + '. Отмечено «На проверку».'],
  [/^Updated (.+)\. Marked Check\.$/, m => 'Обновлено: ' + m[1].split('; ').map(x => { const i = x.lastIndexOf(': '); return i < 0 ? x : x.slice(0, i) + ': ' + x.slice(i + 2).split(', ').map(w => SAY[w] || w).join(', '); }).join('; ') + '. Отмечено «На проверку».'],
  [/^(\d+) bookings? (?:is|are) missing details\. Want me to look\?$/, m => 'Не хватает данных: ' + pl(m[1], 'бронь', 'брони', 'броней') + '. Посмотреть?'],
  [/^I filled in (\d+) details? on (\d+) bookings?\. They’re in To check for you to look over\.$/, m => 'Дополнено деталей: ' + m[1] + ' в ' + pl(m[2], 'брони', 'бронях', 'бронях') + '. Они в списке «На проверку».'],
  [/^Checked (\d+) bookings? missing details: (?:its email doesn’t|their emails don’t) say any more\.$/, m => 'Проверено броней без данных: ' + m[1] + '. В письмах больше ничего нет.'],
  [/^Checking (.+) live$/, m => 'Проверяю ' + m[1] + ' онлайн'],
  [/^Searching Gmail: (.+)$/, m => 'Ищу в Gmail: ' + m[1]],
  [/^Changed (.+): (.+?) from (.+) to (.+)$/, m => 'Изменено: ' + m[1] + ': ' + (FIELD[m[2]] || m[2]) + ' с ' + nothing(m[3]) + ' на ' + nothing(m[4])],
  [/^Added (.+)$/, m => 'Добавлено: ' + m[1].replace(/ to (\d{4}-\d\d-\d\d)$/, ' до $1')],
  [/^Deleted (.+)$/, m => 'Удалено: ' + m[1]],
  [/^Marked (.+) as canceled$/, m => 'Отмечено как отменённое: ' + m[1]],
  [/^Brought back (.+)$/, m => 'Возвращено: ' + m[1]],
  [/^Marked (.+) as checked$/, m => 'Отмечено как проверенное: ' + m[1]],
  [/^Took (.+) out of its trip, into a trip of its own$/, m => 'Вынесено в отдельную поездку: ' + m[1]],
  [/^Put (.+) in the same trip as (.+)$/, m => 'В одной поездке: ' + m[1] + ' и ' + m[2]],
  [/^Renamed the trip(?: “(.+)”)? to “(.+)”$/, m => 'Поездка' + (m[1] ? ' «' + m[1] + '»' : '') + ' переименована в «' + m[2] + '»'],
  // a toast of a few sentences (Ipsy's checks)
  [/^(Ipsy|The email|\d+ bookings? |That’s enough AI|Sign in with Face ID in aOS to use|Couldn’t reach Ipsy)/, m => sentences(m.input)],
  // Settings
  [/^Last checked (.+)$/, m => 'Проверено ' + (when(m[1]) || m[1])],
  [/^Last look (.+?): (\d+) emails? read, (\d+) bookings? found(?:, (\d+) not downloaded)?$/, m => 'Последняя проверка ' + (when(m[1]) || m[1]) + ': прочитано писем — ' + m[2] + ', найдено броней — ' + m[3] + (m[4] ? ', не скачано — ' + m[4] : '')],
  [/^Last look (.+?) stopped: (.+)$/, m => 'Последняя проверка ' + (when(m[1]) || m[1]) + ' прервана: ' + (m[2] === 'something went wrong' ? 'что-то пошло не так' : m[2] === 'signed out' ? 'выполнен выход' : m[2])],
  [/^(\d+) emails? matched Travel’s search in the last look\.$/, m => 'Под поиск Поездок при последней проверке подошло писем: ' + m[1] + '.'],
  [/^On\. Ipsy fills in a trip’s missing details from its email\.(?: Models: (.+)\.)?$/, m => 'Вкл. Ипси дополняет недостающие данные поездки из письма.' + (m[1] ? '\nМодели: ' + models(m[1]) + '.' : '')],
  [/^Working\. (\d+) lookups? this month, of (\d+)\.$/, m => 'Работает. В этом месяце ' + pl(m[1], 'запрос', 'запроса', 'запросов') + ' из ' + m[2] + '.'],
  [/^Restored (\d+) bookings?$/, m => 'Восстановлено броней: ' + m[1]],
  // last: a line joined with " · " or " → " (a booking's details, the trips' subtitle): ours translated, the family's left as it is
  [/^(?:.+ (?:·|→) .+|(?:Terminal|Gate|Seat|Conf\.|lands|Bags: belt) .+|\d+ trips? coming up|Gmail checked .+|From anywhere)$/, m => joined(m[0])],
]);
})();
