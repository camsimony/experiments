import type {ClockDefinition} from './clockTypes';
import {DEFAULT_CLOCK_ID} from './galleryState';
import {referenceWordClock} from '../clocks/reference-word-clock/metadata';

export const clockRegistry: ClockDefinition[] = [referenceWordClock];

export function getClockById(clockId: string): ClockDefinition {
  return clockRegistry.find((clock) => clock.id === clockId)
    ?? clockRegistry.find((clock) => clock.id === DEFAULT_CLOCK_ID)
    ?? clockRegistry[0];
}
