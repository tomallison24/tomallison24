// Russian for Meals (meals/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
{
  const T = s => aosLang.t(s);
  const P = (n, one, few, many) => n + ' ' + aosLang.plural(n, one, few, many);
  const dinners = n => P(n, 'ужин', 'ужина', 'ужинов');
  const people = n => 'на ' + P(n, 'человека', 'человека', 'человек');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const MEAT = 'Chicken|Beef|Pork|Turkey|Lamb|Salmon|White fish|Shrimp|On sale';
  const meatLine = new RegExp('^(?:(' + MEAT + ') · )?for (\\d+)(?: · (.+?))?(?: · accepted by (.+))?$');
  const pastRow = new RegExp('^(.+? – .+?) · (' + MEAT + ')( · .+)?$');
  // Ipsy's "4 chicken dinners for 4", "4 dinners around what’s on sale for 4"
  const sum = s => {
    let m = /^(\d+) dinners around what’s on sale for (\d+)$/.exec(s);
    if (m) return dinners(+m[1]) + ' из того, что со скидкой, ' + people(+m[2]);
    m = /^(\d+) (.+) dinners for (\d+)$/.exec(s);
    return m ? dinners(+m[1]) + ' (' + T(cap(m[2])).toLowerCase() + ') ' + people(+m[3]) : s;
  };
  // the ingredients Ipsy ticked, as the plan names them, or "N items"
  const items = s => { const m = /^(\d+) items$/.exec(s); return m ? P(+m[1], 'пункт', 'пункта', 'пунктов') : s.replace(/ and /g, ' и '); };
  const WHAT = { 'the new plan': 'новый план', 'saving the plan': 'сохранение плана', 'the discard': 'отклонение' };
  aosLang.add({
    // ---- the page ----
    'Meals': 'Меню',
    'Store, allergies and your account': 'Магазин, аллергии и профиль',
    'Dinners, deals or shopping list': 'Ужины, скидки или список покупок',
    'Dinners': 'Ужины',
    'Deals': 'Скидки',
    'List': 'Список',
    'Plan dinners': 'Спланировать ужины',
    'Close': 'Закрыть',
    'Done': 'Готово',
    'Past plan': 'Прошлый план',
    'Paste this week’s deals': 'Вставить скидки недели',
    'Copy your store’s weekly sales and paste them here.': 'Скопируйте скидки недели из своего магазина и вставьте их сюда.',
    'This week’s deals': 'Скидки этой недели',
    'Paste the sales here': 'Вставьте скидки сюда',
    'Read the deals': 'Прочитать скидки',
    'Settings': 'Настройки',
    'Undo': 'Отменить',
    'Meals can’t be opened inside another page.': 'Меню нельзя открыть внутри другой страницы.',

    // ---- what went wrong ----
    'Meals needs its AI key first: the owner adds it (see Meals’ README).': 'Сначала Меню нужен ключ ИИ: его добавляет владелец (см. README Меню).',
    'Family accounts aren’t switched on yet, so Meals can’t plan for the family.': 'Семейные профили ещё не включены, поэтому Меню не может планировать для семьи.',
    'Sign in with your family account to see the family’s dinners.': 'Войдите в семейный профиль, чтобы видеть ужины семьи.',
    'Meals’ server isn’t set up on this site.': 'Сервер Меню на этом сайте не настроен.',
    'You’re offline. Showing what this phone kept.': 'Нет сети. Показано то, что сохранено на телефоне.',
    'The AI service didn’t accept Meals’ key. The owner can check it.': 'Сервис ИИ не принял ключ Меню. Владелец может его проверить.',
    'The AI service is busy. Try again in a minute.': 'Сервис ИИ занят. Повторите через минуту.',
    'Couldn’t reach the AI service. Try again in a minute.': 'Не удалось связаться с сервисом ИИ. Повторите через минуту.',
    'That didn’t come back right. Try again.': 'Ответ пришёл с ошибкой. Повторите.',
    'Every plan it made used something the family avoids, so none was kept. Try again, or pick another meat.': 'В каждом плане было то, чего семья не ест, поэтому ни один не сохранён. Повторите или выберите другое мясо.',
    'Only the owner can change what the family avoids. Your stores and cards were kept.': 'Менять то, чего семья не ест, может только владелец. Ваши магазины и карты сохранены.',
    'Someone in the family changed the plan just now. Here’s the plan as it is.': 'Кто-то из семьи только что изменил план. Вот он сейчас.',
    'Something went wrong. Try again in a minute.': 'Что-то пошло не так. Повторите через минуту.',
    'Sign in with Face ID': 'Войти с Face ID',

    // ---- Dinners ----
    'About half a minute.': 'Примерно полминуты.',
    'New plan · not saved yet': 'Новый план · ещё не сохранён',
    'Starting': 'Начало',
    'Accept plan': 'Принять план',
    'Try again': 'Повторить',
    'Discard': 'Отклонить',
    'Tip:': 'Совет:',
    'Clear this plan': 'Убрать этот план',
    'No dinners planned yet': 'Ужины ещё не запланированы',
    'Past plans': 'Прошлые планы',
    'Current': 'Текущий',
    'Looking in the Sheet…': 'Ищу в таблице…',
    'Show older plans from the Sheet': 'Показать старые планы из таблицы',
    'Best deals': 'Лучшие скидки',
    'Here’s a plan. Accept it to save it.': 'Вот план. Примите его, чтобы сохранить.',
    'New plan discarded.': 'Новый план отклонён.',
    'Plan cleared. It’s still in Past plans.': 'План убран. Он остался в прошлых планах.',
    'Plan back.': 'План возвращён.',
    'Shopping list': 'Список покупок',
    'Ingredients': 'Ингредиенты',
    'Steps': 'Шаги',
    'Made by AI: check times, temperatures and labels.': 'Сделано ИИ: проверяйте время, температуру и этикетки.',
    'On sale': 'Со скидкой',

    // ---- a new plan ----
    'Built around': 'Основа',
    'Chicken': 'Курица', 'Beef': 'Говядина', 'Pork': 'Свинина', 'Turkey': 'Индейка', 'Lamb': 'Баранина', 'Salmon': 'Лосось',
    'White fish': 'Белая рыба', 'Shrimp': 'Креветки', 'Whatever’s on sale': 'Что со скидкой',
    'Nights': 'Вечеров',
    'People': 'Человек',
    'Shop at': 'Магазин',
    'Best deals, any store': 'Лучшие скидки, любой магазин',
    'Use this week’s deals': 'Скидки недели',
    'Anything else': 'Что-то ещё',
    'Anything else? (kid-friendly, no spice…)': 'Что-то ещё? (для детей, не остро…)',
    'Yes': 'Да',
    'No': 'Нет',
    'None found yet': 'Пока не найдены',

    // ---- Deals ----
    'Store': 'Магазин',
    'All my stores': 'Все мои магазины',
    'Find deals at the rest': 'Найти скидки в остальных',
    'All found': 'Все найдены',
    'Look again': 'Поискать снова',
    'Find this week’s deals': 'Найти скидки недели',
    'Paste deals': 'Вставить скидки',
    'Looking for this week’s sales…': 'Ищу скидки этой недели…',
    'This can take up to a minute.': 'Это может занять до минуты.',
    'No deals yet': 'Скидок пока нет',
    'Plan dinners with the best of these': 'Спланировать ужины с лучшими из них',
    'Plan dinners with these deals': 'Спланировать ужины с этими скидками',
    'Found on:': 'Найдено на:',
    'From the sales you pasted.': 'Из вставленных вами скидок.',
    'No food deals in that text.': 'В этом тексте нет скидок на продукты.',
    'Paste the sales first.': 'Сначала вставьте скидки.',

    // ---- List ----
    'Nothing to buy yet': 'Покупать пока нечего',
    'Accept the new plan on Dinners.': 'Примите новый план на вкладке «Ужины».',
    'Plan dinners first.': 'Сначала спланируйте ужины.',
    'You probably have': 'Скорее всего, уже есть',
    'Copy the list': 'Скопировать список',
    'Clear ticks': 'Снять отметки',
    'Couldn’t copy on this phone.': 'На этом телефоне скопировать не удалось.',

    // ---- Settings and signing in ----
    'Design': 'Дизайн',
    'Account': 'Профиль',
    'Not signed in': 'Вход не выполнен',
    'Sign in to plan for the family.': 'Войдите, чтобы планировать для семьи.',
    'Your stores': 'Ваши магазины',
    'Deals and plans come from these stores.': 'Скидки и планы — из этих магазинов.',
    'Member cards': 'Карты лояльности',
    'With a card, deals show its member prices.': 'С картой скидки показаны по ценам для её владельцев.',
    'Never in a plan': 'Никогда в плане',
    'Add an allergy or dislike': 'Аллергия или нелюбимый продукт',
    'Add': 'Добавить',
    'Only the owner can change what the family avoids.': 'Менять то, чего семья не ест, может только владелец.',
    'Keep at least one store.': 'Оставьте хотя бы один магазин.',
    'Saved for the family.': 'Сохранено для семьи.',
    'Signed in.': 'Вы вошли.',
    'No passkey found, or canceled. Set up your account in aOS first.': 'Ключ входа не найден или вход отменён. Сначала настройте профиль в aOS.',
    'Couldn’t sign in.': 'Не удалось войти.',

    // ---- the family's Google Sheet ----
    'Sign in to sync with the family’s Google Sheet. Until then, Meals shows what the family server has.': 'Войдите, чтобы синхронизироваться с семейной Google Таблицей. А пока Меню показывает то, что есть на семейном сервере.',
    'The family’s Meals Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.': 'Семейная таблица Меню ещё не настроена. Владелец настраивает её в aOS: Профиль → Google Таблицы.',
    'aOS’s phrase for the Meals Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.': 'Фраза aOS для таблицы Меню больше не совпадает с её скриптом. Владелец обновляет её в aOS: Профиль → Google Таблицы.',
    'The Meals Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).': 'У таблицы Меню ещё старый скрипт. Владелец вставляет новый и развёртывает новую версию (aOS/SHEETS.md).',
    'The Meals Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.': 'В скрипте таблицы Меню всё ещё SECRET = ‘CHANGE-ME’. Владелец меняет его и развёртывает новую версию.',
    'The Sheet was busy. Trying again shortly.': 'Таблица была занята. Скоро попробуем снова.',
    'Offline. Meals will sync when you’re back online.': 'Нет сети. Меню синхронизируется, когда сеть появится.',
    'Couldn’t reach the Sheet. Trying again later.': 'Не удалось связаться с таблицей. Попробуем позже.',
    'The Sheet didn’t answer as expected. Trying again later.': 'Таблица ответила не так, как ожидалось. Попробуем позже.',
    'The family’s Google Sheet didn’t sync. Trying again later.': 'Семейная Google Таблица не синхронизировалась. Попробуем позже.',
    'No older plans in the family’s Google Sheet.': 'В семейной Google Таблице нет более старых планов.',
    'Couldn’t reach the family’s Google Sheet. Try again later.': 'Не удалось связаться с семейной Google Таблицей. Повторите позже.',

    // ---- Ipsy here (ipsy-tools.js) ----
    'Hi, I’m Ipsy! I can swap a night’s dinner, plan a new week around the deals, find what’s on sale, or tell you what you can make with what you have, always keeping to what the family never eats.':
      'Привет, я Ипси! Могу заменить ужин на любой вечер, спланировать неделю под скидки, найти, что продаётся со скидкой, или подсказать, что приготовить из того, что есть, — всегда без того, чего семья не ест.',
    'Ask Ipsy about dinner': 'Спросите Ипси об ужине',
    'What’s for dinner tonight?': 'Что сегодня на ужин?',
    'Swap Thursday for something quicker': 'Замени ужин в четверг на что-то побыстрее',
    'What’s on sale this week?': 'Что со скидкой на этой неделе?',
    'What can I make with ground beef?': 'Что приготовить из говяжьего фарша?',
    'Ipsy runs on Claude, by Anthropic: what you ask, and the plans and deals it reads, go there through the family server. Everyone in the family sees its changes, each with Undo, and it asks first before replacing a whole week.':
      'Ипси работает на Claude от Anthropic: ваши вопросы и планы со скидками, которые читает Ипси, отправляются туда через семейный сервер. Изменения Ипси видит вся семья, каждое можно отменить, а перед заменой целой недели Ипси спрашивает.',
    'Looking at the family’s dinners': 'Смотрю ужины семьи',
    'Reading the recipes': 'Читаю рецепты',
    'Looking at past plans': 'Смотрю прошлые планы',
    'Reading the shopping list': 'Читаю список покупок',
    'Unticking the list': 'Снимаю отметки в списке',
    'Ticking off the list': 'Отмечаю в списке',
    'Planning dinners (about half a minute)': 'Планирую ужины (примерно полминуты)',
    'Saving the plan': 'Сохраняю план',
    'Discarding the new plan': 'Отклоняю новый план',
    'Opening the recipe': 'Открываю рецепт',
    'Yes, make a new one': 'Да, составить новый',
    'No, keep it': 'Нет, оставить',
    'Yes, save it': 'Да, сохранить',
    'Not yet': 'Пока нет',
    'Yes, discard it': 'Да, отклонить',
  }, [
    // nights and plans
    [/^Night (\d+)(?: · (.+))?$/, m => 'Вечер ' + m[1] + (m[2] ? ' · ' + m[2] : '')],
    [/^Night (\d+) \((.+)\)$/, m => 'Вечер ' + m[1] + ' (' + m[2] + ')'],
    [/^Planning (\d+) dinners?…$/, m => 'Планирую ' + dinners(+m[1]) + '…'],
    [/^Plan (\d+) dinners?$/, m => 'Спланировать ' + dinners(+m[1])],
    [meatLine, m => [m[1] && T(m[1]), people(+m[2]), m[3] && T(m[3]), m[4] && 'принят: ' + m[4]].filter(Boolean).join(' · ')],
    [/^Tonight: (.+)$/, m => 'Сегодня: ' + m[1]],
    [/^(.+) · (\d+) dinners?$/, m => m[1] + ' · ' + dinners(+m[2])],
    [/^Accepted by (.+)\.$/, m => 'Принято: ' + m[1] + '.'],
    [/^Planned by (.+)\.$/, m => 'Спланировано: ' + m[1] + '.'],
    [pastRow, m => m[1] + ' · ' + T(m[2]) + (m[3] || '')],
    [/^(Today|Tomorrow), (.+)$/, m => (m[1] === 'Today' ? 'Сегодня, ' : 'Завтра, ') + m[2]],
    [/^Never (.+)\.$/, m => 'Исключено: ' + m[1].replace(/ or /g, ', ') + '.'],
    // deals
    [/^(\d+) of (\d+) stores? have this week’s deals\. ?(.*)$/, m => 'Скидки недели есть в ' + m[1] + ' из ' + P(+m[2], 'магазина', 'магазинов', 'магазинов') + '.' + (m[3] ? ' ' + m[3] : '')],
    [/^(.+?) · (This week|An earlier week), (.+?)(?: · (.+) prices)?$/, m => m[1] + ' · ' + (m[2] === 'This week' ? 'эта неделя' : 'прошлая неделя') + ', ' + m[3] + (m[4] ? ' · цены ' + m[4] : '')],
    [/^(.+?) · (Prime|VIC|.+) prices$/, m => m[1] + ' · цены ' + m[2]],
    [/^At (.+)\. This can take up to a minute\.$/, m => m[1] + '. Это может занять до минуты.'],
    [/^(.+) \((\d+) of (\d+)\)\. About half a minute a store\.$/, m => m[1] + ' (' + m[2] + ' из ' + m[3] + '). Примерно полминуты на магазин.'],
    [/^usually (.+)$/, m => 'обычно ' + m[1]],
    [/^On sale: (.+)$/, m => 'Со скидкой: ' + m[1]],
    [/^On sale at (.+)$/, m => 'Скидка в ' + m[1]],
    [/^On sale (.+)$/, m => 'Скидка ' + m[1]],
    // the shopping list: "2 lb · nights 1, 3"
    [/^(?:(.+) · )?(nights?) ([\d, ]+)$/, m => (m[1] ? m[1] + ' · ' : '') + (m[2] === 'night' ? 'вечер ' : 'вечера ') + m[3]],
    // settings
    [/^Remove (.+)$/, m => 'Убрать ' + m[1]],
    [/^AI: (.+), through Anthropic’s API\.$/, m => 'ИИ: ' + m[1] + ' через API Anthropic.'],
    [/^AI: Not set up yet\.$/, () => 'ИИ: ещё не настроен.'],
    [/^AI: Unknown until you’re online\.$/, () => 'ИИ: неизвестно, пока нет сети.'],
    // toasts
    [/^Copied (\d+) items?\.$/, m => 'Скопировано: ' + P(+m[1], 'пункт', 'пункта', 'пунктов') + '.'],
    [/^Found (\d+) deals? at (.+)\.$/, m => 'Найдено скидок в ' + m[2] + ': ' + m[1] + '.'],
    [/^Found (\d+) deals?\.$/, m => 'Найдено скидок: ' + m[1] + '.'],
    [/^Found (\d+) deals?\. None online for (.+): paste theirs from their apps\.$/, m => 'Найдено скидок: ' + m[1] + '. Для ' + m[2] + ' в интернете ничего нет: вставьте их скидки из приложений магазинов.'],
    [/^Couldn’t find (.+)’s sales online this week\. Paste them from its app instead\.$/, m => 'Не удалось найти скидки ' + m[1] + ' на этой неделе. Вставьте их из приложения магазина.'],
    [/^Saved for the family, from (.+)\. The shopping list is ready\.$/, m => 'Сохранено для семьи, с ' + m[1] + '. Список покупок готов.'],
    [/^Found (\d+) older plans? in the family’s Google Sheet\.$/, m => 'В семейной Google Таблице найдено: ' + P(+m[1], 'старый план', 'старых плана', 'старых планов') + '.'],
    // Ipsy's changes and questions (ipsy-tools.js): dinners and ingredients as the plan names them
    [/^Checking this week’s deals(?: at (.+))?$/, m => 'Проверяю скидки недели' + (m[1] ? ' в ' + m[1] : '')],
    [/^Changing night (\d*)$/, m => 'Меняю ужин' + (m[1] ? ' на вечер ' + m[1] : '')],
    [/^Ticked off (.+)$/, m => 'Отмечено: ' + items(m[1])],
    [/^Unticked (.+)$/, m => 'Отметка снята: ' + items(m[1])],
    [/^Night (\d+)(?: \((.+?)\))?( of the new plan)?: (.+ → .+)$/, m => 'Вечер ' + m[1] + (m[2] ? ' (' + m[2] + ')' : '') + (m[3] ? ' нового плана' : '') + ': ' + m[4]],
    [/^Made a new plan: (.+) \(not saved yet\)$/, m => 'Новый план: ' + sum(m[1]) + ' (ещё не сохранён)'],
    [/^Make a new plan in place of the one waiting \((.+?)(?:, by (.+))?\)\? Everyone in the family sees the change\.$/,
      m => 'Составить новый план вместо ожидающего (' + sum(m[1]) + (m[2] ? ', автор: ' + m[2] : '') + ')? Изменение увидит вся семья.'],
    [/^Save the new plan \((.+?)\) for the family, night 1 on (.+?)\?(?: It takes the place of the current plan \((.+)\) for everyone\.| Everyone in the family sees it\.)$/,
      m => 'Сохранить новый план (' + sum(m[1]) + ') для семьи, первый вечер — ' + m[2] + '?' + (m[3] ? ' Он заменит текущий план (' + m[3] + ') для всех.' : ' Его увидит вся семья.')],
    [/^Saved the new plan for the family, from (.+)$/, m => 'Новый план сохранён для семьи, с ' + m[1]],
    [/^Discard the new plan waiting \((.+?)(?:, by (.+))?\)\? It goes for everyone in the family; the current plan stays\.$/,
      m => 'Отклонить ожидающий план (' + sum(m[1]) + (m[2] ? ', автор: ' + m[2] : '') + ')? Он исчезнет у всей семьи; текущий план останется.'],
    [/^Discarded the new plan \((.+)\)$/, m => 'Новый план отклонён (' + sum(m[1]) + ')'],
    [/^Couldn’t undo (the new plan|saving the plan|the discard|Night \d+(?: \(.+?\))?)\. (.*)$/, m => 'Не удалось отменить: ' + (WHAT[m[1]] || T(m[1])) + '. ' + T(m[2])],
  ]);
}
