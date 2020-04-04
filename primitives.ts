export const generateRectVerticesStrip = (
    x: number,
    y: number,
    width: number,
    height: number
) => [x, y, x, y + height, x + width, y, x + width, y + height];

export const rectVerticesStripUV = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];
