// At the moment this represents a single-layer, editable image
// We're going to want everything to work in a linear space internally

import { srgbToRgb } from "./color";

export default class Slate {
    width: number;
    height: number;
    buffer: Uint8ClampedArray;

    history: Uint8ClampedArray[];
    historyIndex: number;

    updated: boolean;

    texture: WebGLTexture;

    // texture:
    constructor(gl: WebGLRenderingContext, width: number, height: number) {
        this.width = width;
        this.height = height;
        this.buffer = this.createLayerBuffer(true);

        this.history = [];
        this.historyIndex = 0;

        this.updated = true;

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    private createLayerBuffer(opaque: boolean) {
        const buffer = new Uint8ClampedArray(this.width * this.height * 4);

        if (opaque) {
            buffer.fill(255);
        }

        return buffer;
    }

    async load(url: string) {
        const imageData = await loadImage(url);

        this.buffer = imageData.data.map(u => Math.floor(srgbToRgb(u / 255) * 255));
        this.width = imageData.width;
        this.height = imageData.height;

        this.markUpdate();
        this.resetHistory();
    }

    markUpdate() {
        this.updated = true;
    }

    uploadTexture(gl: WebGLRenderingContext) {
        if (!this.updated) return;
        // upload texture

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
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

const loadImage = (url: string): Promise<ImageData> => new Promise((resolve, reject) => {
    // parse image file
    // we have to use Canvas as an intermediary
    const tempImg = document.createElement('img');

    tempImg.addEventListener('load', () => {
        try {
            const scratchCanvas = document.createElement('canvas');
            scratchCanvas.width = tempImg.width;
            scratchCanvas.height = tempImg.height;
            const scratchContext = scratchCanvas.getContext('2d');
            scratchContext.drawImage(tempImg, 0, 0);
            const imageData = scratchContext.getImageData(
                0,
                0,
                tempImg.width,
                tempImg.height
            );

            resolve(imageData);
        } catch (e) {
            reject(e);
        }
    });

    tempImg.addEventListener('error', reject);

    tempImg.src = url;
});