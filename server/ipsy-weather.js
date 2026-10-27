// Weather's part of Ipsy in aOS (functions/aOS/api/ipsy.js). Not a route: Weather has no chat of its
// own, only tools that aOS runs inside it (weather/ipsy-tools.js, offered as AllisonOS.ipsyTools).
// The same two exports as an app with Ipsy: the tools Claude may ask for, and how Ipsy works there.
import { T, persona } from './ipsy.js';

const PLACE = { type: 'string', description: 'One of their places by id from get_places ("here", "trip", "p0"…), or any city ("Boston", "Paris, France")' };

export const IPSY_CLIENT_TOOLS = [
  T('get_places', 'The person\'s places in Weather: where they are now ("here"), where their next trip goes ("trip", from Travel), and the cities they saved, each with its id, kind and the temperature last seen; plus their units and the place on screen.', {}),
  T('get_forecast', 'The forecast for one place: now (condition, temperature, feels like, humidity, wind), when rain or snow starts or stops in the next hours (rain_soon), the next hours, the next days (high, low, precipitation, the National Weather Service\'s words for day and night) and any weather alerts. In the person\'s units; times in the place\'s own time zone.', {
    place: PLACE,
    hours: { type: 'integer', minimum: 0, maximum: 48, description: 'How many hours ahead (default 12; 0 for none)' },
    days: { type: 'integer', minimum: 0, maximum: 7, description: 'How many days (default 7; 0 for none)' },
  }, ['place']),
  T('show_place', 'Open Weather on one of their places, behind the chat, and optionally a view of its timeline (radar for the rain map).', {
    place: { type: 'string', description: 'One of their places by id from get_places ("here", "trip", "p0"…)' },
    view: { type: 'string', enum: ['now', 'feels', 'humidity', 'wind', 'radar'] },
  }, ['place']),
];

export const IPSY_SYSTEM = persona({
  app: 'Weather',
  about: 'an iPhone app with the forecast for where the family is, where their next trip goes, and the cities they saved, from the National Weather Service (Open-Meteo outside the US)',
  can: [
    'See their places (get_places) and the forecast for any of them, or for any city (get_forecast): now, rain or snow in the next hours, the next hours and days, and weather alerts.',
    'Open Weather on a place, or its rain radar (show_place).',
  ],
  rules: [
    'For the weather, use get_forecast rather than the web: it is what the app shows. Say where it is for when it isn\'t where they are, and the time it was as of when it\'s over an hour old.',
    'Weather alerts matter: when get_forecast has any, say so first, in a line, with what to do.',
    'precipitation is a chance (%) from the National Weather Service, or an amount (in or mm) elsewhere: say which.',
    'Weather only reads: it changes nothing. Units (°F or °C) are a setting (weather.units).',
  ],
  bold: 'a place',
  privacy: false,
});
