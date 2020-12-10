// At the moment this represents a single-layer, editable image
// We're going to want everything to work in a linear space internally

import Image, { ImageFormat, ImageStorage } from "./loader/image";

export default class Slate {
    width: number;
    height: number;
    buffer: Uint8ClampedArray;

    history: Uint8ClampedArray[];
    historyIndex: number;

    updated: boolean;

    albedo: WebGLTexture;

    // texture:
    constructor(gl: WebGLRenderingContext, width: number, height: number) {
        this.width = width;
        this.height = height;
        this.buffer = this.createLayerBuffer(true);

        this.history = [];
        this.historyIndex = 0;

        this.updated = true;

        this.albedo = gl.createTexture();
    }

    private createLayerBuffer(opaque: boolean) {
        const buffer = new Uint8ClampedArray(this.width * this.height * 4);

        if (opaque) {
            buffer.fill(255);
        }

        return buffer;
    }

    load(image: Image) {
        switch (image.storage.type) {
            case ImageStorage.Uint8:
                this.buffer = image.storage.pixels;
                break;
            case ImageStorage.Float32:
                this.buffer = new Uint8ClampedArray(image.width * image.height * 4);

                let pixelWidth = 4;
                if (image.format === ImageFormat.RGB) {
                    pixelWidth = 3;
                }

                let destIndex = 0;

                for (let i = 0; i < image.storage.pixels.length;) {
                    // const [r, g, b] = image.storage.pixels.slice(i, 3).map(v => 255 * v);
                    const r = image.storage.pixels[i++];
                    const g = image.storage.pixels[i++];
                    const b = image.storage.pixels[i++];

                    let a = 1;

                    if (pixelWidth > 3) {
                        a = image.storage.pixels[i++];
                    }

                    this.buffer[destIndex++] = r * 255;
                    this.buffer[destIndex++] = g * 255;
                    this.buffer[destIndex++] = b * 255;
                    this.buffer[destIndex++] = a * 255;
                }
                break;
        }
        this.width = image.width;
        this.height = image.height;

        this.markUpdate();
        this.resetHistory();
    }

    markUpdate() {
        this.updated = true;
    }

    uploadTexture(gl: WebGLRenderingContext) {
        if (!this.updated) return;
        // upload texture

        gl.bindTexture(gl.TEXTURE_2D, this.albedo); // TODO: store buffer as Image and use loadTextureFromImage
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            srcFormat,
            srcType,
            new ImageData(this.buffer, this.width)
        );
    }

    resetHistory() {
        // reset history
        this.history = [];
        this.historyIndex = 0;
    }

    // Undo history
    checkpoint() {
        // save image state in undo queue

        this.history.length = this.historyIndex;

        const currentBuffer = new Uint8ClampedArray(this.buffer);
        this.history.push(currentBuffer);
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > this.history.length) {
            this.historyIndex = this.history.length;
        }
        if (this.historyIndex > 0) {
            this.history[this.historyIndex] = new Uint8ClampedArray(
                this.buffer
            );
            this.historyIndex--;
            this.buffer = this.history[this.historyIndex];
            this.markUpdate();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.buffer = this.history[this.historyIndex];
            this.markUpdate();
        }
    }
}