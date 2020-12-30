// At the moment this represents a single-layer, editable image
// We're going to want everything to work in a linear space internally

import BrushEngine from './brushEngine';
import Image, { ImageFormat, ImageStorage } from './loader/image';
import WindowManager, { loadTextureFromImage } from './windowManager';
import loadShaderProgram, { Shader } from './shaders';

import vertCompositeShader from 'url:./shaders/compositeShader/vert.glsl';
import fragCompositeShader from 'url:./shaders/compositeShader/frag.glsl';
import { generateRectVerticesStrip, rectVerticesStripUV } from './primitives';
import { mat4, vec3 } from 'gl-matrix';
import { srgbToRgb } from './color';
import Compositor, { createLayerTexture, fillTexture, O } from './compositor';

enum CompositeMode {
    Normal = 0,
    Multiply = 1,
}

export default class Slate {
    windowManager: WindowManager;
    gl: WebGLRenderingContext;

    width: number;
    height: number;

    history: WebGLTexture[];
    historyIndex: number;

    private updated: boolean;

    private committedAlbedo: WebGLTexture;
    albedo: WebGLTexture;
    currentOperation: WebGLTexture;

    private brushAlbedo: WebGLTexture;

    compositor: Compositor;

    // texture:
    constructor(wm: WindowManager, width: number, height: number) {
        this.windowManager = wm;
        this.gl = wm.gl;

        this.width = width;
        this.height = height;

        this.updated = true;

        const c = Math.round(0.8 * 255);

        this.committedAlbedo = createLayerTexture(
            this.gl,
            this.width,
            this.height,
            new Uint8ClampedArray([c, c, c, 255])
        );
        this.albedo = createLayerTexture(this.gl, this.width, this.height);
        this.currentOperation = createLayerTexture(
            this.gl,
            this.width,
            this.height,
            new Uint8ClampedArray([0, 0, 0, 255])
        );

        this.history = [
            createLayerTexture(
                this.gl,
                this.width,
                this.height,
                new Uint8ClampedArray([c, c, c, 255])
            ),
        ];
        this.historyIndex = 0;

        const gl = this.gl;

        this.brushAlbedo = gl.createTexture();

        this.compositor = new Compositor(wm, width, height);
    }

    set color(sRgb: vec3) {
        const [r, g, b] = sRgb.map(srgbToRgb);
        const buffer = new Uint8ClampedArray([r * 255, g * 255, b * 255, 255]);

        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.brushAlbedo);

        const level = 0;
        const internalFormat = gl.RGBA;
        const format = gl.RGBA;
        const border = 0;
        const type = gl.UNSIGNED_BYTE;

        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            1,
            1,
            border,
            format,
            type,
            buffer
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    load(image: Image) {
        // TODO: image to texture
        // switch (image.storage.type) {
        //     case ImageStorage.Uint8:
        //         this.albedoBuffer = image.storage.pixels;
        //         break;
        //     case ImageStorage.Float32:
        //         this.albedoBuffer = new Uint8ClampedArray(image.width * image.height * 4);

        //         let pixelWidth = 4;
        //         if (image.format === ImageFormat.RGB) {
        //             pixelWidth = 3;
        //         }

        //         let destIndex = 0;

        //         for (let i = 0; i < image.storage.pixels.length;) {
        //             const r = image.storage.pixels[i++];
        //             const g = image.storage.pixels[i++];
        //             const b = image.storage.pixels[i++];

        //             let a = 1;

        //             if (pixelWidth > 3) {
        //                 a = image.storage.pixels[i++];
        //             }

        //             this.albedoBuffer[destIndex++] = r * 255;
        //             this.albedoBuffer[destIndex++] = g * 255;
        //             this.albedoBuffer[destIndex++] = b * 255;
        //             this.albedoBuffer[destIndex++] = a * 255;
        //         }
        //         break;
        // }
        this.width = image.width;
        this.height = image.height;

        this.resetHistory();
    }

    markUpdate() {
        this.updated = true;
        this.windowManager.drawOnNextFrame();
    }

    resetHistory() {
        for (let i = 0; i < this.history.length; i++) {
            this.gl.deleteTexture(this.history[i]);
        }
        this.history = [];
        this.historyIndex = 0;
    }

    // TODO: make undo history work with textures

    // Undo history
    apply() {
        O(this.committedAlbedo)
            .mix(O(this.brushAlbedo).mask(this.currentOperation))
            .run(this.compositor, this.albedo);

        fillTexture(this.gl, this.currentOperation, this.width, this.height);

        this.committedAlbedo = createLayerTexture(
            this.gl,
            this.width,
            this.height
        );

        O(this.albedo)
            .mix(this.albedo)
            .run(this.compositor, this.committedAlbedo);

        // save image state in undo queue

        for (let i = this.historyIndex + 1; i < this.history.length; i++) {
            this.gl.deleteTexture(this.history[i]);
        }
        this.history.length = this.historyIndex + 1;

        this.history.push(this.committedAlbedo);
        this.historyIndex++;

        this.windowManager.drawOnNextFrame();
    }

    undo() {
        if (this.historyIndex > this.history.length) {
            this.historyIndex = this.history.length;
        }
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.committedAlbedo = this.history[this.historyIndex];
            this.markUpdate();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.committedAlbedo = this.history[this.historyIndex];
            this.markUpdate();
        }
    }

    updateTextures() {
        if (!this.updated) {
            return;
        }
        this.updated = false;

        O(this.committedAlbedo)
            .mix(O(this.brushAlbedo).mask(this.currentOperation))
            .run(this.compositor, this.albedo);
    }
}
