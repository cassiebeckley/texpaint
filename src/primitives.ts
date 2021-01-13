import { vec3 } from 'gl-matrix';

export const generateRectVerticesStrip = (
    x: number,
    y: number,
    width: number,
    height: number
) => [x, y, x, y + height, x + width, y, x + width, y + height];

export const rectVerticesStripUV = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];

export const generateRectVertices = (
    x: number,
    y: number,
    width: number,
    height: number
) => [
    x,
    y,
    x,
    y + height,
    x + width,
    y,
    x + width,
    y,
    x,
    y + height,
    x + width,
    y + height,
];

export const rectVerticesUV = [
    0.0,
    0.0,
    0.0,
    1.0,
    1.0,
    0.0,
    1.0,
    0.0,
    0.0,
    1.0,
    1.0,
    1.0,
];

const unitRectPositionBufferCache = new WeakMap();
export const getUnitRectPositionBuffer = (gl: WebGLRenderingContext) => {
    if (unitRectPositionBufferCache.has(gl)) {
        return unitRectPositionBufferCache.get(gl);
    }

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(generateRectVerticesStrip(0, 0, 1, 1)),
        gl.STATIC_DRAW
    );

    unitRectPositionBufferCache.set(gl, buffer);

    return buffer;
};

const unitRectUVBufferCache = new WeakMap();
export const getUnitRectUVBuffer = (gl: WebGLRenderingContext) => {
    if (unitRectUVBufferCache.has(gl)) {
        return unitRectUVBufferCache.get(gl);
    }

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(rectVerticesStripUV),
        gl.STATIC_DRAW
    );

    unitRectUVBufferCache.set(gl, buffer);

    return buffer;
};

export const CUBE_VERTICES = [
    1,
    1,
    -1,
    1,
    -1,
    -1,
    1,
    1,
    1,
    1,
    -1,
    1,
    -1,
    1,
    -1,
    -1,
    -1,
    -1,
    -1,
    1,
    1,
    -1,
    -1,
    1,
];

export const CUBE_INDICES = [
    4,
    2,
    0,
    2,
    7,
    3,
    6,
    5,
    7,
    1,
    7,
    5,
    0,
    3,
    1,
    4,
    1,
    5,
    4,
    6,
    2,
    2,
    6,
    7,
    6,
    4,
    5,
    1,
    3,
    7,
    0,
    2,
    3,
    4,
    0,
    1,
];

export const CUBE_LINE_INDICES = [
    0,
    1,
    0,
    2,
    1,
    5,
    2,
    3,
    2,
    6,
    3,
    1,
    4,
    0,
    4,
    5,
    5,
    7,
    6,
    4,
    7,
    3,
    7,
    6,
];

export const generateCircleVertices = (vertexCount: number): number[] => {
    const origin = vec3.create();

    const firstVertex = vec3.create();
    vec3.set(firstVertex, 1, 0, 0);

    const vertices = [];
    const rotation = (2 * Math.PI) / vertexCount;

    const vertex = vec3.create();
    for (let i = 0; i < vertexCount; i++) {
        vec3.rotateY(vertex, firstVertex, origin, i * rotation);

        vertices.push(vertex[0]);
        vertices.push(vertex[1]);
        vertices.push(vertex[2]);
    }

    return vertices;
};
