// Russian for Clock (clock/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
  const P = (n, one, few, many) => n + ' ' + aosLang.plural(n, one, few, many);
  const T = '\\d{1,2}:\\d{2}(?: [AP]M)?';                                   // 7:05 PM, 19:05
  const N = '(?:\\d+[½¼¾]?|[½¼¾])';
  const DUR = '(?:' + N + ' (?:days?|hr|min|sec)(?: ' + N + ' (?:days?|hr|min|sec))*|less than a minute)';
  // "7 hr 12 min", "1 day 3 hr", "45 sec", "9½ hr", "less than a minute" (logic.js: untilText, hoursText, durText, diffText)
  const dur = s => s === 'less than a minute' ? 'меньше минуты'
    : s.replace(/(\d+) days?/g, (_, n) => P(n, 'день', 'дня', 'дней')).replace(/ hr\b/g, ' ч').replace(/ min\b/g, ' мин').replace(/ sec\b/g, ' сек');
  // the days an alarm repeats on (logic.js: repeatText)
  const EVERY = { Sunday: 'Каждое воскресенье', Monday: 'Каждый понедельник', Tuesday: 'Каждый вторник', Wednesday: 'Каждую среду', Thursday: 'Каждый четверг', Friday: 'Каждую пятницу', Saturday: 'Каждую субботу' };
  const SHORT = { Sun: 'Вс', Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб' };
  const REP = '(Never|Every day|Weekdays|Weekends|Every (?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day|(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?: (?:Sun|Mon|Tue|Wed|Thu|Fri|Sat))*)';
  const rep = s => ({ Never: 'Никогда', 'Every day': 'Каждый день', Weekdays: 'По будням', Weekends: 'По выходным' })[s]
    || EVERY[s.replace(/^Every /, '')] || s.split(' ').map(d => SHORT[d] || d).join(' ');
  const repL = s => { const r = rep(s); return /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)( |$)/.test(s) ? r : r[0].toLowerCase() + r.slice(1); };   // "по будням", but "Пн Ср Пт"
  // when an alarm rings next (app.js: whenLine): "7:00 AM", "7:00 AM tomorrow", "пт 7:00 AM"
  const when = s => { let m;
    if ((m = new RegExp('^(' + T + ') tomorrow$').exec(s))) return 'завтра в ' + m[1];
    if ((m = new RegExp('^(\\S+) (' + T + ')$').exec(s))) return m[1] + ' в ' + m[2];
    return 'в ' + s; };
  // when something already happened (app.js: pastLine): "at 7:00 AM", "yesterday at 7:00 AM", "on пт, 13 окт. at 7:00 AM"
  const past = s => s.replace(/^yesterday at /, 'вчера в ').replace(/^at /, 'в ').replace(/^on (.+) at /, '$1 в ');
  // a ring's label that the app wrote (a label typed in stays as it is)
  const lab = s => ({ Alarm: 'Будильник', 'Wake Up': 'Пробуждение' })[s] || (new RegExp('^(' + DUR + ') timer$').test(s) ? 'Таймер ' + dur(s.replace(/ timer$/, '')) : s);
  const re = s => new RegExp('^' + s + '$');

  aosLang.add({
    'Clock': 'Часы',
    'Clock can’t be opened inside another page.': 'Часы нельзя открыть внутри другой страницы.',
    'This phone couldn’t save Clock: its storage is full.': 'Не удалось сохранить Часы: память телефона заполнена.',
    // tabs and the header
    'World Clock': 'Часы мира',   // «Мировые часы» doesn't fit its tab in Futura
    'Alarms': 'Будильник',
    'Stopwatch': 'Секундомер',
    'Timers': 'Таймеры',
    'Edit': 'Изменить',
    'Done': 'Готово',
    'Nightstand': 'Ночные часы',
    'Settings': 'Настройки',
    'Add a city': 'Добавить город',
    'Add an alarm': 'Добавить будильник',
    'Running': 'Идёт',
    'Stopped': 'Остановлен',
    'No alarms on': 'Все будильники выключены',
    // World Clock
    'Here': 'Здесь',
    'No cities yet': 'Городов пока нет',
    'Tap + to add one.': 'Нажмите +, чтобы добавить.',
    'Choose a City': 'Выбор города',
    'Main Clock': 'Основные часы',
    'This phone’s time zone': 'Часовой пояс телефона',
    'Search for a city': 'Поиск города',
    'Search': 'Поиск',
    'Close': 'Закрыть',
    '· added': '· добавлен',
    '· main clock': '· основные часы',
    // Alarms
    'Sleep | Wake Up': 'Сон | Пробуждение',
    'No sleep schedule': 'Нет графика сна',
    'Set Up': 'Настроить',
    'Other': 'Другие',
    'No alarms': 'Нет будильников',
    'Tap + to set one.': 'Нажмите +, чтобы добавить.',
    'Alarm': 'Будильник',
    'Wake Up': 'Пробуждение',
    'No Alarm': 'Без будильника',
    'Sleep schedule': 'График сна',
    'Alarm deleted.': 'Будильник удалён.',
    'OK': 'ОК',
    'Add Alarm': 'Новый будильник',
    'Edit Alarm': 'Изменить будильник',
    'Cancel': 'Отмена',
    'Save': 'Сохранить',
    'Time': 'Время',
    'Repeat': 'Повтор',
    'Label': 'Метка',
    'Sound': 'Звук',
    'Snooze': 'Отложить',
    'Snooze for': 'Отложить на',
    'Delete Alarm': 'Удалить будильник',
    'Pick a time for the alarm.': 'Выберите время будильника.',
    'Sunday': 'Воскресенье', 'Monday': 'Понедельник', 'Tuesday': 'Вторник', 'Wednesday': 'Среда',
    'Thursday': 'Четверг', 'Friday': 'Пятница', 'Saturday': 'Суббота',
    // the sleep schedule
    'Sleep Schedule': 'График сна',
    'Bedtime and a wake-up alarm on the days you pick': 'Отход ко сну и будильник в выбранные дни',
    'Bedtime': 'Отход ко сну',
    'Wake-up days': 'Дни пробуждения',
    'Wake-up alarm': 'Будильник пробуждения',
    'Bedtime reminder': 'Напоминание о сне',
    'A soft chime at bedtime, if Clock is open': 'Тихий сигнал перед сном, если Часы открыты',
    'Skip the next wake-up': 'Пропустить следующее пробуждение',
    // sounds
    'Twin Bell': 'Двойной звонок',
    'A wind-up alarm clock': 'Механический будильник',
    'Telephone': 'Телефон',
    'A desk phone’s bell': 'Звонок настольного телефона',
    'Chimes': 'Перезвон',
    'A mantel clock’s quarter chime': 'Бой каминных часов',
    'Marimba': 'Маримба',
    'A bright little tune': 'Весёлая мелодия',
    'Beacon': 'Маяк',
    'Three short beeps': 'Три коротких сигнала',
    'Sunrise': 'Восход',
    'Soft and rising, for gentle mornings': 'Тихо и нарастая, для спокойного утра',
    'Your phone didn’t play it. Check the volume and try again.': 'Телефон не воспроизвёл звук. Проверьте громкость и попробуйте снова.',
    // Stopwatch
    'Switch between digital and analog': 'Переключить цифровой и аналоговый вид',
    'Digital': 'Цифровой',
    'Analog': 'Аналоговый',
    'Lap': 'Круг',
    'Reset': 'Сброс',
    'Start': 'Старт',
    'Stop': 'Стоп',
    'Fastest': 'Самый быстрый',
    'Slowest': 'Самый медленный',
    // Timers
    'Hours': 'Часы',
    'Minutes': 'Минуты',
    'Seconds': 'Секунды',
    'hours': 'ч',
    'hour': 'ч',
    'min': 'мин',
    'sec': 'сек',
    'Quick lengths': 'Быстрый выбор',
    'Timer': 'Таймер',
    'When Timer Ends': 'По окончании',
    'Recents': 'Недавние',
    'Clear': 'Очистить',
    'Recents cleared.': 'Недавние очищены.',
    'Remove from Recents': 'Убрать из недавних',
    '· Paused': '· Пауза',
    // ringing
    'Undo': 'Отменить',
    'Tap anywhere to hear it.': 'Коснитесь экрана, чтобы услышать.',
    'Rang for 15 minutes.': 'Звонил 15 минут.',
    // Nightstand
    'Close Nightstand': 'Закрыть ночные часы',
    'Clock face or numbers': 'Циферблат или цифры',
    'No alarm set': 'Будильник не установлен',
    'Screen stays on: keep your phone on charge.': 'Экран не гаснет: держите телефон на зарядке.',
    'Set Auto-Lock to Never tonight, or alarms may not ring.': 'Поставьте автоблокировку на «Никогда», иначе будильник может не зазвонить.',
    // Settings
    'Design': 'Дизайн',
    'Vintage': 'Винтаж',
    'Mid-century colours and starburst clock faces': 'Цвета середины века и циферблаты-звёзды',
    'Standard': 'Стандарт',
    'Sea glass, like the other aOS apps': 'Морское стекло, как в других приложениях aOS',
    'Night Drive': 'Ночная трасса',
    '80s neon: a striped sunset, magenta and cyan': 'Неон 80-х: закат в полоску, пурпурный и бирюзовый',
    'Folk': 'Народный',
    'Gzhel by day, Khokhloma by night': 'Днём гжель, ночью хохлома',
    'Tron': 'Трон',
    'Light cycles: red light on a black grid': 'Световые мотоциклы: красный свет на чёрной сетке',
    'City': 'Город',
    '24-Hour Time': '24-часовой формат',
    '13:00 rather than 1:00 PM': '13:00 вместо 1:00 PM',
    'Show seconds': 'Показывать секунды',
    'Clock face': 'Циферблат',
    'Hands rather than numbers': 'Стрелки вместо цифр',
    'Test the sound': 'Проверить звук',
  }, [
    // durations alone: the quick lengths, snooze lengths, a timer without a label
    [re(DUR), m => dur(m[0])],
    [re('(' + DUR + ') timer'), m => 'Таймер ' + dur(m[1])],
    // World Clock: "Today, 5 hr ahead", "Tomorrow, 9½ hr ahead", "Today, same time"
    [re('(Today|Tomorrow|Yesterday), (?:same time|(' + DUR + ') (ahead|behind))'), m => ({ Today: 'Сегодня', Tomorrow: 'Завтра', Yesterday: 'Вчера' })[m[1]] + ', ' + (m[2] ? (m[3] === 'ahead' ? '+' : '−') + dur(m[2]) : 'то же время')],
    [re('(.+) · (' + DUR + ') (ahead of|behind) this phone'), m => m[1] + ' · ' + (m[3] === 'behind' ? '−' : '+') + dur(m[2]) + ' от этого телефона'],
    [/^(.+), as now$/, m => aosLang.t(m[1]) + ', как сейчас'],
    [/^No cities match “(.+)”\.$/, m => 'Нет городов по запросу «' + m[1] + '».'],
    [/^(.+) removed\.$/, m => 'Город ' + m[1] + ' удалён.'],
    [/^The main clock shows (.+)\.$/, m => 'Основные часы показывают ' + (m[1] === 'this phone’s time' ? 'время этого телефона' : m[1]) + '.'],
    [/^Remove (.+)$/, m => 'Удалить ' + m[1]],
    [/^Move (.+): use the up and down arrow keys, or drag$/, m => 'Переместить ' + m[1] + ': стрелки вверх и вниз или перетаскивание'],
    [/^(.+) \(this phone\)$/, m => aosLang.t(m[1]) + ' (этот телефон)'],
    // the header
    [re('Next alarm in (' + DUR + ')'), m => 'Следующий будильник через ' + dur(m[1])],
    [/^(\d+) timers? running$/, m => (+m[1] % 10 === 1 && +m[1] % 100 !== 11 ? 'Идёт ' : 'Идут ') + P(m[1], 'таймер', 'таймера', 'таймеров')],
    // Alarms: the sleep card, the list
    [re('Wake Up · (Off|No days picked|Skipping (.+)|' + REP + ')'), m => 'Пробуждение · ' + (m[1] === 'Off' ? 'выкл.' : m[1] === 'No days picked' ? 'дни не выбраны' : m[2] ? 'пропуск ' + when(m[2]) : repL(m[1]))],
    [re('Bedtime (' + T + ') · (' + DUR + ') of sleep( ·)?'), m => 'Отход ко сну в ' + m[1] + ' · ' + dur(m[2]) + ' сна' + (m[3] || '')],
    [re('Snoozed until (' + T + ')(\\.?)'), m => 'Отложено до ' + m[1] + m[2]],
    [re('(Alarm)?(?:, ' + REP + ')?( ·)?'), m => (m[1] ? 'Будильник' : '') + (m[2] ? ', ' + repL(m[2]) : '') + (m[3] || '')],
    [re('(Delete|Edit) the (' + T + ') alarm'), m => (m[1] === 'Delete' ? 'Удалить' : 'Изменить') + ' будильник на ' + m[2]],
    [re('(' + T + ') alarm'), m => m[1] + ', будильник'],
    [re('(Alarm|Wake-up alarm) set for (' + DUR + ') from now\\.'), m => (m[1] === 'Alarm' ? 'Будильник' : 'Будильник пробуждения') + ' зазвонит через ' + dur(m[2]) + '.'],
    [re('(ended|came due) (.+) while Clock was closed\\.'), m => (m[1] === 'ended' ? 'закончился ' : 'сработал ') + past(m[2]) + ', пока Часы были закрыты.'],
    [re('(.+) (ended|came due) (.+), while Clock was closed\\.'), m => lab(m[1]) + (m[2] === 'ended' ? ' закончился ' : ' сработал ') + past(m[3]) + ', пока Часы были закрыты.'],
    // the alarm editor and the sleep schedule
    [re('Repeat: ' + REP), m => 'Повтор: ' + repL(m[1])],
    [re('(' + DUR + ') of sleep · wake up (every day|on no days|' + REP + ')'), m => dur(m[1]) + ' сна · подъём ' + (m[2] === 'every day' ? 'каждый день' : m[2] === 'on no days' ? 'не выбран' : repL(m[2]))],
    [/^Skip the next wake-up \((.+)\)$/, m => 'Пропустить следующее пробуждение (' + when(m[1]) + ')'],
    [/^The (.+) wake-up is skipped\.$/, m => 'Пробуждение ' + when(m[1]) + ' пропущено.'],
    [re('Bedtime: (' + T + ')\\. Your wake-up is (.+)\\.'), m => 'Пора спать: ' + m[1] + '. ' + (m[2] === 'off' ? 'Будильник пробуждения выключен.' : 'Пробуждение ' + when(m[2]) + '.')],
    // the stopwatch
    [/^Lap (\d+)$/, m => 'Круг ' + m[1]],
    // timers
    [/^(Cancel|Pause|Resume) the (.+) timer$/, m => ({ Cancel: 'Отменить', Pause: 'Приостановить', Resume: 'Продолжить' })[m[1]] + ' таймер ' + (new RegExp('^' + DUR + '$').test(m[2]) ? dur(m[2]) : '«' + m[2] + '»')],
    [/^Start (.+)$/, m => 'Запустить ' + (new RegExp('^' + DUR + '$').test(m[1]) ? dur(m[1]) : '«' + m[1] + '»')],
    // ringing
    [re('(?:Ended at (' + T + ')(\\.)?)( Tap anywhere to hear it\\.)?'), m => 'Закончился в ' + m[1] + (m[2] || '') + (m[3] ? ' Коснитесь экрана, чтобы услышать.' : '')],
    [/^Snooze (\d+) min$/, m => 'Отложить на ' + m[1] + ' мин'],
    [/^(\d+) more waiting$/, m => 'Ещё ' + m[1] + ' в очереди'],
    // Nightstand: the next alarm, after its label
    [re('(' + T + ') tomorrow'), m => 'завтра в ' + m[1]],
    [re('([^\\x00-\\x7F]+\\.?) (' + T + ')'), m => m[1] + ' в ' + m[2]],
    // Settings
    [/^Playing (.+)\.$/, m => 'Звучит «' + aosLang.t(m[1]) + '».'],
  ]);
})();
