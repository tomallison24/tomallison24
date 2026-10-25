// Russian for Sparkle Kingdom (sparkle/) (../../lang.js says how the words are used). Only the grown-ups' side
// is in Russian: the player picker, the grown-up check and the Parent corner. The game itself (the kingdom,
// the rounds, the castle, the story) stays in English, translate="no": it teaches her to read English.
// Keep the English exactly as the app writes it.
'use strict';
(() => {
  const t = s => aosLang.t(s);
  const P = (n, one, few, many) => n + ' ' + aosLang.plural(n, one, few, many);
  const COINS = n => P(n, 'монета', 'монеты', 'монет');
  const HAIR = { gold: 'Золотистые', honey: 'Медовые', brown: 'Каштановые', dark: 'Тёмные', black: 'Чёрные', red: 'Рыжие', pink: 'Розовые', lilac: 'Сиреневые' };
  aosLang.add({
    // the picker
    "Who's playing?": 'Кто играет?',
    'Make your princess': 'Создать принцессу',
    'Add a player': 'Добавить игрока',
    'Grown-ups: press and hold': 'Для взрослых: нажмите и удерживайте',
    'Grown-ups: hold for the Parent corner': 'Для взрослых: удерживайте, чтобы открыть уголок родителей',
    // the grown-up check
    'For grown-ups': 'Для взрослых',
    "Face ID isn't available here, so a grown-up question instead.": 'Face ID здесь недоступен, поэтому вместо него вопрос для взрослых.',
    'Answer': 'Ответ',
    '‹ Back': '‹ Назад',
    // a player
    'A new player': 'Новый игрок',
    'Name': 'Имя',
    'Skin': 'Цвет кожи',
    'Hair': 'Волосы',
    'Hairstyle': 'Причёска',
    'Long': 'Длинные', 'Curly': 'Кудрявые', 'Bun': 'Пучок', 'Braids': 'Косички', 'Puffs': 'Два пучка',
    'Make my princess': 'Создать мою принцессу',
    'Remove this player': 'Удалить игрока',
    // the Parent corner
    'Parent corner': 'Уголок родителей',
    'Players': 'Игроки',
    'No players yet.': 'Игроков пока нет.',
    'Learning': 'Обучение',
    'Favor reading': 'Больше чтения',
    'How strongly the quest and the map lean to Story Tower': 'Насколько задания и карта ведут в Башню историй',
    'Normal': 'Обычно', 'More': 'Больше', 'Most': 'Максимум',
    'Lands open': 'Открытые земли',
    'Story Tower is always open': 'Башня историй открыта всегда',
    'Story Tower': 'Башня историй', 'Gem Mine': 'Самоцветная шахта', 'Star Meadow': 'Звёздный луг', 'Fairy Garden': 'Сад фей', 'Tiara Workshop': 'Мастерская диадем',
    'The Gem Mine': 'Самоцветная шахта', 'The Fairy Garden': 'Сад фей', 'The Tiara Workshop': 'Мастерская диадем', 'Exploring': 'Прогулки', 'Castle': 'Замок',
    'Voice and sound': 'Голос и звук',
    'Voice speed': 'Скорость речи',
    'Slow': 'Медленно', 'Quick': 'Быстро',
    'Sound effects': 'Звуковые эффекты',
    'On': 'Вкл.', 'Off': 'Выкл.', 'Show': 'Показать', 'Hide': 'Скрыть',
    'Play timer on screen': 'Таймер игры на экране',
    "Minutes played this session. The game never stops play: you're in charge of screen time.": 'Минуты игры за этот раз. Игра сама не останавливается: временем у экрана управляете вы.',
    'Natural voices': 'Естественные голоса',
    "Each friend speaks in a real-sounding voice of their own, made by Google over the internet; otherwise the phone's voice": 'У каждого героя свой живой голос, его создаёт Google через интернет; иначе говорит голос телефона',
    "Each friend speaks in a real-sounding voice of their own, made by Google over the internet. Sign in below to use them; otherwise the phone's voice": 'У каждого героя свой живой голос, его создаёт Google через интернет. Чтобы включить, войдите ниже; иначе говорит голос телефона',
    'Hear the voices': 'Послушать голоса',
    'The storyteller, Professor Hoot, Pebble, Gemma and Bloom': 'Рассказчица, профессор Хут, Пебл, Джемма и Блум',
    'Test the voice': 'Проверить голос',
    'Hear how this phone says some letter sounds': 'Послушайте, как этот телефон произносит звуки букв',
    'Letter sounds': 'Звуки букв',
    'Phone voices say letter names well and letter sounds poorly. Record each sound once (tap a letter, say the sound, tap again): the game plays your voice instead. Say just the sound: "mmm" for m, "t" (short, no "uh") for t, "a" as in apple.':
      'Голоса телефона хорошо называют буквы, но плохо произносят их звуки. Запишите каждый звук один раз (нажмите букву, произнесите звук, нажмите снова): игра будет включать ваш голос. Произносите только звук: «ммм» для m, короткое «т» (без «э») для t, «а» как в слове apple.',
    'tap to stop': 'нажмите, чтобы остановить',
    'tap to record': 'нажмите для записи',
    'The microphone isn’t available here': 'Микрофон здесь недоступен',
    'Design': 'Дизайн',
    'Family account': 'Семейный профиль',
    'Players and their progress follow you to every family phone signed in here.': 'Игроки и их успехи доступны на каждом семейном телефоне, где выполнен вход.',
    'Sign in with Face ID': 'Войти с Face ID',
    'Keep players and their progress on every family phone.': 'Игроки и их успехи на каждом семейном телефоне.',
    "Sparkle Kingdom keeps everything on this phone and, signed in, in your family account. With natural voices on, the sentences the game says (a player's name among them) go to Google to be spoken; nothing else goes anywhere else.":
      'Sparkle Kingdom хранит всё на этом телефоне, а после входа и в семейном профиле. Когда включены естественные голоса, фразы игры (в том числе имя игрока) отправляются в Google для озвучивания; больше ничего никуда не уходит.',
    'Sign-in did not finish': 'Вход не завершён',
    // a player's report
    'Skills': 'Навыки',
    'Reading': 'Чтение', 'Spelling': 'Правописание', 'Math': 'Математика', 'Wand Sparkle': 'Волшебная палочка', 'Flower Match': 'Цветочные пары', "What's Missing": 'Чего не хватает', 'Story Recall': 'Вспомни историю',
    'Play time': 'Время игры', 'Today': 'Сегодня', 'This week': 'На этой неделе', 'The last 30 days': 'Последние 30 дней',
    'Minutes played each day, the last 30 days': 'Минуты игры по дням за последние 30 дней',
    'Words and sounds': 'Слова и звуки',
    'Known': 'Выучено', 'Right on 3 different days': 'Правильно в 3 разных дня',
    'Coming back for review': 'Вернутся для повторения',
    'None yet': 'Пока нет', 'None right now': 'Сейчас нет',
    'Practice together': 'Позанимайтесь вместе',
    'Missed on 2 or more days: try these with her at bedtime': 'Ошибки в 2 и более дня: повторите их вместе перед сном',
    'The story': 'История',
    'Little Princess': 'Маленькая принцесса', 'Princess': 'Принцесса', 'Royal Princess': 'Королевская принцесса', 'Princess of Sparkle Kingdom': 'Принцесса Sparkle Kingdom',
    'Starting levels': 'Начальные уровни',
    'Not started: the warm-up finds her level': 'Не начато: разминка определит её уровень',
    'One level easier': 'На уровень легче', 'One level harder': 'На уровень сложнее',
    'Edit name and look': 'Изменить имя и внешность',
  }, [
    [/^Play as (.+)$/, m => 'Играть за ' + m[1]],
    [/^What is (\d+) × (\d+)\?$/, m => `Сколько будет ${m[1]} × ${m[2]}?`],
    [/^Edit (.+)$/, m => 'Изменить: ' + m[1]],
    [/^Skin (\d)$/, m => 'Цвет кожи ' + m[1]],
    [/^([a-z]+) hair$/, m => HAIR[m[1]] ? HAIR[m[1]] + ' волосы' : null],
    [/^Remove (.+)\? Their progress, coins and treasures are deleted on every phone\.$/, m => `Удалить игрока ${m[1]}? Успехи, монеты и сокровища удалятся на всех телефонах.`],
    [/^(\d+) min today · (\d+) coins · reading level (.+)$/, m => `${m[1]} мин сегодня · ${COINS(m[2])} · уровень чтения ${m[3]}`],
    [/^Record the sound of ([a-z])$/, m => 'Записать звук ' + m[1]],
    [/^Stop recording ([a-z])$/, m => 'Остановить запись ' + m[1]],
    [/^Play ([a-z])$/, m => 'Включить ' + m[1]],
    [/^Signed in as (.+)$/, m => 'Вход выполнен: ' + m[1]],
    [/^(\d+) of (\d+)$/, m => `${m[1]} из ${m[2]}`],
    [/^(\d+) minutes?$/, m => P(m[1], 'минута', 'минуты', 'минут')],
    [/^(\d+) min$/, m => m[1] + ' мин'],
    [/^Her rank: all her levels added up, (\d+) of 55$/, m => `Её звание: сумма всех уровней, ${m[1]} из 55`],
    [/^(\d+) rounds? played there$/, m => P(m[1], 'раунд', 'раунда', 'раундов') + ' сыграно там'],
    [/^Now (\d+): (.+)$/, m => `Сейчас ${m[1]}: ${t(m[2])}`],
    [/^Coins: (\d+)\. Rounds played: (\d+)\. Stickers: (\d+)\.$/, m => `Монеты: ${m[1]}. Сыграно раундов: ${m[2]}. Наклейки: ${m[3]}.`],
    // a skill's line: its level's name (left in English), how it moved this week, and how often she was right
    [/^(.+?)( \(still warming up\))? · (up (\d+) this week|down (\d+) this week|same as last week) · (no answers this week|(\d+)% right in 7 days \((\d+) answers\))$/, m =>
      `${t(m[1])}${m[2] ? ' (ещё разминка)' : ''} · ${m[4] ? `выше на ${m[4]} за неделю` : m[5] ? `ниже на ${m[5]} за неделю` : 'как на прошлой неделе'} · ${m[7] ? `${m[7]}% верно за 7 дней (${P(m[8], 'ответ', 'ответа', 'ответов')})` : 'на этой неделе ответов нет'}`],
  ]);
})();
