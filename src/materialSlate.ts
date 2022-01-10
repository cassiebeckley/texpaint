// At the moment this represents a single-layer, editable image
// We're going to want everything to work in a linear space internally

import Image from './loader/image';
import WindowManager, { loadTextureFromImage } from './windowManager';

import Compositor, { createLayerTexture, fillTexture, O } from './compositor';
import Brush from './brush';

const DEFAULT_ALBEDO = 0.8;
const DEFAULT_ALBEDO_BYTE = Math.round(DEFAULT_ALBEDO * 255);
const DEFAULT_ROUGHNESS = 0.5;
const DEFAULT_METALLIC = 0.0;

class Layer {
    albedo: WebGLTexture;
    roughness: WebGLTexture;
    metallic: WebGLTexture;

    constructor(
        gl: WebGL2RenderingContext,
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
        gl: WebGL2RenderingContext,
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

    delete(gl: WebGL2RenderingContext) {
        gl.deleteTexture(this.albedo);
        gl.deleteTexture(this.roughness);
        gl.deleteTexture(this.metallic);
    }
}

export default class MaterialSlate {
    gl: WebGL2RenderingContext;

    brush: Brush;

    id: string;
    size: number;

    history: Layer[];
    historyIndex: number;

    private updated: boolean;

    private layer: Layer;

    albedo: WebGLTexture;
    roughness: WebGLTexture;
    metallic: WebGLTexture;

    currentOperation: WebGLTexture;

    compositor: Compositor;

    constructor(
        gl: WebGL2RenderingContext,
        brush: Brush,
        size: number,
        id: string,
        compositor: Compositor
    ) {
        this.gl = gl;
        this.brush = brush;

        this.id = id;
        this.size = size;

        this.updated = true;

        const c = DEFAULT_ALBEDO_BYTE;

        this.layer = new Layer(
            this.gl,
            this.size,
            this.size,
            new Uint8ClampedArray([c, c, c, 255]),
            DEFAULT_ROUGHNESS,
            DEFAULT_METALLIC
        );

        this.albedo = createLayerTexture(this.gl, this.size, this.size);
        this.roughness = createLayerTexture(this.gl, this.size, this.size);
        this.metallic = createLayerTexture(this.gl, this.size, this.size);

        this.currentOperation = createLayerTexture(
            this.gl,
            this.size,
            this.size,
            new Uint8ClampedArray([0, 0, 0, 255])
        );

        this.history = [
            new Layer(
                this.gl,
                this.size,
                this.size,
                new Uint8ClampedArray([c, c, c, 255]),
                DEFAULT_ROUGHNESS,
                DEFAULT_METALLIC
            ),
        ];
        this.historyIndex = 0;

        this.compositor = compositor;
    }

    loadAlbedo(image: Image) {
        // TODO: add options to load metallic and roughness textures
        this.size = image.width;
        this.size = image.height;

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
        this.updated = true;

        this.updateTextures();

        fillTexture(
            this.gl,
            this.currentOperation,
            this.size,
            this.size,
            new Uint8ClampedArray([0, 0, 0, 255])
        );

        this.layer = new Layer(this.gl, this.size, this.size);

        this.compositor.run(this.layer.albedo, O(this.albedo).mix(this.albedo));
        this.compositor.run(
            this.layer.roughness,
            O(this.roughness).mix(this.roughness)
        );
        this.compositor.run(
            this.layer.metallic,
            O(this.metallic).mix(this.metallic)
        );

        // save image state in undo queue

        for (let i = this.historyIndex + 1; i < this.history.length; i++) {
            this.history[i].delete(this.gl);
        }
        this.history.length = this.historyIndex + 1;

        this.history.push(this.layer);
        this.historyIndex++;
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
                O(this.brush.albedoTexture).mask(this.currentOperation)
            )
        );

        this.compositor.run(
            this.roughness,
            O(this.layer.roughness).mix(
                O(this.brush.roughnessTexture).mask(this.currentOperation)
            )
        );

        this.compositor.run(
            this.metallic,
            O(this.layer.metallic).mix(
                O(this.brush.metallicTexture).mask(this.currentOperation)
            )
        );

        // this.compositor.run(this.albedo, O(this.currentOperation).mix(this.currentOperation));
    }
}
