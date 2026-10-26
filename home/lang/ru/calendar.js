// Russian for Calendar (calendar/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
  const P = (n, one, few, many) => n + ' ' + aosLang.plural(n, one, few, many);
  const T = '\\d{1,2}:\\d{2}(?: [AP]M)?';                                   // 9:00 AM, 21:00
  const re = s => new RegExp('^' + s + '$');
  const q = s => s.replace(/“/g, '«').replace(/”/g, '»');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const M_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const M_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const M_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
  const mon = (s, f) => { const i = MONTHS.indexOf(s); return i < 0 ? s : f[i]; };
  // days of the week: gender, accusative ("в среду"), dative plural ("по средам")
  const DAYS = {
    Monday: ['m', 'понедельник', 'понедельникам'], Tuesday: ['m', 'вторник', 'вторникам'], Wednesday: ['f', 'среду', 'средам'],
    Thursday: ['m', 'четверг', 'четвергам'], Friday: ['f', 'пятницу', 'пятницам'], Saturday: ['f', 'субботу', 'субботам'], Sunday: ['n', 'воскресенье', 'воскресеньям'],
  };
  const ORD = { first: ['первый', 'первую', 'первое'], second: ['второй', 'вторую', 'второе'], third: ['третий', 'третью', 'третье'], fourth: ['четвёртый', 'четвёртую', 'четвёртое'],
    fifth: ['пятый', 'пятую', 'пятое'], last: ['последний', 'последнюю', 'последнее'], 'second to last': ['предпоследний', 'предпоследнюю', 'предпоследнее'] };
  const G = { m: 0, f: 1, n: 2 };
  const split = s => s.split(/, | and /);
  const join = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1];
  const v = s => (/^в[^аеёиоуыэюя]/i.test(s) ? 'во ' : 'в ') + s;      // "во вторник", "в среду"
  // "second Tuesday" -> "второй вторник", "last day" -> "последний день" (accusative)
  const ordItem = s => {
    let m = /^(?:(first|second|third|fourth|fifth|last|second to last) )?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|day)$/.exec(s);
    if (!m) return s;
    const d = m[2] === 'day' ? ['m', 'день'] : DAYS[m[2]];
    return (m[1] ? ORD[m[1]][G[d[0]]] + ' ' : '') + d[1];
  };
  // a repeat in words (ical.js ruleText): "Every 2 weeks on Monday and Wednesday, 10 times"
  function rule(s) {
    let m, tail = '';
    if ((m = /^(.*), (\d+) times?$/.exec(s))) { s = m[1]; tail = ', ' + P(m[2], 'раз', 'раза', 'раз'); }
    else if ((m = /^(.*), until (.+)$/.exec(s))) { s = m[1]; tail = ', до ' + m[2]; }
    if (s === 'Every weekday') return 'По будням' + tail;
    if (!(m = /^Every (?:(\d+) )?(day|week|month|year|time)s?(?: (.+))?$/.exec(s))) return null;
    const n = m[1] ? +m[1] : 1, u = m[2], rest = m[3] || '';
    const F = { day: ['день', 'дня', 'дней'], week: ['неделю', 'недели', 'недель'], month: ['месяц', 'месяца', 'месяцев'], year: ['год', 'года', 'лет'], time: ['раз', 'раза', 'раз'] }[u];
    let out = n === 1 ? (u === 'week' ? 'Каждую неделю' : 'Каждый ' + F[0])
      : (n % 10 === 1 && n % 100 !== 11 ? (u === 'week' ? 'Каждую ' : 'Каждый ') : 'Каждые ') + P(n, F[0], F[1], F[2]);
    if (!rest) return out + tail;
    if (rest === 'on every day') out += ', каждый день';
    else if ((m = /^on the (.+) of (.+)$/.exec(rest))) out += ', ' + v(join(split(m[1]).map(ordItem))) + ' ' + join(split(m[2]).map(x => mon(x, M_GEN)));
    else if ((m = /^on the (.+)$/.exec(rest))) {
      const items = split(m[1]);
      out += ', ' + (items.every(x => /^\d+(st|nd|rd|th)$/.test(x)) ? join(items.map(x => parseInt(x, 10) + '-го')) + ' числа' : v(join(items.map(ordItem))));
    }
    else if ((m = /^on (\d+) (\w+)$/.exec(rest))) out += ', ' + m[1] + ' ' + mon(m[2], M_GEN);
    else if ((m = /^on (.+)$/.exec(rest))) out += ', по ' + join(split(m[1]).map(x => (DAYS[x] || [, , x])[2]));
    else if ((m = /^in (.+)$/.exec(rest))) out += ', в ' + join(split(m[1]).map(x => mon(x, M_PREP)));
    else return null;
    return out + tail;
  }
  // "5 min ago", "just now" (app.js: ago)
  const ago = s => s === 'just now' ? 'только что' : s.replace(/^(\d+) min ago$/, '$1 мин назад').replace(/^(\d+) h ago$/, '$1 ч назад').replace(/^(\d+) days ago$/, (_, n) => P(n, 'день', 'дня', 'дней') + ' назад');
  // alerts: "15 minutes before", "1 hour after the end"
  const UNIT = { minute: ['минуту', 'минуты', 'минут'], hour: ['час', 'часа', 'часов'], day: ['день', 'дня', 'дней'], week: ['неделю', 'недели', 'недель'] };
  const u = (n, w) => P(n, ...UNIT[w.replace(/s$/, '')]);
  // why the iCloud connection didn't answer (app.js: offWords)
  const off = s => s
    .replace(/^The iCloud connection isn’t answering at (\S+\/calendar\/api\/)\./, 'Подключение к iCloud не отвечает по адресу $1.')
    .replace(/ The function is running but answered with the error “([^”]*)” \((\d+)\)(, which means the request reached it without the app’s own header, or a route it doesn’t know)?\.$/,
      (_, t, n, w) => ' Функция работает, но ответила ошибкой «' + t + '» (' + n + ')' + (w ? ': запрос пришёл к ней без заголовка приложения или по пути, которого она не знает' : '') + '.')
    .replace(/ It answered (\d+)( \([^)]*\))?(: “[^”]*”)?\./, (_, n, c, t) => ' Ответ: ' + n + (c || '') + (t ? q(t) : '') + '.')
    .replace(' A 404 here means the Pages Functions bundle on Cloudflare doesn’t include calendar/api yet: run the News workflow on the default branch and check its “Publish to Cloudflare Pages” step uploads the Functions bundle.',
      ' Ошибка 404 значит, что в пакете Pages Functions на Cloudflare ещё нет calendar/api: запустите процесс News в основной ветке и проверьте, что шаг «Publish to Cloudflare Pages» загружает пакет функций.')
    .replace(' An error like this means the function itself failed on Cloudflare; the text above is Cloudflare’s own page.', ' Такая ошибка значит, что сама функция не сработала на Cloudflare; текст выше — страница самого Cloudflare.')
    .replace(/ The layers still show here\.$/, ' Слои по-прежнему видны здесь.');
  // what Fitness logged that day (app.js: fitnessItems)
  const GROUPS = { Chest: 'Грудь', Back: 'Спина', 'Lower back': 'Поясница', Shoulders: 'Плечи', Arms: 'Руки', Core: 'Пресс', Legs: 'Ноги', Glutes: 'Ягодицы', Cardio: 'Кардио', Other: 'Другое' };
  // the lines on Ipsy's Yes/No card (ipsy-tools.js: card)
  const CARD = { Title: 'Название', Day: 'День', Start: 'Начало', End: 'Конец', 'All day': 'Весь день', Repeat: 'Повтор', Calendar: 'Календарь', Place: 'Место', Notes: 'Заметки' };
  const cardVal = (k, s) => s === '(none)' ? '(нет)'
    : k === 'Title' ? (s === 'New Event' ? 'Новое событие' : s)
    : k === 'Day' ? s.replace(/ to /, ' — ')
    : k === 'Start' || k === 'End' ? (s === 'All day' ? 'Весь день' : s)
    : k === 'All day' ? ({ Yes: 'Да', No: 'Нет' })[s] || s
    : k === 'Repeat' ? (s === 'Never' ? 'Никогда' : rule(s) || s)
    : k === 'Calendar' ? s.replace(/ \(iCloud, shared with the family\)$/, ' (iCloud, общий с семьёй)')
    : s;
  const CHANGED = { title: 'название', time: 'время', 'all day': 'весь день', place: 'место', notes: 'заметки' };
  const WX = 'Clear|Mostly clear|Partly cloudy|Overcast|Fog|Freezing rain|Rain|Snow|Showers|Snow showers|Thunderstorm';

  aosLang.add({
    'Calendar': 'Календарь',
    'Calendar can’t be opened inside another page.': 'Календарь нельзя открыть внутри другой страницы.',
    // the header, the dock
    'Go to the year': 'Перейти к году',
    'Today': 'Сегодня',
    'Tomorrow': 'Завтра',
    'Search': 'Поиск',
    'Settings and calendars': 'Настройки и календари',
    'Search events': 'Поиск событий',
    'Clear search': 'Очистить поиск',
    'Views': 'Виды',
    'Day': 'День',
    'Week': 'Неделя',
    'Month': 'Месяц',
    'Year': 'Год',
    'List': 'Список',
    'New event': 'Новое событие',
    'Previous month': 'Предыдущий месяц',
    'Next month': 'Следующий месяц',
    'Previous week': 'Предыдущая неделя',
    'Next week': 'Следующая неделя',
    'Previous year': 'Предыдущий год',
    'Next year': 'Следующий год',
    'Updated': 'Обновлено',
    'Updating': 'Обновление',
    'Up to date': 'Всё обновлено',
    'Saving': 'Сохранение',
    'Saved': 'Сохранено',
    'Deleting': 'Удаление',
    'Deleted': 'Удалено',
    'Undo': 'Отменить',
    'Retry': 'Повторить',
    'Done': 'Готово',
    'Cancel': 'Отмена',
    'Add': 'Добавить',
    'Edit': 'Изменить',
    'Close': 'Закрыть',
    'Settings': 'Настройки',
    // months and days the app writes itself (ical.js)
    'January': 'Январь', 'February': 'Февраль', 'March': 'Март', 'April': 'Апрель', 'May': 'Май', 'June': 'Июнь',
    'July': 'Июль', 'August': 'Август', 'September': 'Сентябрь', 'October': 'Октябрь', 'November': 'Ноябрь', 'December': 'Декабрь',
    'Sunday': 'Вс', 'Monday': 'Пн',   // Settings > Week starts on (a narrow switch)
    // the views
    'Nothing on': 'Ничего не запланировано',
    'Tap + to add an event.': 'Нажмите +, чтобы добавить событие.',
    'all-day': 'весь день',
    'Earlier': 'Раньше',
    'Nothing coming up': 'Впереди ничего нет',
    'No matches': 'Ничего не найдено',
    'Offline. Showing the events last seen.': 'Нет сети. Показаны последние загруженные события.',
    'The Family calendar isn’t connected yet: add the ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD secrets (Calendar README, “Set up”).': 'Семейный календарь ещё не подключён: добавьте секреты ICLOUD_APPLE_ID и ICLOUD_APP_PASSWORD (README Календаря, «Set up»).',
    // the weather
    'Clear': 'Ясно', 'Mostly clear': 'Преимущественно ясно', 'Partly cloudy': 'Переменная облачность', 'Overcast': 'Пасмурно', 'Fog': 'Туман',
    'Freezing rain': 'Ледяной дождь', 'Rain': 'Дождь', 'Snow': 'Снег', 'Showers': 'Ливни', 'Snow showers': 'Снегопад', 'Thunderstorm': 'Гроза',
    // the layers
    'Family': 'Семья',
    'US Holidays': 'Праздники США',
    'Federal holidays and the usual observances': 'Федеральные праздники и памятные дни',
    'Notes': 'Заметки',
    'Reminders with a date, and notes with a nudge': 'Напоминания с датой и заметки с напоминанием',
    'Travel': 'Поездки',
    'Flights, hotels and rental cars from Travel': 'Рейсы, отели и прокат авто из Поездок',
    'Mail': 'Почта',
    'Remind Me days from Mail': 'Дни «Напомнить» из Почты',
    'Fitness': 'Фитнес',
    'Workouts logged in Fitness': 'Тренировки из Фитнеса',
    'Meals': 'Меню',
    'Breakfasts, lunches and dinners from the family’s plan in Meals': 'Завтраки, обеды и ужины из семейного плана в Меню',
    'Orders': 'Заказы',
    'Deliveries, pickups and returns from Orders': 'Доставки, самовывоз и возвраты из Заказов',
    'News': 'Новости',
    'Fixtures of the teams you follow in News': 'Матчи команд, за которыми вы следите в Новостях',
    'Order': 'Заказ',
    'Drinks': 'Напитки',
    'Your drinks and alcohol-free days, seen only by you': 'Ваши напитки и дни без алкоголя, видны только вам',
    'Weather': 'Погода',
    'A forecast on each day': 'Прогноз на каждый день',
    'Reminder': 'Напоминание',
    'Reminder · done': 'Напоминание · выполнено',
    '· done': '· выполнено',
    'Nudge': 'Напоминание о заметке',
    'Note': 'Заметка',
    'Flight': 'Рейс',
    'Hotel': 'Отель',
    'Booking': 'Бронь',
    'Alcohol-free': 'Без алкоголя',
    'Sign in to your family account first: open aOS.': 'Сначала войдите в семейный профиль: откройте aOS.',
    'Sign in to your family account first: open Drinks or aOS.': 'Сначала войдите в семейный профиль: откройте Напитки или aOS.',
    'Family accounts aren’t switched on yet.': 'Семейные профили ещё не включены.',
    'Couldn’t read Gmail just now.': 'Не удалось прочитать Gmail.',
    'Couldn’t read your log just now.': 'Не удалось прочитать ваш журнал.',
    'Reading…': 'Чтение…',
    'Fetching…': 'Загрузка…',
    'Location was refused; allow it for this site to see the forecast.': 'Доступ к геопозиции запрещён: разрешите его для этого сайта, чтобы видеть прогноз.',
    'Forecast for the next 16 days': 'Прогноз на 16 дней',
    // US holidays (worked out in app.js)
    'New Year’s Day': 'Новый год',
    'Martin Luther King Jr. Day': 'День Мартина Лютера Кинга',
    'Valentine’s Day': 'День святого Валентина',
    'Presidents’ Day': 'День президентов',
    'St. Patrick’s Day': 'День святого Патрика',
    'Good Friday': 'Страстная пятница',
    'Easter': 'Пасха',
    'Mother’s Day': 'День матери',
    'Memorial Day': 'День памяти',
    'Juneteenth': 'Джунтин',
    'Father’s Day': 'День отца',
    'Independence Day': 'День независимости',
    'Labor Day': 'День труда',
    'Columbus Day': 'День Колумба',
    'Halloween': 'Хэллоуин',
    'Veterans Day': 'День ветеранов',
    'Thanksgiving': 'День благодарения',
    'Black Friday': 'Чёрная пятница',
    'Christmas Eve': 'Сочельник',
    'Christmas Day': 'Рождество',
    'New Year’s Eve': 'Канун Нового года',
    'Daylight Saving Time begins': 'Переход на летнее время',
    'Daylight Saving Time ends': 'Переход на зимнее время',
    // one event
    'Event': 'Событие',
    'All day': 'Весь день',
    'Repeats on set dates': 'Повторяется в выбранные даты',
    'This occurrence was changed on its own': 'Это повторение изменено отдельно',
    'Open in Maps': 'Открыть в Картах',
    'At time of event': 'В момент события',
    'Shown as free': 'Показывается как свободное',
    'Private': 'Личное',
    'Hidden from Ipsy': 'Скрыто от Ипси',
    'organizer': 'организатор',
    'accepted': 'принято', 'declined': 'отклонено', 'tentative': 'под вопросом', 'delegated': 'передано',
    'Delete Event': 'Удалить событие',
    'Open in Notes': 'Открыть в Заметках',
    'Open in Travel': 'Открыть в Поездках',
    'Open in Mail': 'Открыть в Почте',
    'Open in Fitness': 'Открыть в Фитнесе',
    'Open in Meals': 'Открыть в Меню',
    // under an Orders item: the kind of order, when it has no items (orders/parse.js KIND_WORDS)
    'Package': 'Посылка', 'Store pickup': 'Самовывоз из магазина', 'Food': 'Еда', 'Digital': 'Цифровой заказ',
    'Open in Orders': 'Открыть в Заказах',
    'Open in News': 'Открыть в Новостях',
    'Open in Drinks': 'Открыть в Напитках',
    'Add to the Family calendar': 'Добавить в семейный календарь',
    // a Notes reminder ticked off from here (through the family's Notes Sheet)
    'Mark as done': 'Отметить выполненным', 'Mark as not done': 'Снять отметку',
    'Done in Notes': 'Выполнено в Заметках', 'Not done in Notes': 'Отметка снята в Заметках',
    'Sign in to tick it off in Notes.': 'Войдите, чтобы отметить это в Заметках.',
    'Set up the Notes Sheet in aOS first (Account → Google Sheets).': 'Сначала настройте Таблицу Заметок в aOS (Профиль → Google Таблицы).',
    'Offline. Try again when you’re back online.': 'Нет сети. Повторите, когда появится подключение.',
    'That reminder isn’t in the Notes Sheet any more.': 'Этого напоминания больше нет в Таблице Заметок.',
    'Couldn’t reach the Notes Sheet. Try again later.': 'Не удалось связаться с Таблицей Заметок. Повторите позже.',
    // the editor
    'New Event': 'Новое событие',
    'Edit Event': 'Изменить событие',
    'Title': 'Название',
    'Location': 'Место',
    'All-day': 'Весь день',
    'Starts': 'Начало',
    'Ends': 'Конец',
    'Time Zone': 'Часовой пояс',
    'Repeat': 'Повтор',
    'Never': 'Никогда',
    'Every Day': 'Каждый день',
    'Every Week': 'Каждую неделю',
    'Every 2 Weeks': 'Каждые 2 недели',
    'Every Month': 'Каждый месяц',
    'Every Year': 'Каждый год',
    'Custom…': 'Настроить…',
    'Frequency': 'Частота',
    'Daily': 'Ежедневно', 'Weekly': 'Еженедельно', 'Monthly': 'Ежемесячно', 'Yearly': 'Ежегодно',
    'Every': 'Каждые',
    'days': 'дн.', 'weeks': 'нед.', 'months': 'мес.', 'years': 'г.',
    'On': 'Дни',
    'End Repeat': 'Конец повтора',
    'On Date': 'В дату',
    'After…': 'После…',
    'Until': 'До',
    'Times': 'Повторов',
    'Travel Time': 'Время в пути',
    'None': 'Нет',
    'Alert': 'Оповещение',
    'Second Alert': 'Второе оповещение',
    'Show As': 'Показывать как',
    'Busy': 'Занят',
    'Free': 'Свободен',
    'Private hides this event from Ipsy.': 'Личное событие скрыто от Ипси.',
    'On day of event (9 AM)': 'В день события (9:00)',
    // choices
    'Choose': 'Выбор',
    'This is a repeating event': 'Это повторяющееся событие',
    'Only this event': 'Только это событие',
    'All future events': 'Все будущие события',
    'All events': 'Все события',
    'Delete this repeating event': 'Удалить повторяющееся событие',
    'Delete This Event Only': 'Удалить только это событие',
    'Delete All Future Events': 'Удалить все будущие события',
    'Delete All Events': 'Удалить все события',
    'Removed this occurrence': 'Это повторение удалено',
    'Removed it from here on': 'Удалено начиная с этого',
    // iCloud
    'iCloud refused the Apple ID or the app-specific password. Make a new app-specific password and update the ICLOUD_APP_PASSWORD secret.': 'iCloud не принял Apple ID или пароль приложения. Создайте новый пароль приложения и обновите секрет ICLOUD_APP_PASSWORD.',
    'No calendar of that name in the account.': 'В аккаунте нет календаря с таким названием.',
    'The iCloud secrets are not set on this copy of the site yet (Calendar README, “Set up”).': 'Секреты iCloud на этой копии сайта ещё не заданы (README Календаря, «Set up»).',
    'Couldn’t reach iCloud just now.': 'Не удалось связаться с iCloud.',
    'iCloud sent the request somewhere unexpected, so it was stopped.': 'iCloud отправил запрос в неожиданное место, поэтому он остановлен.',
    'That event was changed elsewhere in the meantime; it has been reloaded.': 'Это событие тем временем изменили в другом месте; оно загружено заново.',
    'The iCloud connection turned down what the app asked for.': 'Подключение к iCloud отклонило запрос приложения.',
    'That’s the most calendar changes for one person today. Try again tomorrow.': 'На сегодня это максимум изменений календаря для одного человека. Попробуйте завтра.',
    'You’re offline. Showing the events last seen.': 'Нет сети. Показаны последние загруженные события.',
    'The iCloud connection isn’t answering on this copy of the site.': 'Подключение к iCloud не отвечает на этой копии сайта.',
    'Something went wrong talking to iCloud.': 'Что-то пошло не так при связи с iCloud.',
    // Settings
    'Design': 'Дизайн',
    'Connected': 'Подключено',
    'Checking…': 'Проверка…',
    'Not set up yet: add the ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD secrets, then run the News workflow (Calendar README, “Set up”).': 'Ещё не настроено: добавьте секреты ICLOUD_APPLE_ID и ICLOUD_APP_PASSWORD, затем запустите процесс News (README Календаря, «Set up»).',
    'Check for changes now': 'Проверить изменения',
    'Look up the calendar again': 'Найти календарь заново',
    'If the Family calendar was renamed or moved': 'Если семейный календарь переименовали или перенесли',
    'Calendars': 'Календари',
    'iCloud, shared with the family': 'iCloud, общий с семьёй',
    'Display': 'Вид',
    'Week starts on': 'Начало недели',
    'Time': 'Время',
    'Auto': 'Авто',
    '12-hour': '12 ч',
    '24-hour': '24 ч',
    'Temperature': 'Температура',
    'Day view opens at': 'День открывается в',
    'New events': 'Новые события',
    'Length': 'Длительность',
    'All-day alert': 'Оповещение (весь день)',
    // Ipsy in Calendar (ipsy-tools.js)
    'Hi, I’m Ipsy! Ask me what’s on, or to add or move an event.': 'Привет, я Ипси! Спросите, что запланировано, или попросите добавить либо перенести событие.',
    'Ask Ipsy about the calendar': 'Спросите Ипси о календаре',
    'What’s on this week?': 'Что на этой неделе?',
    'Find us a free evening next week': 'Найди нам свободный вечер на следующей неделе',
    'Find appointment emails in Gmail': 'Найди письма о записях в Gmail',
    'What can you change here?': 'Что ты можешь здесь менять?',
    'Your question and the events Ipsy reads go to Claude, by Anthropic, through the family server. It asks before every change (each shows with Undo), and never sees Private events.': 'Ваш вопрос и события, которые читает Ипси, уходят в Claude от Anthropic через семейный сервер. Ипси спрашивает перед каждым изменением (у каждого есть «Отменить») и никогда не видит личные события.',
    '(none)': '(нет)',
    'Add this event?': 'Добавить это событие?',
    'Change this event?': 'Изменить это событие?',
    'Delete this event?': 'Удалить это событие?',
    'Yes, add it': 'Да, добавить',
    'Yes, change it': 'Да, изменить',
    'Yes, delete it': 'Да, удалить',
    'No': 'Нет',
    'Looking at the calendar': 'Смотрю календарь',
    'Reading an event': 'Читаю событие',
    'Looking for free time': 'Ищу свободное время',
    'Adding an event': 'Добавляю событие',
    'Changing an event': 'Изменяю событие',
    'Deleting an event': 'Удаляю событие',
    'Opening the day': 'Открываю день',
    'Searching Gmail': 'Ищу в Gmail',
    'Reading an email': 'Читаю письмо',
    'the Family calendar can’t be reached right now': 'семейный календарь сейчас недоступен',
    // Gmail for Ipsy (ipsy-gmail.js, gmail-connect.html)
    'Gmail for Ipsy': 'Gmail для Ипси',
    'Gmail for Calendar': 'Gmail для Календаря',
    'Lets Ipsy search and read this Gmail, read-only.': 'Ипси сможет искать и читать письма в этом Gmail, только для чтения.',
    'Connect Gmail': 'Подключить Gmail',
    'Reconnect or switch Google account': 'Переподключить или сменить аккаунт Google',
    'Turn off Gmail for Ipsy': 'Выключить Gmail для Ипси',
    'Turn on Gmail for Ipsy': 'Включить Gmail для Ипси',
    'Disconnect Gmail': 'Отключить Gmail',
    'Allow Ipsy to search and read Gmail? Senders, subjects and email text go to Claude, and stay in this chat until New chat.': 'Разрешить Ипси искать и читать Gmail? Отправители, темы и текст писем уходят в Claude и остаются в этом чате до нового чата.',
    'Yes, allow email access': 'Да, разрешить доступ к почте',
    'Choose the Gmail account for Ipsy to search, read-only. Connecting clears Ipsy’s chat in Calendar.': 'Выберите аккаунт Gmail, в котором Ипси будет искать, только для чтения. Подключение очищает чат Ипси в Календаре.',
    'Continue with Google': 'Продолжить с Google',
    'Loading Google…': 'Загрузка Google…',
    'Back to Calendar': 'Назад в Календарь',
    'Ready. Tap Continue with Google.': 'Готово. Нажмите «Продолжить с Google».',
    'Google could not load. Check your connection or content blocker.': 'Не удалось загрузить Google. Проверьте подключение или блокировщик контента.',
    'Google sign-in was closed or blocked. Allow the popup and try again.': 'Вход в Google закрыт или заблокирован. Разрешите всплывающее окно и попробуйте снова.',
    'Could not open Google sign-in.': 'Не удалось открыть вход в Google.',
    'Google did not grant read-only Gmail access.': 'Google не дал доступ к Gmail только для чтения.',
    'Could not reach Gmail. Check your connection.': 'Не удалось связаться с Gmail. Проверьте подключение.',
  }, [
    // the month and year over the grid, the list's line under the title
    [/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/, m => mon(m[1], M_NOM) + ' ' + m[2]],
    [/^Coming up from (.+)$/, m => 'Предстоящие с ' + m[1]],
    [/^From ([а-яё]{2}, \d{1,2} [а-яё]+\.?(?: \d{4} г\.)?)$/i, m => 'С ' + m[1]],
    // a day in the month: "суббота, 31 октября, 1 event"
    [/^(.+), (\d+) events?$/, m => m[1] + ', ' + P(m[2], 'событие', 'события', 'событий')],
    [/^(\d+) match(?:e?s)?( \(first 200\))?$/, m => P(m[1], 'совпадение', 'совпадения', 'совпадений') + (m[2] ? ' (первые 200)' : '')],
    [re('(' + WX + ') (-?\\d+°) / (-?\\d+°)'), m => aosLang.t(m[1]) + ' ' + m[2] + ' / ' + m[3]],
    // the layers
    [/^(.+) \(observed\)$/, m => aosLang.t(m[1]) + ' (перенос)'],
    [/^Remind: (.+)$/, m => 'Напомнить: ' + (m[1] === '(no subject)' ? '(без темы)' : m[1])],
    [/^From (.+)$/, m => 'От: ' + m[1]],
    [/^Workout · (.+)$/, m => 'Тренировка · ' + m[1].split(', ').map(g => GROUPS[g] || g).join(', ')],
    [/^(?:(\d+) exercises? · (\d+) sets?)?(?:(?: · )?(\d+) min cardio)?$/, m => [m[1] ? P(m[1], 'упражнение', 'упражнения', 'упражнений') + ' · ' + P(m[2], 'подход', 'подхода', 'подходов') : '', m[3] ? m[3] + ' мин кардио' : ''].filter(Boolean).join(' · ')],
    [/^Drinks · ([\d.,]+) standard$/, m => 'Напитки · ' + m[1] + ' ' + (/[.,]/.test(m[1]) ? 'порции' : aosLang.plural(m[1], 'порция', 'порции', 'порций'))],
    [/^(\d+) drinks?$/, m => P(m[1], 'напиток', 'напитка', 'напитков')],
    [/^(Pick up|Return) · (.+)$/, m => (m[1] === 'Pick up' ? 'Получение' : 'Возврат') + ' · ' + m[2].replace(/^Rental car(?=,|$)/, 'Прокат авто')],
    [/^(Breakfast|Lunch|Dinner): (.+)$/, m => ({ Breakfast: 'Завтрак', Lunch: 'Обед', Dinner: 'Ужин' })[m[1]] + ': ' + m[2]],
    // under an Orders item: what the order is, as Orders words it (orders/parse.js calendarItems)
    [/^Order (.+)$/, m => 'Заказ ' + m[1]],
    [/^(.+) and (\d+) more$/, m => m[1] + ' и ещё ' + m[2]],
    [/^(Arrives|Delivery window ends|Pick up by|Return by): (.+)$/, m => ({ Arrives: 'Прибывает', 'Delivery window ends': 'Окно доставки до', 'Pick up by': 'Забрать до', 'Return by': 'Вернуть до' })[m[1]] + ': ' + (m[2] === 'Order' ? 'Заказ' : m[2])],
    [/^Open (.+) once, signed in, to show it here$/, m => 'Чтобы показать здесь, откройте «' + aosLang.t(m[1]) + '» один раз после входа'],
    [/^(\d+) reminders?$/, m => P(m[1], 'напоминание', 'напоминания', 'напоминаний')],
    // one event: when, the repeat, travel time, alerts
    [/^(\d+) days?$/, m => P(m[1], 'день', 'дня', 'дней')],
    [re('to ([^A-Za-z]+(?: [AP]M)?)'), m => 'до ' + m[1]],
    [/^Every .+$/, m => rule(m[0]) || m[0]],
    [/^(\d+(?:\.\d+)?) (h|min) travel time$/, m => 'В пути: ' + m[1].replace('.', ',') + ' ' + (m[2] === 'h' ? 'ч' : 'мин')],
    [re('At ([^A-Za-z]+(?: [AP]M)?)'), m => m[1]],
    [re('On the day at (' + T + ')'), m => 'В день события в ' + m[1]],
    [re('(\\d+) (days?|week) before at (' + T + ')'), m => 'За ' + u(m[1], m[2]) + ' в ' + m[3]],
    [re('(\\d+) (days?|week) after at (' + T + ')'), m => 'Через ' + u(m[1], m[2]) + ' в ' + m[3]],
    [/^(\d+) (days?|week) before \(9 AM\)$/, m => 'За ' + u(m[1], m[2]) + ' (9:00)'],
    [/^(\d+) (minutes?|hours?|days?|weeks?) (before|after)( the end)?$/, m => m[3] === 'before' ? 'За ' + u(m[1], m[2]) + (m[4] ? ' до конца' : '') : 'Через ' + u(m[1], m[2]) + ' после ' + (m[4] ? 'конца' : 'начала')],
    // the editor's lists
    [/^(\d+) (minute|hour)s?(?:, (\d+) minutes?)?$/, m => P(m[1], ...(m[2] === 'hour' ? ['час', 'часа', 'часов'] : ['минута', 'минуты', 'минут'])) + (m[3] ? ' ' + P(m[3], 'минута', 'минуты', 'минут') : '')],
    [/^(\d+) min$/, m => m[1] + ' мин'],
    [/^1\.5 hours$/, () => '1,5 часа'],
    [/^Day (\d+)$/, m => m[1] + '-го числа'],
    [/^The (first|second|third|fourth|fifth|last) (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/, m => { const s = v(ordItem(m[1] + ' ' + m[2])); return s[0].toUpperCase() + s.slice(1); }],
    // choices and toasts
    [/^Delete “(.+)”\?$/, m => 'Удалить «' + m[1] + '»?'],
    [/^Deleted “(.+)”$/, m => 'Удалено: «' + m[1] + '»'],
    // iCloud: errors, the notice, Settings
    [/^iCloud answered with an error \((.+)\)\.$/, m => 'iCloud ответил ошибкой (' + m[1] + ').'],
    [/^(.+) Calendars there: (.+)\.$/, m => aosLang.t(m[1]) + ' Календари там: ' + m[2] + '.'],
    [/^The iCloud connection isn’t answering at .+$/, m => off(m[0])],
    [/^This is the GitHub Pages copy of the site \((.+)\), which has no iCloud connection\. Open Calendar from the Cloudflare address for the Family calendar; the layers still show here\.$/, m => 'Это копия сайта на GitHub Pages (' + m[1] + '), без подключения к iCloud. Откройте Календарь по адресу Cloudflare, чтобы видеть семейный календарь; слои видны и здесь.'],
    [/^to the (.+) calendar in iCloud\.(?: Last checked (.+)\.)?$/, m => 'к календарю «' + m[1] + '» в iCloud.' + (m[2] ? ' Проверено ' + ago(m[2]) + '.' : '')],
    [/^Offline\. Showing the events last seen(?:, (.+))?\.$/, m => 'Нет сети. Показаны последние загруженные события' + (m[1] ? ', ' + ago(m[1]) : '') + '.'],
    // Ipsy's cards and changes
    [/^(Title|Day|Start|End|All day|Repeat|Calendar|Place|Notes): (.+)$/, m => CARD[m[1]] + ': ' + m[2].split(' → ').map(s => cardVal(m[1], s)).join(' → ')],
    [/^(.+) \(iCloud, shared with the family\)$/, m => m[1] + ' (iCloud, общий с семьёй)'],   // after "Calendar: ", which shared.js reads first
    [/^Added “(.+)” on (.+)$/, m => 'Добавлено «' + m[1] + '»: ' + m[2]],
    [/^Changed (.+?) of “(.+)”$/, m => 'Изменено (' + m[1].split(', ').map(w => CHANGED[w] || w).join(', ') + '): «' + m[2] + '»'],
    [/^Deleted “(.+)” \((.+)\)$/, m => 'Удалено «' + m[1] + '» (' + m[2] + ')'],
    [/^Searching the calendar: (.+)$/, m => 'Ищу в календаре: ' + m[1]],
    [/^Couldn’t undo: (.+)$/, m => 'Не удалось отменить: ' + aosLang.t(m[1])],
  ]);
})();
