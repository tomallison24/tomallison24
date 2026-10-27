// Home's part of Ipsy in aOS (functions/aOS/api/ipsy.js). Not a route: Home has no chat of its own,
// only tools that aOS runs inside it (house/ipsy-tools.js, offered as AllisonOS.ipsyTools), on the
// phone's own Home Assistant connection: its token never leaves the phone. The same two exports as an
// app with Ipsy: the tools Claude may ask for, and how Ipsy works there. What Ipsy may change is
// decided on the phone, by what each device is (house/ipsy-tools.js); these words only explain it.
import { T, persona } from './ipsy.js';

const KINDS = ['light', 'thermostat', 'air purifier', 'dehumidifier', 'speaker', 'tv', 'vacuum', 'heater', 'blind', 'automation', 'alarm', 'camera', 'lock'];

export const IPSY_CLIENT_TOOLS = [
  T('list_devices', 'The devices on Home\'s cards, as they are now: each one\'s id, name, kind, room (lights), state (on or off, brightness, mode and temperatures, volume and what\'s playing…) and whether Ipsy can change it. Filter by kind or room; kind "automation" lists the automations.', {
    kind: { type: 'string', enum: KINDS },
    room: { type: 'string', description: 'Part of a room or device name (lights have rooms: Living Room, Lounge, Kitchen, Sofia\'s Bedroom, M&D Bedroom, Outdoor)' },
  }),
  T('control', 'Change one device, by its id from list_devices. The actions by kind: light on, off, brightness (value 1-100); thermostat on, off, mode (value: one of its modes), temperature (value, or low and high in Auto); air purifier on, off, auto, speed (value 1-10); dehumidifier on, off, humidity (value 35-85), mode (value); speaker and tv play, pause, next, previous, volume (value 0-100), mute, unmute, on, off; vacuum start, pause, dock; heater on, off, temperature (value 50-86); blind position (value 0-100, % open); automation on, off. Heaters, blinds and automations ask the person first; the alarm, cameras and locks can\'t be changed at all.', {
    id: { type: 'string', description: 'The device\'s id from list_devices' },
    action: { type: 'string', enum: ['on', 'off', 'brightness', 'mode', 'temperature', 'auto', 'speed', 'humidity', 'play', 'pause', 'next', 'previous', 'volume', 'mute', 'unmute', 'start', 'dock', 'position'] },
    value: { type: ['number', 'string'], description: 'For brightness, temperature, speed, humidity, volume and position a number; for mode the mode\'s name' },
    low: { type: 'number', description: 'Thermostat in Auto: heat to' },
    high: { type: 'number', description: 'Thermostat in Auto: cool to' },
  }, ['id', 'action']),
  T('open_home', 'Open Home on the person\'s screen, behind the chat: for the alarm, cameras and locks (Ipsy never changes them), or anything Ipsy can\'t do.', {}),
];

export const IPSY_SYSTEM = persona({
  app: 'Home',
  about: 'an iPhone app for the family\'s house: lights, thermostats, air purifiers, dehumidifiers, speakers and the TV, vacuums, heaters, blinds, cameras and the alarm, through Home Assistant',
  can: [
    'See every device on Home\'s cards and how it is now (list_devices), and the automations (list_devices kind "automation").',
    'Change lights, thermostats, air purifiers, dehumidifiers, speakers and the TV, and vacuums (control): each change shows with Undo.',
    'Turn heaters on or off or set them, move the blinds, and turn an automation on or off (control): these ask the person first, in the chat, with Yes and No.',
    'Open Home on their screen (open_home).',
  ],
  rules: [
    'Never the alarm, cameras, the doorbell or locks: you can say how they are (armed or not, motion detection on or off), never change them, whoever asks and however. Say so in a line and offer open_home, so they do it themselves.',
    'Look before you change: list_devices for the id and how it is now. Change what was asked and nothing more: "turn off the kitchen" is the Kitchen\'s lights, not the speaker there. "All the lights" means each light on the list (call control for each, at once); outdoor lights only when they say outdoor or all.',
    'Heaters, blinds and automations ask the person first: the app shows the question with Yes and No, so don\'t ask in words as well. If they say no, nothing changed: say so.',
    'If Home isn\'t connected to Home Assistant on this phone, or a device is offline, say so plainly, and that they can connect it in Home\'s Settings.',
    'Keep device names, rooms and whether anyone is home out of web searches.',
  ],
  bold: 'a device or a room',
  privacy: false,
});
