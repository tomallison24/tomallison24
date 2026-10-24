# aOS in Russian

aOS and every app can be read in English (the default) or Russian: Account > Appearance > Language in
aOS, for aOS and every app at once (`localStorage['aos.lang']`, synced with the family account).

## How it works

`home/lang.js` (in every page's `<head>`) does nothing in English. In Russian it swaps the words on the
page as they are drawn, from the word files here:

- `ru/shared.js`: what every page shows from `home/` (welcome, walkthroughs, update screens, install
  steps, Ipsy, sign-in, Settings > Design, the floating back button...);
- `ru/<app>.js`: the app's own (`ru/aos.js` for aOS).

A word file is one call:

```js
aosLang.add({
  'Done': 'Готово',
  'No dinners planned yet': 'Ужины ещё не запланированы',
}, [
  [/^(\d+) items?$/, m => m[1] + ' ' + aosLang.plural(m[1], 'позиция', 'позиции', 'позиций')],
  [/^Updated (.+)$/, m => 'Обновлено ' + aosLang.t(m[1])],
]);
```

- **Whole texts.** Each text node, and each `placeholder`, `aria-label`, `title` and `alt`, is looked up
  whole (spaces squeezed, ends trimmed). `<b>6</b> items` is two text nodes, `6` and ` items`: the
  second is looked up as `items`. A text built from a number or a name (`'Updated ' + when`) needs a
  pattern.
- **Patterns** are tried in order, after the whole texts, and only on a whole text node. Anchor them
  (`^...$`) and keep them narrow: a loose pattern can catch what the family wrote. A pattern's function
  that gives back `null` passes: the next pattern is tried (shared.js's run first, on every page).
- **Left as is:** anything inside an element with `translate="no"`, or contenteditable, or a textarea.
  Put `translate="no"` on what the family wrote (notes, list items, events, mail, names) and on outside
  content (news stories, podcast titles, places from the map) so a note called "Done" isn't translated.
- **Dates and numbers** are Russian by themselves: `toLocaleString`, `toLocaleDateString`,
  `toLocaleTimeString` and the `Intl` formats asked for in the phone's language or in English give
  Russian (`21:41`, `24 октября`, `1 234,5`). Day and month names the app writes out itself
  (`['Sun', 'Mon', ...]`) need words or patterns.
- **Ipsy** is told to answer in Russian; what Ipsy and the person write is `translate="no"`.

Check with `node aOS/scripts/lang-scan.mjs <app>`: the English still on the page (shown or not), in
Russian. It sees the page as it opens with no data; sheets, empty states and errors built by the app's
script are only there once drawn, so read the script for those too.

## Glossary

Use these everywhere, so the apps read as one. Natural, short Russian, as in iOS's Russian; imperatives
for buttons (`Добавить`, not `Добавьте`); `вы` (lowercase) only when a sentence needs it. Keep the
English capitalisation style: only the first word capitalised.

| English | Russian |
|---|---|
| Done | Готово |
| Cancel | Отмена |
| Undo | Отменить |
| Close | Закрыть |
| OK | ОК |
| Save | Сохранить |
| Edit | Изменить |
| Delete / Remove | Удалить |
| Add | Добавить |
| Search | Поиск |
| Back | Назад |
| More | Ещё |
| Settings | Настройки |
| Try again | Повторить |
| Loading… | Загрузка… |
| Something went wrong | Что-то пошло не так |
| Sign in / Sign out | Войти / Выйти |
| Account | Профиль |
| Family | Семья |
| Home (aOS's tab) | Главная |
| Today | Сегодня |
| Favorites | Избранное |
| Notifications | Уведомления |
| Appearance | Оформление |
| Look (aOS) / Design (an app) | Стиль / Дизайн |
| Language | Язык |
| Automatic / Light / Dark | Авто / Светлая / Тёмная |
| Vintage / Standard / Sea glass | Винтаж / Стандарт / Морское стекло |
| Night Drive / Folk | Ночная трасса / Народный |
| Updates / What's new | Обновления / Что нового |
| Subscription / Plan | Подписка / План |
| Get / Installed / Open | Загрузить / Установлено / Открыть |
| Ipsy | Ипси |
| aOS | aOS (never translated, always a lowercase a) |
| Mail, Calendar, Clock, News, Weather | Почта, Календарь, Часы, Новости, Погода |
| Notes, Podcasts, Travel, Places | Заметки, Подкасты, Поездки, Места |
| Fitness, Drinks, Meals, Orders, Home (the app) | Фитнес, Напитки, Меню, Заказы, Дом |

Names of services and things stay in Latin letters: Google, Gmail, iPhone, Face ID, Home Assistant,
Wi-Fi, and units (°F, mph, kWh).
