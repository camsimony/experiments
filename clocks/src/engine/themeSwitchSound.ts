import SndModule from 'snd-lib';

export const SND_KIT_OPTIONS = [
  {value: '01', label: 'SND 01 — sine'},
  {value: '02', label: 'SND 02 — piano'},
  {value: '03', label: 'SND 03 — industrial'},
];

export const SND_SOUND_OPTIONS = [
  'select',
  'button',
  'tap',
  'toggle_on',
  'toggle_off',
  'transition_up',
  'transition_down',
  'swipe',
  'type',
  'notification',
  'disabled',
  'caution',
  'celebration',
];

export const SND_RANDOM_SOUND_OPTIONS = [
  'select',
  'button',
  'tap',
  'tap_01',
  'tap_02',
  'tap_03',
  'tap_04',
  'tap_05',
  'toggle_on',
  'toggle_off',
  'transition_up',
  'transition_down',
  'swipe',
  'swipe_01',
  'swipe_02',
  'swipe_03',
  'swipe_04',
  'swipe_05',
  'type',
  'type_01',
  'type_02',
  'type_03',
  'type_04',
  'type_05',
  'notification',
  'disabled',
  'caution',
  'celebration',
];

export type ThemeSwitchSoundSettings = {
  enabled: boolean;
  randomize: boolean;
  kit: string;
  sound: string;
  volume: number;
};

type SndInstance = {
  load: (soundKitKey: string) => Promise<void>;
  play: (soundKey: string, options?: {volume?: number}) => void;
};

type SndConstructor = {
  new (options?: {easySetup?: boolean; muteOnWindowBlur?: boolean; preloadSoundKit?: null | string}): SndInstance;
  KITS: Record<string, string>;
  SOUNDS: Record<string, string>;
};

const Snd = ((SndModule as unknown as {default?: SndConstructor}).default ?? SndModule) as SndConstructor;

const DEFAULT_SOUND_SETTINGS: ThemeSwitchSoundSettings = {
  enabled: true,
  randomize: false,
  kit: '01',
  sound: 'select',
  volume: 0.32,
};

let themeSwitchSound: SndInstance | null = null;
let loadingKit: string | null = null;
let loadedKit: string | null = null;
let lastRandomSound: string | null = null;

function getThemeSwitchSound() {
  if (typeof window === 'undefined') return null;

  if (!themeSwitchSound) {
    themeSwitchSound = new Snd({easySetup: false, muteOnWindowBlur: true});
  }

  return themeSwitchSound;
}

export function preloadThemeSwitchSound(kit = DEFAULT_SOUND_SETTINGS.kit) {
  const sound = getThemeSwitchSound();
  if (!sound || loadedKit === kit || loadingKit === kit) return;

  loadingKit = kit;
  void sound
    .load(kit)
    .then(() => {
      loadedKit = kit;
    })
    .catch((error) => {
      console.warn(`[clocks] Could not load SND theme-switch sound kit ${kit}.`, error);
    })
    .finally(() => {
      if (loadingKit === kit) loadingKit = null;
    });
}

function getRandomSoundKey() {
  if (SND_RANDOM_SOUND_OPTIONS.length <= 1) return SND_RANDOM_SOUND_OPTIONS[0];

  let nextSound = SND_RANDOM_SOUND_OPTIONS[Math.floor(Math.random() * SND_RANDOM_SOUND_OPTIONS.length)];
  if (nextSound === lastRandomSound) {
    const currentIndex = SND_RANDOM_SOUND_OPTIONS.indexOf(nextSound);
    nextSound = SND_RANDOM_SOUND_OPTIONS[(currentIndex + 1) % SND_RANDOM_SOUND_OPTIONS.length];
  }
  lastRandomSound = nextSound;
  return nextSound;
}

export function playThemeSwitchSound(settings: ThemeSwitchSoundSettings = DEFAULT_SOUND_SETTINGS) {
  if (!settings.enabled) return;

  const sound = getThemeSwitchSound();
  if (!sound) return;

  preloadThemeSwitchSound(settings.kit);
  if (loadedKit !== settings.kit) return;

  const soundKey = settings.randomize ? getRandomSoundKey() : settings.sound;

  try {
    sound.play(soundKey, {volume: settings.volume});
  } catch (error) {
    console.warn(`[clocks] Could not play SND theme-switch sound ${soundKey}.`, error);
  }
}
