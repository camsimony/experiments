export type HandAngles = {
  hour: number;
  minute: number;
  second: number;
};

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function calculateHandAngles(date: Date): HandAngles {
  const milliseconds = date.getMilliseconds();
  const seconds = date.getSeconds() + milliseconds / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;

  return {
    hour: normalizeAngle(hours * 30),
    minute: normalizeAngle(minutes * 6),
    second: normalizeAngle(seconds * 6),
  };
}
