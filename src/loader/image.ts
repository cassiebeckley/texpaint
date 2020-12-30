export enum ImageFormat {
    RGB,
    RGBA,
}

export enum ImageStorage {
    Float32,
    Uint8,
}

export interface FloatImageBuffer {
    type: ImageStorage.Float32;
    pixels: Float32Array;
}

export interface IntImageBuffer {
    type: ImageStorage.Uint8;
    pixels: Uint8ClampedArray;
}

export type ImageBuffer = FloatImageBuffer | IntImageBuffer;

export default interface Image {
    width: number;
    height: number;
    format: ImageFormat;
    storage: ImageBuffer;
}
