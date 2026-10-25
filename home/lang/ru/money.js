// Russian for Money (money/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
// Merchants, cards, banks and Monarch's categories come from the emails: they stay as written (translate="no").
'use strict';
(() => {
  const t = s => aosLang.t(s);
  const num = s => String(s).replace(/(\d),(?=\d{3})/g, '$1 ');
  const P = (n, one, few, many) => num(n) + ' ' + aosLang.plural(String(n).replace(/\D/g, '') || '0', one, few, many);
  const CHARGES = n => P(n, 'платёж', 'платежа', 'платежей');
  const TXS = n => P(n, 'операция', 'операции', 'операций');
  const DAYS = n => P(n, 'день', 'дня', 'дней');
  const AGO = { 'never': 'ни разу', 'just now': 'только что' };
  const ago = s => { if (AGO[s]) return AGO[s]; let m;
    if ((m = /^(\d+) min ago$/.exec(s))) return m[1] + ' мин назад';
    if ((m = /^(\d+) h ago$/.exec(s))) return m[1] + ' ч назад';
    if ((m = /^(\d+) days? ago$/.exec(s))) return DAYS(m[1]) + ' назад';
    return s; };
  const rate = s => s.split(', ').map(p => { let m;
    if ((m = /^([\d.]+)% online$/.exec(p))) return m[1] + '% онлайн';
    if ((m = /^([\d.]+)% groceries$/.exec(p))) return m[1] + '% на продукты';
    if ((m = /^([\d.]+)% else$/.exec(p))) return m[1] + '% на остальное';
    if ((m = /^([\d.]+)% on everything$/.exec(p))) return m[1] + '% на всё';
    return null; });
  aosLang.add({
    'Money': 'Деньги',
    'Read Monarch’s emails now': 'Прочитать письма Monarch сейчас',
    'Show a view': 'Выбрать вид', 'View': 'Вид', 'Show': 'Показать',
    'Transaction': 'Операция', 'Reading Gmail': 'Читаю Gmail',
    // the views
    'This month': 'Этот месяц', 'Spent, the usual, where to save': 'Расходы, обычный уровень, где сэкономить',
    'Transactions': 'Операции', 'Every one, and search': 'Все до одной, и поиск',
    'Cards and rewards': 'Карты и бонусы', 'Spending and cash back per card': 'Траты и кешбэк по картам',
    'Recurring': 'Регулярные', 'What repeats, and a year of it': 'Что повторяется, и сколько это в год',
    'Previous month': 'Предыдущий месяц', 'Next month': 'Следующий месяц',
    // empty
    'Reading Monarch’s emails…': 'Читаю письма Monarch…', 'The first time takes a minute.': 'В первый раз это займёт минуту.',
    'No Monarch emails yet': 'Писем от Monarch пока нет',
    'Money found no emails from Monarch in this Gmail. In Monarch, set the expense and deposit alerts to $1 (Settings, Notifications) and they’ll show here.': 'В этом Gmail нет писем от Monarch. В Monarch поставьте оповещения о расходах и поступлениях от $1 (Settings, Notifications), и они появятся здесь.',
    'Read Gmail again': 'Прочитать Gmail ещё раз',
    'See where your money goes': 'Узнайте, куда уходят деньги',
    'Money reads Monarch’s alert emails from your Gmail, read-only, and shows this month against the usual, each card’s spending and rewards, and what repeats.': 'Деньги читают письма-оповещения Monarch из вашего Gmail, только для чтения, и показывают этот месяц по сравнению с обычным, траты и бонусы по каждой карте и то, что повторяется.',
    'Money reads Monarch’s alert emails from your Gmail, read-only, and shows this month against the usual, each card’s spending and rewards, and what repeats. Already shared with you? Sign in with Face ID in Settings.': 'Деньги читают письма-оповещения Monarch из вашего Gmail, только для чтения, и показывают этот месяц по сравнению с обычным, траты и бонусы по каждой карте и то, что повторяется. С вами уже поделились? Войдите с Face ID в настройках.',
    'Connect Gmail': 'Подключить Gmail',
    // a bank Monarch can't sync
    'Sync problem': 'Проблема синхронизации', 'isn’t syncing with Monarch': 'не синхронизируется с Monarch', 'A bank isn’t syncing with Monarch': 'Банк не синхронизируется с Monarch',
    '. Transactions from it won’t show until it’s fixed.': '. Операции оттуда не появятся, пока это не исправят.',
    'Fix in Monarch': 'Исправить в Monarch', 'Fixed it': 'Исправлено', 'Marked fixed.': 'Отмечено как исправленное.',
    // this month
    'spent': 'потрачено', 'more than usual': 'больше обычного', 'less than usual': 'меньше обычного',
    'Usual:': 'Обычно:', 'Income': 'Доход', 'Left over': 'Осталось', 'At this rate:': 'В таком темпе:', 'by the end of the month': 'к концу месяца',
    'Where you could save': 'Где можно сэкономить', 'By category': 'По категориям', 'usual': 'обычно',
    'Nothing this month yet': 'В этом месяце пока ничего',
    'is well over its usual:': 'намного выше обычного:', 'against': 'против', 'on': 'на', 'use': 'берите', 'back': 'кешбэк',
    'is where the most went this month:': '— сюда ушло больше всего в этом месяце:',
    'add up to this a year. Any to cut?': '— столько в год. Что-то можно убрать?', 'a year': 'в год',
    'Online shopping': 'Покупки онлайн', 'Groceries and wholesale clubs': 'Продукты и оптовые клубы', 'Everything else': 'Всё остальное',
    // transactions
    'Search': 'Поиск', 'Search every transaction': 'Искать по всем операциям', 'Nothing found': 'Ничего не найдено', 'No transaction matches that.': 'Ни одна операция не подходит.',
    // cards and rewards
    'From Monarch’s summaries, which don’t say': 'Из сводок Monarch, где карта не указана', 'Bank account': 'Банковский счёт', 'Cash back not set': 'Кешбэк не задан',
    'Card not known': 'Карта неизвестна', 'On': 'С', 'By card': 'По картам', 'Rewards a month': 'Бонусы по месяцам',
    'Use the better card': 'Берите выгодную карту', 'Last 3 months': 'Последние 3 месяца', 'would earn': 'принесло бы',
    'Each card’s cash back is in Settings, Card rewards. A card with a ? was guessed from where you usually use it.': 'Кешбэк каждой карты — в настройках, «Бонусы карт». Карта со знаком ? угадана по тому, где вы ей обычно платите.',
    'Show as a table': 'Показать таблицей', 'Month': 'Месяц', 'Total': 'Итого', 'Rewards': 'Бонусы',
    // recurring
    'Weekly': 'Еженедельно', 'Every 2 weeks': 'Раз в 2 недели', 'Monthly': 'Ежемесячно', 'Every 3 months': 'Раз в 3 месяца', 'Yearly': 'Ежегодно',
    'last': 'последний', ', from what Monarch emailed': ', по письмам Monarch',
    'Nothing recurring found yet': 'Регулярных платежей пока не найдено',
    'A charge shows here once the same amount has come from the same place at a steady rhythm three times.': 'Платёж появится здесь, когда одна и та же сумма придёт из одного места в ровном ритме три раза.',
    'Stopped?': 'Прекратились?', 'Monarch found these too': 'Monarch нашёл ещё эти',
    'Until Monarch has emailed every charge for a few months, only the bigger bills can show here.': 'Пока Monarch не присылал каждый платёж хотя бы несколько месяцев, здесь видны только крупные счета.',
    // a transaction
    'Into': 'Куда', 'Card': 'Карта', 'Not known': 'Неизвестно', 'Category': 'Категория', 'Cash back': 'Кешбэк',
    '(probably: Monarch’s summary didn’t say)': '(вероятно: в сводке Monarch не указано)', 'over the bonus limit': 'сверх лимита бонуса',
    'Not set for this card': 'Не задан для этой карты', 'From': 'Откуда', 'Monarch’s summary email': 'Сводка Monarch', 'Monarch’s alert email': 'Оповещение Monarch',
    'Open in Monarch': 'Открыть в Monarch', 'The email': 'Письмо',
    // Settings
    'Settings': 'Настройки', 'Design': 'Дизайн',
    'On this phone only': 'Только на этом телефоне',
    'Sign in with Face ID to share Money with your family, or to see it if it’s shared with you.': 'Войдите с Face ID, чтобы поделиться Деньгами с семьёй или увидеть их, если с вами поделились.',
    'Checking…': 'Проверяю…', 'You read Monarch’s emails for the family': 'Вы читаете письма Monarch для семьи', 'Not shared with anyone yet.': 'Пока ни с кем не поделились.',
    'Nobody reads Monarch’s emails yet': 'Письма Monarch пока никто не читает', 'Connect Gmail on the phone that gets them.': 'Подключите Gmail на телефоне, куда они приходят.',
    'Sign in with Face ID': 'Войти с Face ID', 'Monarch’s emails': 'Письма Monarch', 'Gmail connected': 'Gmail подключён',
    'Read now': 'Прочитать сейчас', 'Read the last 5 years again': 'Прочитать последние 5 лет заново', 'Every Monarch email, from the start': 'Все письма Monarch, с самого начала',
    'Disconnect Gmail': 'Отключить Gmail', 'Gmail not connected': 'Gmail не подключён',
    'Money reads Monarch’s alert emails, read-only: it can’t change or send anything.': 'Деньги читают письма-оповещения Monarch только для чтения: ничего не могут изменить или отправить.',
    'In Monarch, set the expense and deposit alerts to $1 (Settings, Notifications), so every transaction is emailed.': 'В Monarch поставьте оповещения о расходах и поступлениях от $1 (Settings, Notifications), чтобы приходило письмо о каждой операции.',
    'Who sees Money': 'Кто видит Деньги', 'Nobody else is in the family yet.': 'В семье пока больше никого нет.',
    'Only you, and those you tick, see Money. Not even the family’s owner otherwise.': 'Деньги видите только вы и те, кого вы отметите. Даже владелец семьи — только если вы его отметите.',
    'Card rewards': 'Бонусы карт', 'On everything': 'На всё', 'Bonus on the first, a quarter': 'Бонус на первые, за квартал',
    'Set from what you said: Robinhood 3% on everything; Customized Cash 6% online, and Bank of America’s 2% at grocery stores and wholesale clubs and 1% else, the bonus on the first $2,500 a quarter. Check them against your cards’ terms. 0 for the bonus limit means none.': 'Заданы с ваших слов: Robinhood — 3% на всё; Customized Cash — 6% онлайн, а также 2% Bank of America в продуктовых и оптовых клубах и 1% на остальное, бонус на первые $2 500 за квартал. Сверьте с условиями своих карт. 0 в лимите бонуса — без лимита.',
    'Online stores': 'Онлайн-магазины', 'What counts as online shopping for the card rates, separated by commas.': 'Что считается покупками онлайн для ставок карт, через запятую.',
    'Your data': 'Ваши данные', 'Export': 'Экспорт', 'As a CSV spreadsheet': 'Таблицей CSV', 'Delete all data': 'Удалить все данные',
    'From this phone, and aOS for everyone it’s shared with': 'С этого телефона и из aOS для всех, с кем поделились', 'From this phone': 'С этого телефона',
    'Tap again to delete everything': 'Нажмите ещё раз, чтобы удалить всё',
    // toasts
    'Gmail disconnected. What Money read stays.': 'Gmail отключён. Прочитанное остаётся.', 'Up to date': 'Всё актуально', 'Nothing new from Monarch.': 'От Monarch ничего нового.',
    'Gmail needs you to sign in again: Settings, Connect Gmail.': 'Gmail просит войти снова: Настройки, «Подключить Gmail».', 'Couldn’t read Gmail.': 'Не удалось прочитать Gmail.',
    'No connection to Gmail': 'Нет связи с Gmail', 'Gmail asked to slow down. Try again in a minute.': 'Gmail просит притормозить. Повторите через минуту.',
    'Couldn’t reach aOS just now. Money is safe on this phone.': 'Сейчас не удалось связаться с aOS. Данные в безопасности на этом телефоне.',
    'Signed in.': 'Вы вошли.', 'No passkey found, or canceled. Set up your account in aOS first.': 'Ключ входа не найден или вход отменён. Сначала создайте профиль в aOS.', 'Couldn’t sign in.': 'Не удалось войти.',
    'Couldn’t change that just now. Try again.': 'Сейчас не удалось это изменить. Повторите.',
    'Couldn’t reach aOS, so nothing was deleted. Try again when you’re online.': 'Не удалось связаться с aOS, поэтому ничего не удалено. Повторите, когда будет интернет.',
    'Gmail access was declined.': 'Доступ к Gmail отклонён.', 'Gmail needs one tap to sign in again: Settings, Connect Gmail.': 'Gmail просит снова войти: Настройки, «Подключить Gmail».',
    'This phone couldn’t save Money: its storage is full.': 'Телефону не удалось сохранить Деньги: память заполнена.',
    'Money can’t be opened inside another page.': 'Деньги нельзя открыть внутри другой страницы.',
    // Ipsy's daily check
    'Corrected': 'Исправлено', 'Check': 'Проверить', 'Checked': 'Проверка', 'Not yet': 'Пока нет',
    'Ipsy checked it against the email': 'Ипси сверил с письмом', 'You kept the app’s reading': 'Вы оставили прочитанное приложением',
    'Ipsy couldn’t confirm it against the email': 'Ипси не смог сверить с письмом', 'Ipsy corrected it from the email:': 'Ипси исправил по письму:',
    'Amount': 'Сумма', 'In or out': 'Приход или расход', 'Merchant': 'Получатель', 'Money in': 'Приход', 'Money out': 'Расход',
    'Undo Ipsy’s correction': 'Отменить исправление Ипси', 'The app’s reading is back.': 'Прочитанное приложением возвращено.',
    'Ipsy’s check': 'Проверка Ипси', 'Ipsy’s daily check': 'Ежедневная проверка Ипси', 'Check each day': 'Проверять каждый день',
    'Ipsy reads each new transaction’s Monarch email this month, and checks the amount, merchant, card and category': 'Ипси читает письмо Monarch о каждой новой операции этого месяца и сверяет сумму, получателя, карту и категорию',
    'Last checked': 'Последняя проверка', 'Not checked yet.': 'Ещё не проверялось.', 'Check now': 'Проверить сейчас',
    'What passed is never checked again. It uses Claude Sonnet 5.5: a few cents a month.': 'Проверенное больше не проверяется. Работает на Claude Sonnet 5.5: несколько центов в месяц.',
    'Connect Gmail first, so Ipsy can read the emails.': 'Сначала подключите Gmail, чтобы Ипси мог читать письма.',
    'Only the phone that reads Monarch’s emails can check them.': 'Проверять может только телефон, который читает письма Monarch.',
    'Nothing new to check this month.': 'В этом месяце нечего проверять.', 'Ipsy is checking': 'Ипси проверяет', 'Nothing checked': 'Ничего не проверено',
    'Ipsy isn’t set up in aOS yet (its key).': 'Ипси ещё не настроен в aOS (нет ключа).', 'Ipsy couldn’t check just now. Try again later.': 'Ипси сейчас не смог проверить. Повторите позже.',
    // your own categories, and Ipsy's ideas for them
    'Monarch said:': 'По данным Monarch:', 'Change': 'Изменить', 'Move to': 'Перенести в', 'New category': 'Новая категория', 'Use it': 'Выбрать',
    'Always for': 'Всегда для', 'Its other transactions too, and those to come': 'И для других его операций, и для будущих', '(Monarch’s)': '(из Monarch)',
    'Its category was merged into another: Settings, Categories.': 'Её категория объединена с другой: Настройки, «Категории».',
    'Give the new category a name.': 'Дайте новой категории название.', 'Back to Monarch’s category.': 'Возвращена категория из Monarch.',
    'Ipsy won’t suggest that again.': 'Ипси больше не предложит это.',
    'Ipsy’s ideas for your categories': 'Идеи Ипси для ваших категорий', 'Merge': 'Объединить', 'into': 'с', 'Move': 'Перенести', 'to': 'в',
    'Accept': 'Принять', 'No thanks': 'Нет, спасибо', 'Ipsy is looking': 'Ипси смотрит', 'No ideas': 'Идей нет',
    'Sign in, and have Money shared with you, to ask Ipsy.': 'Чтобы спросить Ипси, войдите, и пусть с вами поделятся Деньгами.',
    'Nothing spent in the last year to look at.': 'За последний год нет расходов, на которые можно посмотреть.',
    'Ipsy’s ideas are on This month.': 'Идеи Ипси — на экране «Этот месяц».', 'No ideas this time: your categories look clear.': 'В этот раз идей нет: категории и так понятные.',
    'That’s all Ipsy’s ideas for today. Try again tomorrow.': 'На сегодня идей Ипси больше нет. Повторите завтра.', 'Ipsy couldn’t look just now. Try again later.': 'Ипси сейчас не смог посмотреть. Повторите позже.',
    'Categories': 'Категории', 'Category merged': 'Категория объединена', 'Always for this merchant': 'Всегда для этого получателя', 'Remove': 'Удалить',
    'Monarch’s categories, as its emails say. Change one from a transaction: tap it, then Change.': 'Категории из писем Monarch. Чтобы изменить, нажмите на операцию, затем «Изменить».',
    'changed on its own': 'изменены по отдельности', 'Ask Ipsy for ideas': 'Спросить идеи у Ипси', 'Categories to merge, and merchants to move': 'Какие категории объединить и каких получателей перенести',
    'Shared with whoever sees Money. Once a month Ipsy also looks on its own; nothing changes until you accept an idea. It uses Claude Sonnet 5.5: under a cent each time.': 'Видно всем, кто видит Деньги. Раз в месяц Ипси смотрит и сам; ничего не меняется, пока вы не примете идею. Работает на Claude Sonnet 5.5: меньше цента за раз.',
    'Removed: Monarch’s categories are back for it.': 'Удалено: для него вернулись категории из Monarch.',
  }, [
    [/^Every (.+) is (.+) now\.$/, m => 'Все «' + m[1] + '» теперь в категории «' + m[2] + '».'],
    [/^Moved to (.+)\.$/, m => 'Перенесено в «' + m[1] + '».'],
    [/^(.+) is in (.+) now\.$/, m => '«' + m[1] + '» теперь в «' + m[2] + '».'],
    [/^(\d+) ideas?$/, m => P(m[1], 'идея', 'идеи', 'идей')],
    [/^(\d+) corrections?$/, m => P(m[1], 'исправление', 'исправления', 'исправлений')],
    [/^(\d+) to look at$/, m => m[1] + ' проверить'],
    [/^Checked (\d+) transactions?$/, m => 'Проверено: ' + TXS(m[1])],
    [/^Ipsy corrected (\d+) transactions?\.$/, m => 'Ипси исправил: ' + TXS(m[1]) + '.'],
    [/^Ipsy corrected (\d+) transactions?\. (\d+) to look at\.$/, m => 'Ипси исправил: ' + TXS(m[1]) + '. Проверить: ' + m[2] + '.'],
    [/^(\d+) to look at\.$/, m => 'Проверить: ' + m[1] + '.'],
    [/^(.+):$/, m => /ago$|^just now$|^never$/.test(m[1]) ? ago(m[1]) + ':' : null],
    [/^(\d[\d,]*) charges?$/, m => CHARGES(m[1])],
    [/^(\d[\d,]*) charges? ·$/, m => CHARGES(m[1]) + ' ·'],
    [/^(\d[\d,]*) transactions?$/, m => TXS(m[1])],
    [/^(\d[\d,]*) recurring charges?$/, m => P(m[1], 'регулярный платёж', 'регулярных платежа', 'регулярных платежей')],
    [/^Found (\d[\d,]*) transactions?$/, m => 'Найдено: ' + TXS(m[1])],
    [/^Deleted (\d[\d,]*) transactions?\.$/, m => 'Удалено: ' + TXS(m[1]) + '.'],
    [/^(.+)’s phone reads Monarch’s emails$/, m => 'Письма Monarch читает телефон: ' + m[1]],
    [/^Ask (.+) to share Money with you: Settings, Who sees Money\.$/, m => 'Попросите поделиться с вами Деньгами (' + m[1] + '): Настройки, «Кто видит Деньги».'],
    [/^Shared with (.+)\.$/, m => 'Доступ: ' + m[1] + '.'],
    [/^No longer shared with (.+)\.$/, m => 'Больше нет доступа: ' + m[1] + '.'],
    [/^Updated (.+)\.$/, m => 'Обновлено ' + ago(m[1]) + '.'],
    [/^Read (.+)\. Money reads only Monarch’s emails, and can’t change or send anything\.$/, m => 'Прочитано ' + ago(m[1]) + '. Деньги читают только письма Monarch и ничего не могут изменить или отправить.'],
    [/^a month, (.+)$/, m => 'в месяц, ' + m[1]],
    [/^\. Counting charges over (\$[\d,.]+) only, on both sides: Monarch emailed only those then\.$/, m => '. Считаются только платежи больше ' + num(m[1]) + ', с обеих сторон: тогда Monarch присылал только их.'],
    [/^\(over (\$[\d,.]+)\)$/, m => '(больше ' + num(m[1]) + ')'],
    [/^Monarch hasn’t emailed anything for (.+)\.$/, m => 'Monarch ничего не присылал за ' + m[1] + '.'],
    [/^Monarch emailed only charges over (\$[\d,.]+) in (.+), so smaller ones aren’t here\.$/, m => 'Monarch присылал только платежи больше ' + num(m[1]) + ' за ' + m[2] + ', поэтому мелких здесь нет.'],
    [/^instead\. The last 3 months:$/, () => 'вместо неё. За последние 3 месяца:'],
    [/^in (.+)$/, m => /\d{4}/.test(m[1]) ? 'за ' + m[1] : null],
    [/^Rewards a month, per card, for the last (\d+) months$/, m => 'Бонусы по месяцам и картам за последние ' + P(m[1], 'месяц', 'месяца', 'месяцев')],
    [/^Spent in (.+)$/, m => 'Потрачено за ' + m[1]],
    [/^(On everything|Online shopping|Groceries and wholesale clubs|Bonus on the first, a quarter), (%|\$)$/, m => t(m[1]) + ', ' + m[2]],
    [/^Gmail sign-in didn’t work \((.+)\)\.$/, m => 'Вход в Gmail не удался (' + m[1] + ').'],
    [/^[\d.]+% (online|groceries|else|on everything)(, [\d.]+% (online|groceries|else))*$/, m => { const r = rate(m[0]); return r.includes(null) ? null : r.join(', '); }],
  ]);
})();
