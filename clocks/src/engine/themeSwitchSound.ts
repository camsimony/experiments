import SndModule from 'snd-lib';

type SndInstance = {
  load: (soundKitKey: string) => Promise<void>;
  playSelect: (options?: {volume?: number}) => void;
};

type SndConstructor = {
  new (options?: {easySetup?: boolean; muteOnWindowBlur?: boolean; preloadSoundKit?: null | string}): SndInstance;
  KITS: Record<string, string>;
};

const Snd = ((SndModule as unknown as {default?: SndConstructor}).default ?? SndModule) as SndConstructor;

let themeSwitchSound: SndInstance | null = null;
let loadStarted = false;
let loaded = false;

function getThemeSwitchSound() {
  if (typeof window === 'undefined') return null;

  if (!themeSwitchSound) {
    themeSwitchSound = new Snd({easySetup: false, muteOnWindowBlur: true});
  }

  return themeSwitchSound;
}

export function preloadThemeSwitchSound() {
  const sound = getThemeSwitchSound();
  if (!sound || loadStarted) return;

  loadStarted = true;
  void sound
    .load(Snd.KITS.SND01)
    .then(() => {
      loaded = true;
    })
    .catch((error) => {
      console.warn('[clocks] Could not load SND theme-switch sound.', error);
    });
}

export function playThemeSwitchSound() {
  const sound = getThemeSwitchSound();
  if (!sound || !loaded) return;

  try {
    sound.playSelect({volume: 0.32});
  } catch (error) {
    console.warn('[clocks] Could not play SND theme-switch sound.', error);
  }
}
