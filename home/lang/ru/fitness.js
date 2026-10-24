// Russian for Fitness (fitness/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
  // the built-in exercises (fitness/app.js GROUPS); the ones the family typed in stay as written (translate="no")
  const EX = {
    'Barbell Bench Press': 'Жим штанги лёжа', 'Incline Barbell Bench Press': 'Жим штанги на наклонной скамье', 'Decline Barbell Bench Press': 'Жим штанги с обратным наклоном',
    'Dumbbell Bench Press': 'Жим гантелей лёжа', 'Incline Dumbbell Press': 'Жим гантелей на наклонной скамье', 'Chest Press Machine': 'Жим от груди в тренажёре',
    'Dumbbell Fly': 'Разводка гантелей', 'Cable Fly': 'Сведение рук в кроссовере', 'Pec Deck Machine': 'Бабочка (пек-дек)', 'Push-Up': 'Отжимания', 'Dip': 'Отжимания на брусьях',
    'Lat Pulldown': 'Тяга верхнего блока', 'Close-Grip Lat Pulldown': 'Тяга верхнего блока узким хватом', 'Pull-Up': 'Подтягивания', 'Chin-Up': 'Подтягивания обратным хватом',
    'Seated Cable Row': 'Тяга нижнего блока сидя', 'Machine Row': 'Тяга в тренажёре', 'Barbell Row': 'Тяга штанги в наклоне', 'Pendlay Row': 'Тяга Пендлея',
    'One-Arm Dumbbell Row': 'Тяга гантели одной рукой', 'T-Bar Row': 'Тяга Т-грифа',
    'Deadlift': 'Становая тяга', 'Romanian Deadlift': 'Румынская тяга', 'Sumo Deadlift': 'Становая тяга сумо', 'Hyperextension': 'Гиперэкстензия', 'Back Extension Machine': 'Разгибание спины в тренажёре',
    'Overhead Barbell Press': 'Жим штанги стоя', 'Seated Dumbbell Shoulder Press': 'Жим гантелей сидя', 'Shoulder Press Machine': 'Жим на плечи в тренажёре', 'Arnold Press': 'Жим Арнольда',
    'Lateral Raise': 'Махи в стороны', 'Cable Lateral Raise': 'Махи в стороны на блоке', 'Front Raise': 'Подъём рук перед собой', 'Upright Row': 'Тяга к подбородку',
    'Rear Delt Fly': 'Разводка на задние дельты', 'Face Pull': 'Тяга к лицу', 'Shrug': 'Шраги',
    'Dumbbell Curl': 'Сгибание рук с гантелями', 'Barbell Curl': 'Сгибание рук со штангой', 'EZ-Bar Curl': 'Сгибание рук с EZ-грифом', 'Hammer Curl': 'Молотки',
    'Incline Dumbbell Curl': 'Сгибание рук на наклонной скамье', 'Preacher Curl': 'Сгибание на скамье Скотта', 'Cable Curl': 'Сгибание рук на блоке', 'Concentration Curl': 'Концентрированное сгибание',
    'Triceps Pushdown': 'Разгибание рук на блоке', 'Rope Overhead Extension': 'Разгибание из-за головы с канатом', 'Overhead Triceps Extension': 'Разгибание рук из-за головы',
    'Skull Crusher': 'Французский жим', 'Close-Grip Bench Press': 'Жим лёжа узким хватом', 'Triceps Kickback': 'Разгибание руки в наклоне', 'Bench Dip': 'Обратные отжимания от скамьи',
    'Plank': 'Планка', 'Side Plank': 'Боковая планка', 'Hanging Leg Raise': 'Подъём ног в висе', 'Cable Crunch': 'Скручивания на блоке', 'Ab Crunch Machine': 'Скручивания в тренажёре',
    'Russian Twist': 'Русские скручивания', 'Sit-Up': 'Подъём корпуса',
    'Barbell Back Squat': 'Приседания со штангой', 'Barbell Front Squat': 'Фронтальные приседания', 'Goblet Squat': 'Гоблет-приседания', 'Leg Press': 'Жим ногами', 'Hack Squat': 'Гакк-приседания',
    'Bulgarian Split Squat': 'Болгарские выпады', 'Walking Lunge': 'Выпады в движении', 'Leg Extension': 'Разгибание ног', 'Leg Curl': 'Сгибание ног', 'Calf Raise': 'Подъём на носки',
    'Hip Adduction Machine': 'Сведение ног в тренажёре', 'Hip Thrust': 'Ягодичный мост со штангой', 'Glute Bridge': 'Ягодичный мостик', 'Cable Kickback': 'Отведение ноги на блоке',
    'Hip Abduction Machine': 'Разведение ног в тренажёре',
    'Treadmill': 'Беговая дорожка', 'Elliptical': 'Эллипсоид', 'Stair Climber': 'Степпер', 'Rowing Machine': 'Гребной тренажёр', 'ARC Trainer': 'Тренажёр ARC',
    'Adaptive Motion Trainer': 'Адаптивный тренажёр', 'Seated Elliptical': 'Эллипсоид сидя', 'Upright Bike': 'Велотренажёр', 'Recumbent Bike': 'Горизонтальный велотренажёр',
    'Spin Bike': 'Сайкл', 'Indoor Track': 'Крытая беговая дорожка', 'Swimming': 'Плавание',
  };
  // the muscle groups (app.js asks for them as "Muscle group: Back", since "Back" alone is Назад)
  const G = { Chest: 'Грудь', Back: 'Спина', 'Lower back': 'Поясница', Shoulders: 'Плечи', Arms: 'Руки', Core: 'Пресс', Legs: 'Ноги', Glutes: 'Ягодицы', Cardio: 'Кардио', Other: 'Другое' };
  const SLEEP = { Deep: 'Глубокий', Core: 'Основной', REM: 'Быстрый', Awake: 'Бодрствование' };
  const t = s => aosLang.t(s);
  const num = s => String(s).replace(/(\d) (?=\d)/g, '$1 ');
  // Russian plurals; a fraction takes the second form (2,5 подхода)
  const pl = (n, one, few, many) => /[.,]\d/.test(String(n)) ? few : aosLang.plural(String(n).replace(/\D/g, '') || '0', one, few, many);
  const P = (n, one, few, many) => num(n) + ' ' + pl(n, one, few, many);
  const N = '(\\d[\\d .,]*)';
  // durations as the app writes them: 1 h 5 min, 45 s, 6 h 25 m (sleep), 7h 20m (short)
  const dur = s => {
    let m;
    if ((m = /^(\d+) h(?: (\d+) (?:min|m))?$/.exec(s))) return m[1] + ' ч' + (m[2] ? ' ' + m[2] + ' мин' : '');
    if ((m = /^(\d+) min(?: (\d+) s)?$/.exec(s))) return m[1] + ' мин' + (m[2] ? ' ' + m[2] + ' с' : '');
    if ((m = /^(\d{1,2}) m$/.exec(s))) return m[1] + ' мин';
    if ((m = /^(\d+) s$/.exec(s))) return m[1] + ' с';
    if ((m = /^(\d+)h(?: (\d+)m)?$/.exec(s))) return m[1] + ' ч' + (m[2] ? ' ' + m[2] + ' мин' : '');
    if ((m = /^(\d+)m$/.exec(s))) return m[1] + ' мин';
    return null;
  };
  const U = { kcal: 'ккал', bpm: 'уд/мин', ms: 'мс', min: 'мин', '/min': '/мин', mmHg: 'мм рт. ст.', 'mg/dL': 'мг/дл', 'mL/kg/min': 'мл/кг/мин', 'mmol/L': 'ммоль/л', km: 'км' };
  const unit = (n, u) => u === 'steps' ? P(n, 'шаг', 'шага', 'шагов') : u === 'floors' ? P(n, 'этаж', 'этажа', 'этажей') : U[u] ? num(n) + ' ' + U[u] : null;
  const part = s => G[s] || t(s);
  const BEFORE = { 'the 7 before': 'за 7 дней до этого', 'the 4 weeks before': 'за 4 недели до этого' };
  const LAST = { 'the last 7 days': 'за последние 7 дней', 'the last 4 weeks': 'за последние 4 недели' };
  const ACC = { 'среда': 'среду', 'пятница': 'пятницу', 'суббота': 'субботу' };
  const SLOTS = { Morning: 'Утро', Midday: 'День', Evening: 'Вечер', Bedtime: 'Перед сном', Sun: 'Вс', Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб' };
  const LABEL = { Core: 'Основной сон', Deep: 'Глубокий сон', REM: 'Быстрый сон' };
  const updown = (d, v) => (d === 'up' ? 'больше на ' : 'меньше на ') + t(v);

  aosLang.add(Object.assign({}, EX, {
    'Fitness': 'Фитнес',
    'Fitness can’t be opened inside another page.': 'Фитнес нельзя открыть внутри другой страницы.',
    'Settings': 'Настройки', 'Done': 'Готово', 'Close': 'Закрыть', 'Cancel': 'Отмена', 'Undo': 'Отменить', 'Save': 'Сохранить', 'Add': 'Добавить', 'Delete': 'Удалить',
    'Today': 'Сегодня', 'Yesterday': 'Вчера', 'Try again': 'Повторить', 'Sign in': 'Войти', 'Sign in with Face ID': 'Войти с Face ID', 'Updated': 'Обновлено',
    'Syncing': 'Синхронизация', 'Synced': 'Синхронизировано', 'Ipsy': 'Ипси', 'Show a view': 'Выбрать раздел', 'Show': 'Показать',
    'Log today’s workout': 'Записать сегодняшнюю тренировку', 'Add a medication or supplement': 'Добавить лекарство или добавку',
    // the week
    'This week': 'Эта неделя', 'Last week': 'Прошлая неделя', 'Next week': 'Следующая неделя', 'That week': 'Та неделя', 'Previous week': 'Предыдущая неделя',
    'Rest day': 'День отдыха', 'Nothing logged yet': 'Пока ничего', 'days trained': 'тренировки', 'day trained': 'тренировки',
    'exercises': 'упражнения', 'exercise': 'упражнения', 'sets': 'подходы', 'set': 'подходы', 'steps a day': 'шагов в день',
    'Steps': 'Шаги', 'Standard drinks, from Drinks': 'Стандартные напитки, из Напитков', 'goal met': 'цель выполнена',
    // the views
    'Week': 'Неделя', 'Month': 'Месяц', 'Analysis': 'Анализ', 'Meds': 'Лекарства', 'Health': 'Здоровье',
    'Log each day’s workout': 'Записывайте каждую тренировку', 'Where you’re improving, and what needs work': 'Где есть прогресс и что подтянуть',
    'Medications and supplements you take': 'Лекарства и добавки, которые вы принимаете', 'Activity, heart, sleep and vitals from Apple Health': 'Активность, сердце, сон и показатели из Apple Health',
    // Analysis
    'Compare': 'Сравнение', 'Nothing to compare yet': 'Пока не с чем сравнить', 'Log a few workouts to start.': 'Запишите несколько тренировок, чтобы начать.',
    'Days trained': 'Дни тренировок', 'Sets': 'Подходы', 'Volume (lb)': 'Объём (lb)', 'Cardio (min)': 'Кардио (мин)',
    'nothing before': 'раньше ничего', 'same as before': 'как раньше', 'before: in the Sheet': 'раньше: в таблице',
    'Improving': 'Прогресс', 'Needs work': 'Подтянуть', 'Sets by muscle group': 'Подходы по группам мышц', 'change vs before': 'изменение',
    'a day, from Apple Health': 'в день, из Apple Health', 'Drinks': 'Напитки', 'from Drinks': 'из Напитков',
    'Nothing stronger than before yet. Keep at it.': 'Пока без прироста. Продолжайте.',
    'Nothing logged in the last 7 days.': 'За последние 7 дней ничего не записано.', 'Nothing logged in the last 4 weeks.': 'За последние 4 недели ничего не записано.',
    'Nothing has slipped. Nice.': 'Ничего не просело. Отлично.',
    'Nothing logged in the 7 before to compare with.': 'В предыдущие 7 дней нет записей для сравнения.',
    'Nothing logged in the 4 weeks before to compare with.': 'В предыдущие 4 недели нет записей для сравнения.',
    'New': 'Новые', 'Holding steady': 'Без изменений', 'down': 'спад',
    'Standard drinks': 'Стандартные напитки', 'Alcohol-free days': 'Дни без алкоголя', 'Open Drinks': 'Открыть Напитки', 'Steps a day': 'Шагов в день',
    'Asleep a night': 'Сон за ночь', 'Resting HR (bpm)': 'Пульс в покое (уд/мин)', 'HRV (ms)': 'ВСР (мс)', 'Active energy (kcal)': 'Активная энергия (ккал)',
    // a day
    'Nothing logged today yet.': 'Сегодня пока ничего не записано.', 'Nothing logged this day yet.': 'В этот день ничего не записано.',
    'Change exercise': 'Изменить упражнение', 'Add an exercise': 'Добавить упражнение', 'Search all exercises': 'Поиск упражнений', 'Clear search': 'Очистить поиск',
    'Type them in, or link your iPhone in Settings': 'Введите или подключите iPhone в настройках', 'From your iPhone': 'С вашего iPhone', 'Typed in': 'Введено вручную',
    'Steps on this day': 'Шаги за этот день', 'No steps yet': 'Шагов пока нет', 'Goal met': 'Цель выполнена',
    'Muscle group': 'Группа мышц', 'Exercise': 'Упражнение', 'Choose…': 'Выбрать…', 'Name of the exercise': 'Название упражнения',
    'Time': 'Время', 'Distance': 'Расстояние', 'optional': 'необязательно', 'Weight': 'Вес', 'Reps': 'Повторения', 'Bodyweight': 'Свой вес',
    'Recent': 'Недавние', 'Yours': 'Ваши', 'Other…': 'Другое…', 'Save changes': 'Сохранить изменения', 'Add to today': 'Добавить на сегодня',
    'A new exercise of your own; pick its muscle group next': 'Своё упражнение; затем выберите группу мышц', 'Exercises found': 'Найденные упражнения',
    // the exercise list's sections
    'Presses': 'Жимы', 'Flys': 'Разводки', 'Pulldowns and pull-ups': 'Тяги сверху и подтягивания', 'Rows': 'Тяги', 'Raises': 'Подъёмы',
    'Rear delts and traps': 'Задние дельты и трапеции', 'Biceps': 'Бицепс', 'Triceps': 'Трицепс', 'Quads': 'Квадрицепсы', 'Hamstrings': 'Бицепс бедра',
    'Calves and inner thigh': 'Икры и внутренняя часть бедра', 'Machines': 'Тренажёры', 'Bikes': 'Велотренажёры', 'Track and pool': 'Дорожка и бассейн',
    // Meds
    'Morning': 'Утро', 'Midday': 'День', 'Evening': 'Вечер', 'Bedtime': 'Перед сном', 'Once a day': 'Раз в день', 'As needed': 'По необходимости', 'every day': 'каждый день',
    'Sun': 'Вс', 'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб', 'Medication': 'Лекарство', 'Supplement': 'Добавка',
    'Sign in to use Meds': 'Войдите, чтобы вести лекарства', 'Day before': 'Предыдущий день', 'Day after': 'Следующий день',
    'What do you take?': 'Что вы принимаете?', 'Taken': 'Принято', 'Not taken today': 'Сегодня не принято', 'Not taken this day': 'В этот день не принято',
    'Nothing due today.': 'На сегодня ничего нет.', 'Nothing due this day.': 'На этот день ничего нет.', 'Paused': 'На паузе', 'What you take': 'Что вы принимаете',
    'Add to what you take': 'Новый препарат', 'Name, like Vitamin D': 'Название, например витамин D',
    'Dose, like 1000 IU or 2 capsules (optional)': 'Доза, например 1000 МЕ или 2 капсулы (необязательно)', 'Name': 'Название', 'Dose': 'Доза',
    'Type': 'Тип', 'When': 'Когда', 'Days': 'Дни', 'Logged each time, never counted as missed.': 'Отмечается при каждом приёме, пропуском не считается.',
    'One tick for each, every day it’s due.': 'Отметка за каждый приём в нужные дни.', 'None picked: once a day, any time.': 'Ничего не выбрано: раз в день, в любое время.',
    'Resume': 'Возобновить', 'Pause': 'Пауза', 'Pause stops it coming due; deleting keeps your history.': 'Пауза убирает его из расписания; при удалении история сохраняется.',
    // Health
    'Sign in to see your Health': 'Войдите, чтобы видеть данные здоровья', 'Activity': 'Активность', 'Heart': 'Сердце', 'Sleep': 'Сон', 'Vitals': 'Показатели',
    'Good': 'Норма', 'Check': 'Внимание', 'Off': 'Вне нормы', 'Not rated': 'Без оценки', 'No data': 'Нет данных', 'So far': 'Пока', 'All usual': 'Всё как обычно',
    'Resting': 'В покое', 'Average': 'Среднее', 'HRV': 'ВСР', 'Sleep score': 'Оценка сна',
    'Very low': 'Очень низкая', 'Low': 'Низкая', 'High': 'Высокая', 'Very high': 'Очень высокая',
    'Your Apple Health, here': 'Ваши данные Apple Health', 'Link your iPhone to start.': 'Подключите iPhone, чтобы начать.',
    'Turn on Health sensors in the Home Assistant app.': 'Включите датчики здоровья в приложении Home Assistant.', 'Link your iPhone': 'Подключить iPhone', 'Open Settings': 'Открыть настройки',
    'Nothing from Apple Health yet today.': 'Сегодня из Apple Health пока ничего нет.', 'Nothing from Apple Health on this day.': 'В этот день из Apple Health ничего нет.',
    'Days shown': 'Период', 'Nothing in these days.': 'За эти дни ничего нет.', 'Trends': 'Тренды', 'Duration': 'Длительность', 'Efficiency': 'Эффективность',
    'Ranges: CDC, AHA, FDA. Not medical advice.': 'Нормы: CDC, AHA, FDA. Не медицинский совет.',
    'Active energy': 'Активная энергия', 'Resting energy': 'Энергия покоя', 'Walking + running': 'Ходьба и бег', 'Flights climbed': 'Пройдено этажей',
    'Heart rate': 'Пульс', 'Resting heart rate': 'Пульс в покое', 'Heart rate variability': 'Вариабельность пульса', 'Walking heart rate': 'Пульс при ходьбе',
    'Asleep': 'Сон', 'In bed': 'В кровати', 'Awake': 'Бодрствование', 'Deep': 'Глубокий', 'REM': 'Быстрый', 'Core': 'Пресс',
    'Blood oxygen': 'Кислород в крови', 'Respiratory rate': 'Частота дыхания', 'Body temperature': 'Температура тела', 'Basal body temperature': 'Базальная температура',
    'Blood pressure, systolic': 'Давление, систолическое', 'Blood pressure, diastolic': 'Давление, диастолическое', 'Blood glucose': 'Глюкоза в крови', 'VO₂ max': 'МПК (VO₂ max)',
    'steps': 'шагов', 'floors': 'этажей', 'kcal': 'ккал', 'bpm': 'уд/мин', 'ms': 'мс', 'min': 'мин', '/min': '/мин', 'mmHg': 'мм рт. ст.', 'mg/dL': 'мг/дл', 'mL/kg/min': 'мл/кг/мин', 'mmol/L': 'ммоль/л',
    // Settings
    'Daily goal': 'Цель на день', 'Move goal': 'Цель подвижности', 'Your iPhone’s steps': 'Шаги с iPhone', 'Sign in to link your iPhone': 'Войдите, чтобы подключить iPhone',
    'Checking Home Assistant…': 'Проверка Home Assistant…', 'Unlink': 'Отключить', 'Type your phone’s step sensor': 'Введите датчик шагов телефона',
    'Pick your own phone': 'Выберите свой телефон', 'No step sensors found that aren’t linked already.': 'Свободных датчиков шагов не найдено.', 'Link': 'Подключить',
    'Step sensor': 'Датчик шагов', 'Linked phones (owner)': 'Подключённые телефоны (владелец)', 'Vitals alerts': 'Оповещения о показателях',
    'Alerts you when a vital is off your usual.': 'Сообщает, когда показатель выходит за обычные для вас значения.',
    'Ask Ipsy about your patterns': 'Спросить Ипси о закономерностях', 'Ipsy finds patterns in your workouts, sleep and meds.': 'Ипси находит закономерности в тренировках, сне и лекарствах.',
    'This phone': 'Этот телефон', 'Sign out and erase': 'Выйти и стереть', 'Lost a phone?': 'Потеряли телефон?',
    'Not set up yet: the owner adds the Home Assistant token to the site (aOS/RELEASING.md, “Steps”), and the address in aOS.': 'Ещё не настроено: владелец добавляет токен Home Assistant на сайт (aOS/RELEASING.md, «Steps») и адрес в aOS.',
    'Home Assistant turned down the site’s token. The owner makes a new one (aOS/RELEASING.md, “Steps”).': 'Home Assistant не принял токен сайта. Владелец создаёт новый (aOS/RELEASING.md, «Steps»).',
    'Couldn’t reach Home Assistant. Try again in a minute.': 'Не удалось связаться с Home Assistant. Повторите через минуту.',
    'That phone is already linked to someone in the family. The owner can unlink it.': 'Этот телефон уже подключён к другому члену семьи. Владелец может его отключить.',
    'Home Assistant has no sensor by that name.': 'В Home Assistant нет датчика с таким именем.',
    'That isn’t a step sensor’s name: it looks like sensor.your_iphone_steps.': 'Это не имя датчика шагов: оно выглядит как sensor.your_iphone_steps.',
    'Linked. Your steps come in on their own.': 'Подключено. Шаги будут приходить сами.',
    'Sign out and erase Fitness from this phone (the Sheet keeps a copy)?': 'Выйти и стереть Фитнес с этого телефона (копия останется в таблице)?',
    'Sign out and erase Fitness from this phone, losing your unsynced log, Meds and Steps?': 'Выйти и стереть Фитнес с этого телефона? Несинхронизированные записи, лекарства и шаги пропадут.',
    'Sign in to use Meds.': 'Войдите, чтобы вести лекарства.', 'Sign in to see your Apple Health.': 'Войдите, чтобы видеть данные Apple Health.',
    'Sign in to read your iPhone’s steps.': 'Войдите, чтобы получать шаги с iPhone.', 'Sign in to ask Ipsy about your patterns.': 'Войдите, чтобы спрашивать Ипси о закономерностях.',
    // the Sheet
    'This phone couldn’t save Fitness: storage is full.': 'Телефон не смог сохранить Фитнес: память заполнена.',
    'This phone couldn’t save Fitness: storage is full. Your log is safe in the Google Sheet.': 'Телефон не смог сохранить Фитнес: память заполнена. Ваши записи в сохранности в Google-таблице.',
    'Sign in to sync your log.': 'Войдите, чтобы синхронизировать записи.',
    'The family’s Fitness Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.': 'Семейная таблица Фитнеса ещё не настроена. Владелец настраивает её в aOS: Профиль → Google Таблицы.',
    'aOS’s phrase for the Fitness Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.': 'Фраза aOS для таблицы Фитнеса больше не совпадает с её скриптом. Владелец обновляет её в aOS: Профиль → Google Таблицы.',
    'The Fitness Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).': 'У таблицы Фитнеса всё ещё старый скрипт. Владелец вставляет новый и публикует новую версию (aOS/SHEETS.md).',
    'The Fitness Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.': 'В скрипте таблицы Фитнеса всё ещё SECRET = ‘CHANGE-ME’. Владелец меняет его и публикует новую версию.',
    'The Sheet was busy. Trying again shortly.': 'Таблица была занята. Скоро попробуем снова.',
    'Offline. Changes will sync when you’re back online.': 'Нет сети. Изменения синхронизируются, когда связь вернётся.',
    'Couldn’t reach the Sheet. Trying again later.': 'Не удалось связаться с таблицей. Попробуем позже.',
    'The Sheet didn’t answer as expected. Trying again later.': 'Таблица ответила не так, как ожидалось. Попробуем позже.',
    'Sync didn’t work. Trying again later.': 'Синхронизация не удалась. Попробуем позже.',
    // Ipsy (ipsy-tools.js)
    'Adding up your weeks': 'Подсчитываю ваши недели', 'Looking at your meds list': 'Смотрю список лекарств', 'Looking at Fitness': 'Смотрю Фитнес',
    'Hi, I’m Ipsy! Ask me about patterns in your workouts, steps, meds and health.': 'Привет, я Ипси! Спросите меня о закономерностях в тренировках, шагах, лекарствах и здоровье.',
    'How did I sleep after leg days?': 'Как я сплю после дней ног?', 'Is my resting heart rate trending down?': 'Пульс в покое снижается?',
    'Did I miss meds more on low-sleep days?': 'Пропускаю ли я лекарства чаще, когда мало сплю?', 'Do I walk more on days I train?': 'Хожу ли я больше в дни тренировок?',
    'Your question and only the days Ipsy needs go to Claude, by Anthropic, through aOS; Anthropic doesn’t train on it. Ipsy only reads your log, has no web search, and isn’t a doctor.': 'Ваш вопрос и только нужные Ипси дни уходят в Claude от Anthropic через aOS; Anthropic не обучается на них. Ипси только читает ваши записи, не ищет в интернете и не врач.',
  }), [
    // the muscle group, the sleep stage (asked for with what it is: app.js trAs)
    [/^Muscle group: (.+)$/, m => G[m[1]] || m[1]],
    [/^Sleep stage: (.+)$/, m => SLEEP[m[1]] || m[1]],
    // "Today · суббота", "Chest · 3 × 10 · 100 lb", "7 days 85% · 30 days 90%": each part on its own
    [/·/, m => m.input.split(/\s*·\s*/).map(x => x ? part(x) : x).join(' · ')],
    // durations and units
    [/^(?:\d+ h(?: \d+ (?:min|m))?|\d+ min(?: \d+ s)?|\d{1,2} m|\d+ s|\d+h(?: \d+m)?|\d+m)$/, m => dur(m[0])],
    [/^([↑↓] )?([+−])(\d.*)$/, m => (m[1] || '') + m[2] + (dur(m[3]) || t(m[3]))],
    [new RegExp('^' + N + ' (steps|floors|kcal|bpm|ms|min|/min|mmHg|mg/dL|mL/kg/min|mmol/L|km)$'), m => unit(m[1], m[2])],
    [/^(.+) cardio$/, m => (dur(m[1]) || m[1]) + ' кардио'],
    [/^(\d+(?:\.\d)?)K$/, m => m[1].replace('.', ',') + 'К'],   // 10К шагов
    // counts
    [/^(\d+) exercises?$/, m => P(m[1], 'упражнение', 'упражнения', 'упражнений')],
    [/^(\d+) sets?$/, m => P(m[1], 'подход', 'подхода', 'подходов')],
    [/^(\d+) reps?$/, m => P(m[1], 'повторение', 'повторения', 'повторений')],
    [/^(\d+) days?$/, m => P(m[1], 'день', 'дня', 'дней')],
    [/^(\d+) times?$/, m => P(m[1], 'раз', 'раза', 'раз')],
    [/^(\d+) times?: (.+)$/, m => P(m[1], 'раз', 'раза', 'раз') + ': ' + m[2]],
    [new RegExp('^' + N + ' standard drinks$'), m => P(m[1], 'стандартный напиток', 'стандартных напитка', 'стандартных напитков')],
    [/^(\d+) days? trained this week$/, m => 'На этой неделе ' + P(m[1], 'день', 'дня', 'дней') + ' тренировок'],
    [/^Improving (\d+)$/, m => 'Прогресс: ' + m[1]],
    [/^needs work (\d+)$/, m => 'подтянуть: ' + m[1]],
    [/^(\d+) of (\d+) taken today$/, m => 'Сегодня принято ' + m[1] + ' из ' + m[2]],
    [/^(\d+) of (\d+) taken$/, m => 'Принято ' + m[1] + ' из ' + m[2]],
    [/^Slept (.+)$/, m => 'Сон ' + (dur(m[1]) || m[1])],
    [/^resting (.+)$/, m => 'в покое ' + t(m[1])],
    // the week's row, for VoiceOver: "суббота, 24 октября, 3 exercises, 8 412 steps, goal met"
    [/^([^A-Za-z]*[а-яё][^A-Za-z]*?), (.+)$/i, m => m[1] + ', ' + m[2].split(', ').map(part).join(', ')],
    // Analysis
    [/^([^A-Za-z]+) against ([^A-Za-z]+)$/, m => m[1] + ' в сравнении с ' + m[2]],
    [/^(up|down) (.+?)(?:, (\d+%))? on (the 7 before|the 4 weeks before)$/, m => updown(m[1], m[2]) + (m[3] ? ' (' + m[3] + ')' : '') + ' ' + BEFORE[m[4]]],
    [/^(up|down) (\d+%)$/, m => (m[1] === 'up' ? 'рост ' : 'спад ') + m[2]],
    [/^was (.+?)(?: on ([^A-Za-z]+))?$/, m => 'было ' + t(m[1]) + (m[2] ? ' (' + m[2] + ')' : '')],
    [/^Not trained in (the last 7 days|the last 4 weeks) \((\d+) sets? in (the 7 before|the 4 weeks before)\)$/, m => 'Не было ' + LAST[m[1]] + ' (' + P(m[2], 'подход', 'подхода', 'подходов') + ' ' + BEFORE[m[3]] + ')'],
    [/^None in (the last 7 days|the last 4 weeks) \((.+) in (the 7 before|the 4 weeks before)\)$/, m => 'Не было ' + LAST[m[1]] + ' (' + (dur(m[2]) || m[2]) + ' ' + BEFORE[m[3]] + ')'],
    [/^(\d+) sets?, down from (\d+)$/, m => P(m[1], 'подход', 'подхода', 'подходов') + ', было ' + m[2]],
    [new RegExp('^' + N + ' in (the 7 before|the 4 weeks before)$'), m => num(m[1]) + ' ' + BEFORE[m[2]]],
    [/^Days at goal \((.+)\)$/, m => 'Дни с целью (' + t(m[1]) + ')'],
    [/^([^:]+): (\d+) sets?, (\d+) before$/, m => m[1] + ': ' + P(m[2], 'подход', 'подхода', 'подходов') + ', раньше ' + m[3]],
    [/^([^:]+): ([^,]+), (.+)$/, m => t(m[1]) + ': ' + t(m[2]) + ', ' + t(m[3])],
    // a day
    [/^(\d+)% of your goal of (.+)$/, m => m[1] + '% от цели ' + m[2]],
    [/^goal (.+)$/, m => 'цель ' + t(m[1])],
    [/^Last time, (.+?): (.+)$/, m => 'В прошлый раз, ' + m[1] + ': ' + t(m[2])],
    [/^last (.+)$/, m => 'в прошлый раз ' + t(m[1])],
    [/^Now pick the muscle group for (.+)\.$/, m => 'Теперь выберите группу мышц для «' + m[1] + '».'],
    [/^Add “(.+)”$/, m => 'Добавить «' + m[1] + '»'],
    [/^No exercise matches “(.+)”\.$/, m => 'Нет упражнений по запросу «' + m[1] + '».'],
    [/^Add to ([а-яё]+)$/i, m => 'Добавить ' + (/^вт/i.test(m[1]) ? 'во ' : 'в ') + (ACC[m[1]] || m[1])],
    [/^Edit (.+)$/, m => 'Изменить: ' + (EX[m[1]] || m[1])],
    [/^Delete (.+)$/, m => 'Удалить: ' + (EX[m[1]] || m[1])],
    [/^Added (.+)$/, m => 'Добавлено: ' + (EX[m[1]] || m[1])],
    [/^Saved (.+)$/, m => 'Сохранено: ' + (EX[m[1]] || m[1])],
    [/^Deleted (.+)$/, m => 'Удалено: ' + (EX[m[1]] || m[1])],
    [/^Paused (.+)$/, m => 'На паузе: ' + m[1]],
    [/^Resumed (.+)$/, m => 'Возобновлено: ' + m[1]],
    // Meds
    [/^(?:Morning|Midday|Evening|Bedtime|Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?:, (?:Morning|Midday|Evening|Bedtime|Sun|Mon|Tue|Wed|Thu|Fri|Sat))+$/, m => m[0].split(', ').map(x => SLOTS[x]).join(', ')],
    [/^Taken (.+)$/, m => 'Принято в ' + m[1]],
    [/^Take back the last (.+)$/, m => 'Отменить последний приём: ' + m[1]],
    [/^Took (.+)$/, m => 'Принято: ' + m[1]],
    [/^(7|30) days (\d+%|—)$/, m => m[1] + ' дней: ' + m[2]],
    [/^(\d+)(\+?) days? in a row$/, m => m[1] + m[2] + ' ' + pl(m[1], 'день', 'дня', 'дней') + ' подряд'],
    // Health
    [/^(\d+) off$/, m => m[1] + ' вне нормы'],
    [/^(\d+) readings?$/, m => P(m[1], 'показатель', 'показателя', 'показателей')],
    [/^(Activity|Heart|Sleep|Vitals), ([^.]+?)(?:\. (.+))?$/, m => t(m[1]) + ', ' + t(m[2]).toLowerCase() + (m[3] ? '. ' + m[3].split(', ').map(part).join(', ') : '')],
    [new RegExp('^Move ' + N + ' of ' + N + ' kcal$'), m => 'Подвижность: ' + num(m[1]) + ' из ' + num(m[2]) + ' ккал'],
    [/^Exercise (\d+) of 30 min$/, m => 'Упражнения: ' + m[1] + ' из 30 мин'],
    [/^(Resting|Average|HRV) (\d.*)$/, m => t(m[1]) + ' ' + t(m[2])],
    [/^Sleep score (\d+)$/, m => 'Оценка сна ' + m[1]],
    [/^Sleep score (\d+), (.+)$/, m => 'Оценка сна ' + m[1] + ', ' + t(m[2]).toLowerCase()],
    [/^(.+) asleep$/, m => 'сон ' + (dur(m[1]) || m[1])],
    [/^(.+), the last (\d+) days(?:, (.+))?\. Arrow keys pick a day\.$/, m => t(m[1]) + ', последние ' + P(m[2], 'день', 'дня', 'дней') + (m[3] ? ', ' + t(m[3]) : '') + '. Стрелки выбирают день.'],
    [/^Sleep stages, the last (\d+) nights, a line at 7 hours\. Arrow keys pick a night\.$/, m => 'Фазы сна, последние ' + P(m[1], 'ночь', 'ночи', 'ночей') + ', линия на 7 часах. Стрелки выбирают ночь.'],
    [/^Move goal (.+)$/, m => 'цель подвижности ' + t(m[1])],
    [/^at least (.+)$/, m => 'не меньше ' + t(m[1])],
    [/^(healthy range|your usual) (.+) to (.+)$/, m => (m[1] === 'healthy range' ? 'норма ' : 'обычно ') + (dur(m[2]) || m[2]) + ' – ' + t(m[3])],
    [/^(.+?) (up|down) (\d.*)$/, m => (LABEL[m[1]] || t(m[1])) + (m[2] === 'up' ? ': выше на ' : ': ниже на ') + t(m[3])],
    [/^vs your (\d+)-day average$/, m => 'к среднему за ' + P(m[1], 'день', 'дня', 'дней')],
    // Settings
    [/^Your iPhone: (.+)$/, m => 'Ваш iPhone: ' + m[1]],
    [/^Couldn’t check Home Assistant \((.+)\)\.$/, m => 'Не удалось проверить Home Assistant (' + m[1] + ').'],
    [/^Couldn’t do that \((.+)\)\.$/, m => 'Не получилось (' + m[1] + ').'],
    // Ipsy's tools
    [/^Looking at your days(?:, (.+))?$/, m => 'Смотрю ваши дни' + (m[1] ? ', ' + m[1] : '')],
    [/^Comparing (.+) with (.+)$/, m => 'Сравниваю: ' + m[1] + ' и ' + m[2]],
  ]);
})();
