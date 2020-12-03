export const generateRectVerticesStrip = (
    x: number,
    y: number,
    width: number,
    height: number
) => [x, y, x, y + height, x + width, y, x + width, y + height];

export const rectVerticesStripUV = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];

export const CUBE_VERTICES = [
    1, 1, -1,
    1, -1, -1,
    1, 1, 1,
    1, -1, 1,
    -1, 1, -1,
    -1, -1, -1,
    -1, 1, 1,
    -1, -1, 1
];

export const CUBE_INDICES = [
    4, 2, 0,
    2, 7, 3,
    6, 5, 7,
    1, 7, 5,
    0, 3, 1,
    4, 1, 5,
    4, 6, 2,
    2, 6, 7,
    6, 4, 5,
    1, 3, 7,
    0, 2, 3,
    4, 0, 1
];

export const CUBE_LINE_INDICES = [
    0, 1,
    0, 2,
    1, 5,
    2, 3,
    2, 6,
    3, 1,
    4, 0,
    4, 5,
    5, 7,
    6, 4,
    7, 3,
    7, 6,
];