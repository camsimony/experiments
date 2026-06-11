export type WordLayout = {
  label: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  anchor?: 'start' | 'middle' | 'end';
};

export const VIEWBOX = {
  width: 420,
  height: 524,
  centerX: 210,
  centerY: 262,
};

export const WORD_LAYOUT: WordLayout[] = [
  {label: 'Twelve', x: 210, y: 82, rotation: 0, fontSize: 48, anchor: 'middle'},
  {label: 'One', x: 292, y: 118, rotation: -5, fontSize: 52, anchor: 'middle'},
  {label: 'Two', x: 346, y: 190, rotation: 3, fontSize: 50, anchor: 'middle'},
  {label: 'Three', x: 342, y: 263, rotation: -2, fontSize: 46, anchor: 'middle'},
  {label: 'Four', x: 326, y: 334, rotation: 4, fontSize: 48, anchor: 'middle'},
  {label: 'Five', x: 290, y: 411, rotation: -4, fontSize: 48, anchor: 'middle'},
  {label: 'Six', x: 210, y: 466, rotation: 0, fontSize: 50, anchor: 'middle'},
  {label: 'Seven', x: 128, y: 412, rotation: 5, fontSize: 46, anchor: 'middle'},
  {label: 'Eight', x: 88, y: 334, rotation: -3, fontSize: 46, anchor: 'middle'}, 
  {label: 'Nine', x: 72, y: 263, rotation: 2, fontSize: 50, anchor: 'middle'},
  {label: 'Ten', x: 95, y: 190, rotation: -5, fontSize: 52, anchor: 'middle'},
  {label: 'Eleven', x: 142, y: 120, rotation: 4, fontSize: 46, anchor: 'middle'},
];
