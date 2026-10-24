// Russian for Weather (weather/) (../../lang.js says how the words are used). Whole texts as the page shows them,
// and patterns for the ones that carry a number or a name. Keep the English exactly as the app writes it.
'use strict';
(() => {
const FROM = { N: 'с севера', NE: 'с северо-востока', E: 'с востока', SE: 'с юго-востока', S: 'с юга', SW: 'с юго-запада', W: 'с запада', NW: 'с северо-запада' };
const DAMP = { Dry: 'Сухо', Comfy: 'Комфортно', Humid: 'Влажно', Muggy: 'Душно' };
// an hour as the app writes it: "15" in Russian (toLocaleTimeString), shown as 15:00
const hr = s => (/^\d{1,2}$/.test(s) ? s + ':00' : s);
// the radar's "15 min", "1h", "1h 15m"
const span = s => s.replace(/^(\d+) min$/, '$1 мин').replace(/^(\d+)h (\d+)m$/, '$1 ч $2 мин').replace(/^(\d+)h$/, '$1 ч');
const ago = s => (s === 'Now' ? 'Сейчас' : /^in /.test(s) ? 'через ' + span(s.slice(3)) : / ago$/.test(s) ? span(s.slice(0, -4)) + ' назад' : s);
const station = s => (s === 'the nearest station' ? 'ближайшей станции' : 'станции ' + s);
aosLang.add({
  // the conditions (V.words)
  'Sunny': 'Солнечно',
  'Clear': 'Ясно',
  'Partly Cloudy': 'Переменная облачность',
  'Cloudy': 'Облачно',
  'Rain': 'Дождь',
  'Heavy Rain': 'Сильный дождь',
  'Snow': 'Снег',
  'Sleet': 'Мокрый снег',
  'Fog': 'Туман',
  'Hail': 'Град',
  'Thunderstorms': 'Грозы',
  'Windy': 'Ветрено',
  'Severe': 'Опасная погода',
  // an alert's severity, when it has no end time
  'Extreme': 'Чрезвычайная опасность',
  'Moderate': 'Умеренная опасность',
  'Minor': 'Слабая опасность',
  'Unknown': 'Неизвестно',

  // the page
  'Weather': 'Погода',
  'Places': 'Места',
  'My Location': 'Моя геопозиция',
  'Use your location, or search for a city.': 'Используйте геопозицию или найдите город.',
  'Use my location': 'Моя геопозиция',
  'Search': 'Поиск',
  'Choose a place': 'Выбрать место',
  'Finding where you are…': 'Определяем, где вы…',
  'Couldn’t load the forecast': 'Не удалось загрузить прогноз',
  'Try again': 'Повторить',
  'Refresh': 'Обновить',
  'Updating…': 'Обновление…',
  'Location is not available in this browser.': 'В этом браузере геопозиция недоступна.',
  'Could not get your location.': 'Не удалось определить геопозицию.',
  'Location is off: allow it in Settings, or search for a city.': 'Геопозиция выключена: разрешите её в Настройках или найдите город.',
  'Location unavailable.': 'Геопозиция недоступна.',
  'NWS hourly forecast is empty': 'Почасовой прогноз NWS пуст',
  'Failed to fetch': 'Нет соединения с сетью',
  'Load failed': 'Нет соединения с сетью',

  // the hero
  'Dry today': 'Сегодня без осадков',

  // the timeline
  'Hourly': 'По часам',
  'Feels like': 'Ощущается как',
  'Humidity': 'Влажность',
  'Wind': 'Ветер',
  'Radar': 'Радар',
  'Timeline view': 'Вид шкалы',
  'Now': 'Сейчас',
  'Sunrise': 'Восход',
  'Sunset': 'Закат',
  'Forecast unavailable': 'Прогноз недоступен',
  'Reconnect to load this view': 'Подключитесь к сети, чтобы загрузить',
  'Details for now': 'Подробнее: сейчас',
  'Details for today': 'Подробнее: сегодня',

  // the radar
  'Zoom in': 'Приблизить',
  'Zoom out': 'Отдалить',
  'Play or pause the loop': 'Воспроизвести или приостановить',
  'Radar time': 'Время на радаре',
  'Forecast': 'Прогноз',
  '© OpenStreetMap © CARTO · Radar: NWS NEXRAD, forecast: NWS HRRR, via Iowa Environmental Mesonet': '© OpenStreetMap © CARTO · Радар: NWS NEXRAD, прогноз: NWS HRRR, через Iowa Environmental Mesonet',
  'Radar covers the continental US': 'Радар показывает только континентальную часть США',
  'No radar forecast right now: showing the latest radar.': 'Прогноза радара сейчас нет: показан последний снимок.',
  'Radar couldn’t load': 'Не удалось загрузить радар',
  'Check your connection, or': 'Проверьте подключение или',
  'open the NWS radar': 'откройте радар NWS',
  'Radar images aren’t available right now.': 'Снимки радара сейчас недоступны.',

  // the week
  'Today': 'Сегодня',
  '7-day forecast': 'Прогноз на 7 дней',

  // the hour and day sheets
  'Hour': 'Час',
  'Day': 'День',
  'Night': 'Ночь',
  'Tonight': 'Ночью',
  'Previous hour': 'Предыдущий час',
  'Next hour': 'Следующий час',
  'Previous day': 'Предыдущий день',
  'Next day': 'Следующий день',
  'Close': 'Закрыть',
  'Same as the air': 'Как воздух',
  'Chance of rain': 'Вероятность осадков',
  'None': 'Нет',
  'Unlikely': 'Маловероятно',
  'Dry hour': 'Без осадков',
  'Total for the day': 'Всего за день',
  'A dry day': 'Без осадков',
  'All day': 'Весь день',
  'Through the day': 'В течение дня',
  'Temperature': 'Температура',
  'National Weather Service': 'Национальная метеослужба США',
  'Hour-by-hour detail isn\'t available for this day yet.': 'Почасового прогноза на этот день пока нет.',
  'NWS forecast for this spot.': 'Прогноз NWS для этой точки.',
  'From the north': 'С севера',
  'From the northeast': 'С северо-востока',
  'From the east': 'С востока',
  'From the southeast': 'С юго-востока',
  'From the south': 'С юга',
  'From the southwest': 'С юго-запада',
  'From the west': 'С запада',
  'From the northwest': 'С северо-запада',
  'N': 'С', 'NE': 'СВ', 'E': 'В', 'SE': 'ЮВ', 'S': 'Ю', 'SW': 'ЮЗ', 'W': 'З', 'NW': 'СЗ',
  'Dry': 'Сухо',
  'Comfy': 'Комфортно',
  'Humid': 'Влажно',
  'Muggy': 'Душно',

  // the Places sheet
  'Design': 'Дизайн',
  'Add a city': 'Добавить город',
  'Your places': 'Ваши места',
  'Units': 'Единицы',
  'No matches': 'Ничего не найдено',
  'Search is unavailable offline': 'Без сети поиск недоступен',
  'Location unavailable · tap to retry': 'Геопозиция недоступна · нажмите, чтобы повторить',
  'Tap to find where you are': 'Нажмите, чтобы определить, где вы',
}, [
  // the hero: "H:72°  L:55°"
  [/^H:(-?\d+)° L:(-?\d+)°$/, m => '↑' + m[1] + '°\u00a0\u00a0↓' + m[2] + '°'],   // the high and low: arrows, as the Russian words don't fit on the disc
  [/^(\d+)% chance$/, m => 'Осадки ' + m[1] + '%'],
  // rain starting or stopping: "Rain stops at 15:45", "Snow through 18:15", "Rain at 15:45"
  [/^(Rain|Snow) stops at (.+)$/, m => (m[1] === 'Snow' ? 'Снег' : 'Дождь') + ' закончится в ' + m[2]],
  [/^(Rain|Snow) through (.+)$/, m => (m[1] === 'Snow' ? 'Снег' : 'Дождь') + ' до ' + m[2]],
  [/^(Rain|Snow) at (.+)$/, m => (m[1] === 'Snow' ? 'Снег' : 'Дождь') + ' в ' + m[2]],
  // the timeline and the week
  [/^Details for (.+)$/, m => 'Подробнее: ' + hr(m[1])],
  [/^(Now|in \d+(?: min|h(?: \d+m)?)|\d+(?: min|h(?: \d+m)?) ago)( · loading)?$/, m => ago(m[1]) + (m[2] ? ' · загрузка' : '')],
  // an alert's end
  [/^Until (.+)$/, m => 'До ' + m[1]],
  // the footer
  [/^Offline · showing (.+)$/, m => 'Нет сети · данные на ' + m[1]],
  [/^Location unavailable · last known place · (.+)$/, m => 'Геопозиция недоступна · последнее место · ' + m[1]],
  [/^(NWS|Open-Meteo) \(NWS unavailable\) · (.+)$/, m => m[1] + ' (NWS недоступна) · ' + m[2]],
  [/^(\S+) did not answer$/, m => m[1] + ' не отвечает'],
  // the Places sheet and the page dots
  [/^(.+), place (\d+) of (\d+)$/, m => (m[1] === 'My Location' ? 'Моя геопозиция' : m[1]) + ', место ' + m[2] + ' из ' + m[3]],
  [/^Remove a place to add another \((\d+) at most\)\.$/, m => 'Удалите место, чтобы добавить новое (не больше ' + m[1] + ').'],
  [/^Remove (.+)$/, m => 'Удалить ' + m[1]],
  // the hour sheet
  [/^(\d+)° warmer than the air$/, m => 'На ' + m[1] + '° теплее воздуха'],
  [/^(\d+)° cooler than the air$/, m => 'На ' + m[1] + '° холоднее воздуха'],
  [/^NWS forecast, adjusted ([+−±]\d+°) by (.+) at (\S+), ?(.*?) ?away\.$/, m => 'Прогноз NWS с поправкой ' + m[1] + ' по ' + station(m[2]) + ' в ' + m[3] + (m[4] ? ', ' + m[4] + ' отсюда' : '') + '.'],
  [/^From (.+) at (\S+), ?(.*?) ?away\.$/, m => 'По данным ' + station(m[1]) + ' в ' + m[2] + (m[3] ? ', ' + m[3] + ' отсюда' : '') + '.'],
  // the day sheet
  [/^Most likely around (.+)$/, m => 'Скорее всего около ' + hr(m[1])],
  [/^Heaviest around (.+)$/, m => 'Сильнее всего около ' + hr(m[1])],
  [/^Strongest at (.+?)(?:, from the (N|NE|E|SE|S|SW|W|NW))?$/, m => 'Сильнее всего в ' + hr(m[1]) + (m[2] ? ', ' + FROM[m[2]] : '')],
  [/^(Dry|Comfy|Humid|Muggy), (\d+)–(\d+)%$/, m => DAMP[m[1]] + ', ' + m[2] + '–' + m[3] + '%'],
  [/^Down to (-?\d+)°$/, m => 'Минимум ' + m[1] + '°'],
  [/^(\d+)h (\d+)m of daylight$/, m => 'Световой день ' + m[1] + ' ч ' + m[2] + ' мин'],
  [/^High (-?\d+)°, low (-?\d+)°$/, m => 'Макс. ' + m[1] + '°, мин. ' + m[2] + '°'],
  [/^Temperature from (-?\d+)° to (-?\d+)° through the day$/, m => 'Температура за день: от ' + m[1] + '° до ' + m[2] + '°'],
]);
})();
