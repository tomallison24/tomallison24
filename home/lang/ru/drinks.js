// Russian for Drinks (drinks/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
  // the kinds and the preset drinks (calc.js); a name the family typed stays as written (translate="no")
  const DR = { Beer: 'Пиво', Wine: 'Вино', Spirits: 'Крепкое', Cocktail: 'Коктейль', Seltzer: 'Сельтцер', Cider: 'Сидр', Other: 'Другое',
    'Large wine': 'Большой бокал вина', Shot: 'Шот', 'Hard seltzer': 'Хард-сельтцер' };
  const DOW = { Sunday: 'Воскресенье', Monday: 'Понедельник', Tuesday: 'Вторник', Wednesday: 'Среда', Thursday: 'Четверг', Friday: 'Пятница', Saturday: 'Суббота' };
  const DOWS = { Sundays: 'По воскресеньям', Mondays: 'По понедельникам', Tuesdays: 'По вторникам', Wednesdays: 'По средам', Thursdays: 'По четвергам', Fridays: 'По пятницам', Saturdays: 'По субботам' };
  const t = s => aosLang.t(s);
  const nm = n => DR[n] || n;
  const num = s => String(s).replace(/(\d) (?=\d)/g, '$1 ');
  // Russian plurals; a fraction takes the second form (2,5 напитка)
  const pl = (n, one, few, many) => /[.,]\d/.test(String(n)) ? few : aosLang.plural(String(n).replace(/\D/g, '') || '0', one, few, many);
  const P = (n, one, few, many) => num(n) + ' ' + pl(n, one, few, many);
  // after "из" or "больше": из 1 дня, из 3 дней
  const gen = (n, one, many) => { const k = parseInt(String(n).replace(/\D/g, ''), 10) || 0; return num(n) + ' ' + (k % 10 === 1 && k % 100 !== 11 ? one : many); };
  const SD = n => P(n, 'стандартный напиток', 'стандартных напитка', 'стандартных напитков');
  const SDg = n => gen(n, 'стандартного напитка', 'стандартных напитков');
  const DAYS = n => P(n, 'день', 'дня', 'дней');
  const WEEKS = n => P(n, 'неделя', 'недели', 'недель');
  const N = '(\\d[\\d .,]*?)';
  const BEFORE = { 'the 7 days before': 'чем за 7 дней до этого', 'the 4 weeks before': 'чем за 4 недели до этого' };
  const ago = s => { let m; if (s === 'just now') return 'только что'; if ((m = /^(\d+) min ago$/.exec(s))) return m[1] + ' мин назад'; if ((m = /^(\d+) h ago$/.exec(s))) return m[1] + ' ч назад'; if ((m = /^(\d+) days ago$/.exec(s))) return DAYS(m[1]) + ' назад'; return s; };

  aosLang.add(Object.assign({}, DR, DOW, DOWS, {
    'Drinks': 'Напитки', 'Drinks can’t be opened inside another page.': 'Напитки нельзя открыть внутри другой страницы.',
    'Today': 'Сегодня', 'Done': 'Готово', 'Close': 'Закрыть', 'Cancel': 'Отмена', 'Undo': 'Отменить', 'Save': 'Сохранить', 'Add': 'Добавить', 'Saved': 'Сохранено',
    'Syncing': 'Синхронизация', 'Synced': 'Синхронизировано', 'Show a view': 'Выбрать раздел', 'Show': 'Показать', 'Sign in with Face ID': 'Войти с Face ID',
    'This week': 'Эта неделя', 'Last week': 'Прошлая неделя', 'Previous week': 'Предыдущая неделя', 'Next week': 'Следующая неделя',
    'Account, goals and your data': 'Профиль, цели и данные', 'Analysis': 'Анализ', 'Back to the week': 'Назад к неделе', 'Analysis view': 'Раздел анализа',
    'Log a drink today': 'Записать напиток за сегодня',
    // the week
    'Alcohol-free': 'Без алкоголя', 'Not logged': 'Не отмечено', 'Nothing yet': 'Пока ничего', 'not yet': 'ещё нет',
    'standard drinks': 'стандартных напитков', 'standard drink': 'стандартный напиток',
    // a day
    'That day hasn’t come yet.': 'Этот день ещё не наступил.', 'Total': 'Всего', 'Alcohol-free day': 'День без алкоголя',
    'Add another': 'Добавить ещё', 'Had a drink?': 'Выпили что-нибудь?', 'Something else…': 'Другой напиток…',
    'Change this drink': 'Изменить напиток', 'Something else': 'Другой напиток', 'Kind of drink': 'Вид напитка', 'Name': 'Название',
    'Size': 'Объём', 'Unit': 'Единица', 'ml': 'мл', 'Strength': 'Крепость', 'How many': 'Сколько', 'Time': 'Время', 'optional': 'необязательно',
    'Note (optional)': 'Заметка (необязательно)', 'Note': 'Заметка',
    // More
    'In the family’s Google Sheet': 'В семейной Google-таблице', 'Syncing…': 'Синхронизация…', 'On this phone only': 'Только на этом телефоне',
    'Sign in to sync your log.': 'Войдите, чтобы синхронизировать записи.', 'Offline': 'Нет сети', 'Couldn’t sync just now': 'Сейчас не удалось синхронизировать',
    'Your log is safe on this phone. Trying again shortly.': 'Записи в сохранности на этом телефоне. Скоро попробуем снова.', 'Checking…': 'Проверка…',
    'Your goals': 'Ваши цели', 'A week, at most': 'В неделю, не больше', 'A day, at most': 'В день, не больше', 'Alcohol-free days a week': 'Дней без алкоголя в неделю',
    'No limit': 'Без лимита', 'Your data': 'Ваши данные', 'Bring in ABV Tracker history': 'Перенести историю из ABV Tracker',
    'JSON backup or Log tab CSV': 'Резервная копия JSON или CSV вкладки Log', 'Export': 'Экспорт', 'As a CSV spreadsheet': 'Таблицей CSV',
    'Delete all data': 'Удалить все данные', 'From this phone': 'С этого телефона', 'From this phone and the Sheet': 'С этого телефона и из таблицы',
    'Tap again to delete everything': 'Нажмите ещё раз, чтобы удалить всё', 'Deleting…': 'Удаление…',
    'Signed in. Syncing your log.': 'Вход выполнен. Синхронизируем записи.',
    'No passkey found, or canceled. Set up your account in aOS first.': 'Ключ входа не найден, или вход отменён. Сначала настройте профиль в aOS.',
    'Couldn’t sign in.': 'Не удалось войти.',
    'Couldn’t reach the family’s Google Sheet, so nothing was deleted. Try again when you’re online.': 'Не удалось связаться с семейной Google-таблицей, поэтому ничего не удалено. Повторите, когда будет связь.',
    'Sign in first, to delete your log from the family’s Google Sheet too.': 'Сначала войдите, чтобы удалить записи и из семейной Google-таблицы.',
    'That CSV isn’t the ABV Tracker’s Log tab.': 'Этот CSV — не вкладка Log из ABV Tracker.', 'That file isn’t an ABV Tracker backup or Log.': 'Этот файл — не резервная копия и не Log из ABV Tracker.',
    'Nothing new: it’s all here already.': 'Ничего нового: всё уже здесь.',
    'This phone couldn’t save Drinks: its storage is full.': 'Телефон не смог сохранить Напитки: память заполнена.',
    'This phone couldn’t save Drinks: its storage is full. Your log is safe in the family’s Google Sheet.': 'Телефон не смог сохранить Напитки: память заполнена. Ваши записи в сохранности в семейной Google-таблице.',
    'The family’s Drinks Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.': 'Семейная таблица Напитков ещё не настроена. Владелец настраивает её в aOS: Профиль → Google Таблицы.',
    'aOS’s phrase for the Drinks Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.': 'Фраза aOS для таблицы Напитков больше не совпадает с её скриптом. Владелец обновляет её в aOS: Профиль → Google Таблицы.',
    'The Drinks Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).': 'У таблицы Напитков всё ещё старый скрипт. Владелец вставляет новый и публикует новую версию (aOS/SHEETS.md).',
    'The Drinks Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.': 'В скрипте таблицы Напитков всё ещё SECRET = ‘CHANGE-ME’. Владелец меняет его и публикует новую версию.',
    'The Sheet was busy. Trying again shortly.': 'Таблица была занята. Скоро попробуем снова.',
    'Offline. Changes will sync when you’re back online.': 'Нет сети. Изменения синхронизируются, когда связь вернётся.',
    'Couldn’t reach the Sheet. Trying again later.': 'Не удалось связаться с таблицей. Попробуем позже.',
    'The Sheet didn’t answer as expected. Trying again later.': 'Таблица ответила не так, как ожидалось. Попробуем позже.',
    'Sync didn’t work. Trying again later.': 'Синхронизация не удалась. Попробуем позже.',
    // Analysis
    'Nothing to chart yet': 'Пока нечего показать', 'Log a few days to start.': 'Запишите несколько дней, чтобы начать.', 'Nothing logged yet': 'Пока ничего не записано',
    'Compared with before': 'Сравнение с прошлым', 'Weekly drinks': 'Напитки по неделям', 'Weeks over the limit': 'Недели сверх лимита', 'Top drinks': 'Любимые напитки',
    'Days of the week': 'Дни недели', 'Alcohol-free days': 'Дни без алкоголя', 'Days over the limit': 'Дни сверх лимита', 'Strength and size': 'Крепость и объём',
    'No weekly limit set': 'Недельный лимит не задан', 'No goal set': 'Цель не задана', 'No daily limit set': 'Дневной лимит не задан',
    'Week': 'Неделя', 'Month': 'Месяц', 'Compare': 'Сравнение', 'Nothing to compare yet': 'Пока не с чем сравнить',
    'nothing before': 'раньше ничего', 'same as before': 'как раньше', 'not known': 'неизвестно', 'better': 'лучше', 'worse': 'хуже',
    'Standard drinks': 'Стандартные напитки', 'Days you drank': 'Дни с алкоголем', 'A day, on average': 'В среднем за день',
    'Alcohol-free in a row': 'Без алкоголя подряд', 'Most in one day': 'Больше всего за день', 'Days not logged': 'Не отмечено дней', 'By drink': 'По напиткам',
    'nothing logged': 'ничего не записано', 'Nothing logged': 'Ничего не записано', 'none logged': 'нет записей', 'no drinks': 'нет напитков', 'so far': 'пока',
    'Average a week': 'В среднем за неделю', 'no finished weeks yet': 'полных недель пока нет', 'Weeks over your limit': 'Недели сверх лимита',
    'no weekly limit set': 'недельный лимит не задан', 'Highest week': 'Максимум за неделю', 'Lowest week': 'Минимум за неделю',
    'Over your limit (▲)': 'Сверх лимита (▲)', 'Lighter: this week so far': 'Светлее: эта неделя, пока', '4-week average': 'Среднее за 4 недели', 'Weekly limit': 'Недельный лимит',
    'Show as a table': 'Показать таблицей', 'Std drinks': 'Ст. напитки', '4-wk avg': 'Сред. за 4 нед.', 'not logged': 'не отмечено',
    'Set one in More.': 'Задайте его в меню профиля.', 'so far, under': 'пока в пределах', 'over': 'сверх', 'under': 'в пределах',
    'Weeks over': 'Недели сверх лимита', 'Under your limit': 'В пределах лимита', 'Running under now': 'Подряд в пределах', 'in a row': 'подряд', 'Best run under': 'Лучшая серия',
    '✓ under your limit · ▲ over · … this week so far, under it · – nothing logged': '✓ в пределах лимита · ▲ сверх · … эта неделя пока в пределах · – ничего не записано',
    'By name': 'По названию', 'By kind': 'По виду', 'Group drinks by': 'Группировать напитки', 'adds up to the most:': 'больше всего набирает:',
    'Had most often': 'Чаще всего', 'Adds up to the most': 'Больше всего алкоголя', 'Drink': 'Напиток',
    'Sun': 'Вс', 'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб',
    'Heaviest day': 'Больше всего', 'Lightest day': 'Меньше всего', 'Tap a day to see it.': 'Нажмите на день, чтобы увидеть его.',
    'Average standard drinks on each day of the week': 'Среднее число стандартных напитков по дням недели',
    'Average on that day': 'Среднее за этот день', 'Over your daily limit (▲)': 'Сверх дневного лимита (▲)', 'Daily limit': 'Дневной лимит',
    'Day': 'День', 'Average': 'Среднее', 'Share': 'Доля', 'Days drank': 'Дни с алкоголем', 'standard drinks on average': 'стандартных напитков в среднем',
    'Alcohol-free days each week': 'Дни без алкоголя по неделям', 'Goal met': 'Цель выполнена', 'no goal set': 'цель не задана', 'alcohol-free days': 'дней без алкоголя',
    'now': 'сейчас', 'Your best': 'Ваш рекорд', 'Your goal': 'Ваша цель', 'Drank on': 'С алкоголем',
    'Days over your daily limit each week': 'Дни сверх дневного лимита по неделям', 'Days over': 'Дни сверх лимита', 'Weeks with none': 'Недели без превышений',
    'of the finished weeks': 'из полных недель', 'Most in a week': 'Максимум за неделю', 'Your daily limit': 'Ваш дневной лимит', 'Days over your daily limit': 'Дни сверх дневного лимита',
    'average strength': 'средняя крепость', 'standard drinks in an average drink': 'стандартных напитков в среднем напитке',
    'Average strength each week, in percent': 'Средняя крепость по неделям, в процентах', 'Standard drinks in an average drink, each week': 'Стандартных напитков в среднем напитке, по неделям',
    'Average strength': 'Средняя крепость', 'An average drink': 'Средний напиток', 'Average strength (ABV)': 'Средняя крепость (ABV)',
    'Standard drinks in an average drink': 'Стандартных напитков в среднем напитке', 'Each dot is a week': 'Каждая точка — неделя', 'Std per drink': 'Ст. на напиток',
  }), [
    // "This week · 18 окт. – 24 окт.", "12 oz · 5%", the readouts: each part on its own
    [/·/, m => m.input.split(/\s*·\s*/).map(x => x ? t(x) : x).join(' · ')],
    // the week's row, for VoiceOver: "суббота, 24 октября, 2,5 standard drinks"
    [/^([^A-Za-z]*[а-яё][^A-Za-z]*?), (.+)$/i, m => m[1] + ', ' + t(m[2])],
    [new RegExp('^' + N + ' standard drinks$'), m => SD(m[1])],
    [new RegExp('^' + N + ' ml$'), m => num(m[1]) + ' мл'],
    [/^(\d+) drinks?$/, m => P(m[1], 'напиток', 'напитка', 'напитков')],
    [/^(\d+) days?$/, m => DAYS(m[1])],
    [/^(\d+) weeks?$/, m => WEEKS(m[1])],
    [/^(\d+) alcohol-free days?$/, m => P(m[1], 'день без алкоголя', 'дня без алкоголя', 'дней без алкоголя')],
    [/^(\d+) of (\d+) alcohol-free days$/, m => m[1] + ' из ' + gen(m[2], 'дня без алкоголя', 'дней без алкоголя')],
    [/^(\d+) in a row$/, m => m[1] + ' подряд'],
    // the week's number
    [new RegExp('^' + N + ' standard drinks(?: of your (\\d+) a week)?\\. (.+)\\. Open analysis$'), m => SD(m[1]) + (m[2] ? ' из ' + m[2] + ' в неделю' : '') + '. ' + m[3].split(', ').map(t).join(', ') + '. Открыть анализ'],
    [/^of (\d+) standard drinks(, over your limit)?$/, m => 'из ' + SDg(m[1]) + (m[2] ? ', выше лимита' : '')],
    [/^standard drinks, over your limit$/, () => 'стандартных напитков, выше лимита'],
    // a day
    [/^Over your (\d+) a day$/, m => 'Выше лимита (' + m[1] + ' в день)'],
    [/^Add (.+), ([^,]+), ([\d.,]+%)$/, m => 'Добавить: ' + nm(m[1]) + ', ' + t(m[2]) + ', ' + m[3]],
    [/^(.+) \(or its name\)$/, m => nm(m[1]) + ' (или название)'],
    [/^Change (.+)$/, m => 'Изменить: ' + nm(m[1])],
    [/^Delete (.+)$/, m => 'Удалить: ' + nm(m[1])],
    [/^Added (.+)$/, m => 'Добавлено: ' + nm(m[1])],
    [/^Deleted (\d+) drinks? and your marked days\.$/, m => 'Удалено: ' + P(m[1], 'напиток', 'напитка', 'напитков') + ' и отмеченные дни.'],
    [/^Deleted (.+)$/, m => 'Удалено: ' + nm(m[1])],
    [/^Brought in (\d+) drinks? and (\d+) marked days?\.$/, m => 'Перенесено: ' + P(m[1], 'напиток', 'напитка', 'напитков') + ' и ' + P(m[2], 'отмеченный день', 'отмеченных дня', 'отмеченных дней') + '.'],
    // More
    [/^Last synced (.+)\.$/, m => 'Последняя синхронизация: ' + ago(m[1]) + '.'],
    // Analysis: the menu
    [/^Nothing logged in the last (\d+) days$/, m => 'За последние ' + m[1] + ' дней ничего'],
    [new RegExp('^Last (\\d+) days: ' + N + '(?: \\((up|down) ' + N + '\\))?$'), m => 'Последние ' + m[1] + ' дней: ' + m[2] + (m[3] ? ' (' + (m[3] === 'up' ? 'больше' : 'меньше') + ' на ' + m[4] + ')' : '')],
    [new RegExp('^' + N + ' a week on average$'), m => 'В среднем ' + m[1] + ' в неделю'],
    [/^(\d+) of (\d+) weeks over$/, m => m[1] + ' из ' + gen(m[2], 'недели', 'недель') + ' сверх лимита'],
    [/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)s the heaviest$/, m => DOWS[m[1] + 's'] + ' — больше всего'],
    [/^Goal met in (\d+) of (\d+) weeks$/, m => 'Цель выполнена в ' + m[1] + ' из ' + gen(m[2], 'недели', 'недель')],
    [/^(\d+) days? over (\d+) a day$/, m => DAYS(m[1]) + ' больше ' + m[2] + ' в день'],
    [/^([\d.,]+%) average strength$/, m => 'Средняя крепость ' + m[1]],
    [/^(.+) most often$/, m => nm(m[1]) + ' — чаще всего'],
    // compared with before
    [/^([^A-Za-z]+) against ([^A-Za-z]+)$/, m => m[1] + ' в сравнении с ' + m[2]],
    [new RegExp('^(up|down) ' + N + ' on (the 7 days before|the 4 weeks before), (better|worse)$'), m => (m[1] === 'up' ? 'больше на ' : 'меньше на ') + m[2] + ', ' + BEFORE[m[3]] + ', ' + t(m[4])],
    [/^Your best: (\d+) days?$/, m => 'Ваш рекорд: ' + DAYS(m[1])],
    [new RegExp('^([^:]+): ' + N + ' standard drinks$'), m => t(m[1]) + ': ' + SD(m[2])],
    [/^([^:]+): (\d[\d .,]*|—|not known), (.+)$/, m => t(m[1]) + ': ' + t(m[2]) + ', ' + t(m[3])],
    // the readouts and their VoiceOver labels (weekly, alcohol-free days, days over, strength, days of the week)
    [new RegExp('^(?:' + N + ' )?standard drinks( so far)?(,)?(?: ' + N + ' (over|under) your (\\d+))?$'), m => (m[1] ? SD(m[1]) : 'стандартных напитков') + (m[2] ? ' пока' : '') + (m[3] || m[4] ? ',' : '') + (m[4] ? ' на ' + m[4] + (m[5] === 'over' ? ' больше' : ' меньше') + ' лимита в ' + m[6] : '')],
    [new RegExp('^' + N + ' over$'), m => 'на ' + m[1] + ' больше'],
    [/^your (\d+)$/, m => 'лимита в ' + m[1]],
    [/^(\d+) days? not logged\.?$/, m => DAYS(m[1]) + ' не отмечено' + (m[0].endsWith('.') ? '.' : '')],
    [new RegExp('^4-week average ' + N + '$'), m => 'среднее за 4 недели ' + m[1]],
    [/^goal of (\d+) met ✓$/, m => 'цель ' + m[1] + ' выполнена ✓'],
    [/^(\d+) short of your (\d+)$/, m => 'до цели ' + m[2] + ' не хватает ' + m[1]],
    [/^drank on (\d+) of (\d+) logged$/, m => 'с алкоголем ' + m[1] + ' из ' + gen(m[2], 'отмеченного', 'отмеченных')],
    [/^drank on (\d+)$/, m => 'с алкоголем: ' + DAYS(m[1])],
    [/^(\d+) days? over (\d+) standard drinks( so far)?$/, m => DAYS(m[1]) + ' больше ' + SDg(m[2]) + (m[3] ? ' пока' : '')],
    [/^over (\d+) standard drinks( so far)?$/, m => 'больше ' + SDg(m[1]) + (m[2] ? ' пока' : '')],
    [new RegExp('^' + N + ' standard drinks on average$'), m => SD(m[1]) + ' в среднем'],
    [/^(\d+)% of everything$/, m => m[1] + '% от всего'],
    [/^([\d.,]+%) average strength$/, m => 'средняя крепость ' + m[1]],
    [new RegExp('^' + N + ' standard drinks in an average drink$'), m => SD(m[1]) + ' в среднем напитке'],
    [new RegExp('^' + N + ' so far$'), m => m[1] + ' пока'],
    [/^Standard drinks each week for the last (\d+) weeks$/, m => 'Стандартные напитки по неделям за последние ' + m[1] + ' недель'],
    [/^limit (\d+)$/, m => 'лимит ' + m[1]],
    [/^goal (\d+)$/, m => 'цель ' + m[1]],
    [/^limit (\d+) a week$/, m => 'лимит ' + m[1] + ' в неделю'],
    [/^goal (\d+) a week$/, m => 'цель ' + m[1] + ' в неделю'],
    [/^over (\d+) finished weeks?$/, m => 'за ' + P(m[1], 'полную неделю', 'полные недели', 'полных недель')],
    [/^(\d+) not logged$/, m => m[1] + ' не отмечено'],
    [/^in these (\d+)$/, m => 'за эти ' + m[1]],
    [/^by volume, all (\d+) weeks$/, m => 'по объёму, все ' + m[1] + ' недель'],
    [new RegExp('^' + N + ' on average$'), m => 'в среднем ' + m[1]],
    [new RegExp('^▲ ([+−]' + N + ') over$'), m => '▲ ' + m[1] + ' сверх'],
    [new RegExp('^✓ ' + N + ' under$'), m => '✓ на ' + m[1] + ' меньше'],
    [new RegExp('^… ' + N + ' to go$'), m => '… ещё ' + m[1]],
    [new RegExp('^(over|under) by ' + N + '$'), m => (m[1] === 'over' ? 'больше на ' : 'меньше на ') + m[2]],
    // top drinks
    [/^No drinks in these (\d+) weeks$/, m => 'За эти ' + m[1] + ' недель напитков нет'],
    [/^In the last (\d+) weeks you had$/, m => 'За последние ' + m[1] + ' недель чаще всего вы пили'],
    [/^most often \((\d+) drinks?\)(, and it’s also what adds up to the most:|, but)$/, m => '(' + P(m[1], 'напиток', 'напитка', 'напитков') + ')' + (m[2] === ', but' ? ', но' : ', и больше всего алкоголя тоже в нём:')],
    [/^standard drinks, (\d+)% of all of them\.$/, m => 'стандартных напитков, ' + m[1] + '% от всех.'],
    [/^(\d+) others?$/, m => 'ещё ' + m[1]],
    [/^(\d+) other drinks?: (.+)$/, m => 'Другие напитки (' + m[1] + '): ' + t(m[2])],
    // days of the week
    [/^are your heaviest: (\S+) standard drinks on average, (\d+)% of all you drank in these (\d+) weeks\.$/, m => ' — больше всего: в среднем ' + SD(m[1]) + ', ' + m[2] + '% всего выпитого за эти ' + m[3] + ' недель.'],
    [/^([^:]+): (.+)$/, m => t(m[1]) + ': ' + m[2].split(', ').map(t).join(', ')],
  ]);
})();
