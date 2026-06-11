import type {ClockDefinition} from '../../app/clockTypes';
import {ReferenceWordClock} from './ReferenceWordClock';

export const referenceWordClock: ClockDefinition = {
  id: 'reference-word-clock',
  name: 'Reference word clock',
  Component: ReferenceWordClock,
};
