// At the moment this represents a single-layer, editable image
// We're going to want everything to work in a linear space internally

import Image from './loader/image';
import WindowManager, { loadTextureFromImage } from './windowManager';

import { vec3 } from 'gl-matrix';
import { srgbToRgb } from './color';
import Compositor, { createLayerTexture, fillTexture, O } from './compositor';

const DEFAULT_ALBEDO = 0.8;
const DEFAULT_ALBEDO_BYTE = Math.round(DEFAULT_ALBEDO * 255);
const DEFAULT_ROUGHNESS = 0.5;
const DEFAULT_METALLIC = 0.0;

class Layer {
    albedo: WebGLTexture;
    roughness: WebGLTexture;
    metallic: WebGLTexture;

    constructor(
        gl: WebGLRenderingContext,
        width: number,
        height: number,
        fillColor?: Uint8ClampedArray,
        fillRoughness?: number,
        fillMetallic?: number
    ) {
        this.albedo = createLayerTexture(gl, width, height, fillColor);

        const roughnessByte = fillRoughness * 255; // TODO: go over all the places float colors are converted to bytes and adjust mapped range
        const metallicByte = fillMetallic * 255;
        this.roughness = createLayerTexture(
            gl,
            width,
            height,
            new Uint8ClampedArray([
                roughnessByte,
                roughnessByte,
                roughnessByte,
                255,
            ])
        );
        this.metallic = createLayerTexture(
            gl,
            width,
            height,
            new Uint8ClampedArray([
                metallicByte,
                metallicByte,
                metallicByte,
                255,
            ])
        );
    }

    fill(
        gl: WebGLRenderingContext,
        width: number,
        height: number,
        fillColor: Uint8ClampedArray,
        fillRoughness: number,
        fillMetallic: number
    ) {
        fillTexture(gl, this.albedo, width, height, fillColor);

        const roughnessByte = fillRoughness * 255;
        const metallicByte = fillMetallic * 255;
        fillTexture(
            gl,
            this.roughness,
            width,
            height,
            new Uint8ClampedArray([
                roughnessByte,
                roughnessByte,
                roughnessByte,
                255,
            ])
        );
        fillTexture(
            gl,
            this.metallic,
            width,
            height,
            new Uint8ClampedArray([
                metallicByte,
                metallicByte,
                metallicByte,
                255,
            ])
        );
    }

    delete(gl: WebGLRenderingContext) {
        gl.deleteTexture(this.albedo);
        gl.deleteTexture(this.roughness);
        gl.deleteTexture(this.metallic);
    }
}

export default class Slate {
    windowManager: WindowManager;
    gl: WebGLRenderingContext;

    width: number;
    height: number;

    history: Layer[];
    historyIndex: number;

    private updated: boolean;

    private layer: Layer;

    albedo: WebGLTexture;
    roughness: WebGLTexture;
    metallic: WebGLTexture;

    currentOperation: WebGLTexture;

    private brushAlbedo: WebGLTexture;

    compositor: Compositor;

    private brushRoughnessTexture: WebGLTexture;
    private brushMetallicTexture: WebGLTexture;

    constructor(wm: WindowManager, width: number, height: number) {
        this.windowManager = wm;
        this.gl = wm.gl;

        this.width = width;
        this.height = height;

        this.updated = true;

        const c = DEFAULT_ALBEDO_BYTE;

        this.layer = new Layer(
            this.gl,
            this.width,
            this.height,
            new Uint8ClampedArray([c, c, c, 255]),
            DEFAULT_ROUGHNESS,
            DEFAULT_METALLIC
        );

        this.albedo = createLayerTexture(this.gl, this.width, this.height);
        this.roughness = createLayerTexture(this.gl, this.width, this.height);
        this.metallic = createLayerTexture(this.gl, this.width, this.height);

        this.currentOperation = createLayerTexture(
            this.gl,
            this.width,
            this.height,
            new Uint8ClampedArray([0, 0, 0, 255])
        );

        this.history = [
            new Layer(
                this.gl,
                this.width,
                this.height,
                new Uint8ClampedArray([c, c, c, 255]),
                DEFAULT_ROUGHNESS,
                DEFAULT_METALLIC
            ),
        ];
        this.historyIndex = 0;

        const gl = this.gl;

        this.brushAlbedo = gl.createTexture();
        this.brushRoughnessTexture = gl.createTexture();
        this.brushMetallicTexture = gl.createTexture();

        this.brushColor = vec3.create();
        this.brushRoughness = DEFAULT_ROUGHNESS;
        this.brushMetallic = DEFAULT_METALLIC;

        this.compositor = new Compositor(wm, width, height);
    }

    set brushColor(sRgb: vec3) {
        const [r, g, b] = sRgb.map(srgbToRgb);
        fillTexture(
            this.gl,
            this.brushAlbedo,
            1,
            1,
            new Uint8ClampedArray([r * 255, g * 255, b * 255, 255])
        );
    }

    set brushRoughness(roughness: number) {
        const roughnessByte = roughness * 255;
        fillTexture(this.gl, this.brushRoughnessTexture, 1, 1, new Uint8ClampedArray([roughnessByte, roughnessByte, roughnessByte, 255]));
    }

    set brushMetallic(metallic: number) {
        const metallicByte = metallic * 255;
        fillTexture(this.gl, this.brushMetallicTexture, 1, 1, new Uint8ClampedArray([metallicByte, metallicByte, metallicByte, 255]));
    }

    loadAlbedo(image: Image) {
        // TODO: add options to load metallic and roughness textures
        this.width = image.width;
        this.height = image.height;

        this.compositor.setDimensions(image.width, image.height);

        fillTexture(this.gl, this.layer.albedo, image.width, image.height);
        fillTexture(this.gl, this.albedo, image.width, image.height);
        fillTexture(
            this.gl,
            this.currentOperation,
            image.width,
            image.height,
            new Uint8ClampedArray([0, 0, 0, 255])
        );

        const tmp = this.gl.createTexture();
        loadTextureFromImage(this.gl, tmp, image);
        this.compositor.run(this.layer.albedo, O(tmp).mix(tmp));
        this.gl.deleteTexture(tmp);

        this.resetHistory();
        this.markUpdate();
    }

    markUpdate() {
        this.updated = true;
        this.windowManager.drawOnNextFrame();
    }

    resetHistory() {
        for (let i = 0; i < this.history.length; i++) {
            this.gl.deleteTexture(this.history[i]);
        }
        this.history = [this.layer];
        this.historyIndex = 0;
    }

    // TODO: undo history is glitchy; figure out why

    // Undo history
    apply() {
        this.compositor.run(
            this.albedo,
            O(this.layer.albedo).mix(
                O(this.brushAlbedo).mask(this.currentOperation)
            )
        );

        this.compositor.run(
            this.roughness,
            O(this.layer.roughness).mix(
                O(this.brushRoughnessTexture).mask(this.currentOperation)
            )
        );

        this.compositor.run(
            this.metallic,
            O(this.layer.metallic).mix(
                O(this.brushMetallicTexture).mask(this.currentOperation)
            )
        );

        fillTexture(
            this.gl,
            this.currentOperation,
            this.width,
            this.height,
            new Uint8ClampedArray([0, 0, 0, 255])
        );

        this.layer = new Layer(
            this.gl,
            this.width,
            this.height
        );

        this.compositor.run(this.layer.albedo, O(this.albedo).mix(this.albedo));
        this.compositor.run(this.layer.roughness, O(this.roughness).mix(this.roughness));
        this.compositor.run(this.layer.metallic, O(this.metallic).mix(this.metallic));

        // save image state in undo queue

        for (let i = this.historyIndex + 1; i < this.history.length; i++) {
            this.history[i].delete(this.gl);
        }
        this.history.length = this.historyIndex + 1;

        this.history.push(this.layer);
        this.historyIndex++;

        this.windowManager.drawOnNextFrame();
    }

    undo() {
        if (this.historyIndex > this.history.length) {
            this.historyIndex = this.history.length;
        }
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.layer = this.history[this.historyIndex];
            this.markUpdate();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.layer = this.history[this.historyIndex];
            this.markUpdate();
        }
    }

    updateTextures() {
        if (!this.updated) {
            return;
        }
        this.updated = false;

        this.compositor.run(
            this.albedo,
            O(this.layer.albedo).mix(
                O(this.brushAlbedo).mask(this.currentOperation)
            )
        );

        this.compositor.run(
            this.roughness,
            O(this.layer.roughness).mix(
                O(this.brushRoughnessTexture).mask(this.currentOperation)
            )
        );

        this.compositor.run(
            this.metallic,
            O(this.layer.metallic).mix(
                O(this.brushMetallicTexture).mask(this.currentOperation)
            )
        );

        // this.compositor.run(this.albedo, O(this.metallic).mix(this.metallic));
    }
}
