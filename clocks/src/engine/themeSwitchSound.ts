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

export type ThemeSwitchSoundSettings = {
  enabled: boolean;
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
  kit: '01',
  sound: 'select',
  volume: 0.32,
};

let themeSwitchSound: SndInstance | null = null;
let loadingKit: string | null = null;
let loadedKit: string | null = null;

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

export function playThemeSwitchSound(settings: ThemeSwitchSoundSettings = DEFAULT_SOUND_SETTINGS) {
  if (!settings.enabled) return;

  const sound = getThemeSwitchSound();
  if (!sound) return;

  preloadThemeSwitchSound(settings.kit);
  if (loadedKit !== settings.kit) return;

  try {
    sound.play(settings.sound, {volume: settings.volume});
  } catch (error) {
    console.warn(`[clocks] Could not play SND theme-switch sound ${settings.sound}.`, error);
  }
}
