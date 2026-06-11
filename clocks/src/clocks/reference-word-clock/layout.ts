export type WordLayout = {
  label: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  anchor?: 'start' | 'middle' | 'end';
};

export const VIEWBOX = {
  width: 524,
  height: 420,
  centerX: 262,
  centerY: 210,
};

export const WORD_LAYOUT: WordLayout[] = [
  {label: 'Twelve', x: 262, y: 48, rotation: 0, fontSize: 54, anchor: 'middle'},
  {label: 'One', x: 376, y: 102, rotation: -2, fontSize: 58, anchor: 'middle'},
  {label: 'Two', x: 438, y: 154, rotation: 2, fontSize: 58, anchor: 'middle'},
  {label: 'Three', x: 436, y: 218, rotation: -1, fontSize: 58, anchor: 'middle'},
  {label: 'Four', x: 404, y: 274, rotation: 2, fontSize: 56, anchor: 'middle'},
  {label: 'Five', x: 360, y: 327, rotation: -2, fontSize: 56, anchor: 'middle'},
  {label: 'Six', x: 262, y: 374, rotation: 0, fontSize: 58, anchor: 'middle'},
  {label: 'Seven', x: 180, y: 324, rotation: 1, fontSize: 54, anchor: 'middle'},
  {label: 'Eight', x: 111, y: 270, rotation: -2, fontSize: 54, anchor: 'middle'},
  {label: 'Nine', x: 75, y: 215, rotation: 1, fontSize: 56, anchor: 'middle'},
  {label: 'Ten', x: 98, y: 160, rotation: -2, fontSize: 56, anchor: 'middle'},
  {label: 'Eleven', x: 158, y: 104, rotation: 1, fontSize: 54, anchor: 'middle'},
];
