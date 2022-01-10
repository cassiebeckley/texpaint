import { mat4, vec2, vec3 } from 'gl-matrix';
import BrushEngine from './brushEngine';
import { DEFAULT_BRUSH_SPACING } from './constants';
import Lighting from './lighting';
import Image, { ImageFormat, ImageStorage } from './loader/image';
import type Widget from './widget';
import Scene from './scene';
import Compositor from './compositor';

const brushSize = 40.0; // TODO: brush size should be percentage of max dimension of texture/mesh; default should be a constant
const brushColor = vec3.create();
vec3.set(brushColor, 0, 0, 0);

export default class WindowManager {
    canvas: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    widgets: WeakMap<{ new (): Widget }, Widget>;
    uiProjectionMatrix: mat4;

    drawId: number;
    drawList: {
        widget: Widget;
        position: vec2;
        width: number;
        height: number;
        widgetProps: any;
        id: number;
        zIndex: number;
    }[];

    frameRequest: number;

    projectSize: number;

    scene: Scene;
    brushEngine: BrushEngine; // keeping this here until I find a better home for it
    viewport: number[];

    lighting: Lighting;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { alpha: true });
        this.uiProjectionMatrix = mat4.create();

        glAssertEnable(this.gl, 'OES_texture_float_linear');

        this.gl.enable(this.gl.CULL_FACE);

        // set alpha blend mode
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

        this.gl.enable(this.gl.SCISSOR_TEST);

        this.viewportToWindow();

        this.widgets = new WeakMap();

        const handleResize = () => {
            this.drawOnNextFrame();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'z' && e.ctrlKey) {
                // TODO: history (probably kept in Scene?) needs to record target material and texture
                for (let [_, slate] of this.scene.materials) {
                    slate.undo();
                }

                this.drawOnNextFrame();
            } else if ((e.key === 'y' || e.key === 'Z') && e.ctrlKey) {
                for (let [_, slate] of this.scene.materials) {
                    slate.redo();
                }

                this.drawOnNextFrame();
            }
        });

        this.drawId = 0;
        this.drawList = [];

        this.projectSize = 1024; // TODO: let user set when creating project

        this.scene = new Scene(
            this.gl,
            this.projectSize,
            new Compositor(this, this.projectSize, this.projectSize)
        );
        this.brushEngine = new BrushEngine(
            brushSize,
            DEFAULT_BRUSH_SPACING,
            this
        );

        this.lighting = new Lighting(this.gl);
        this.lighting.load().then(() => this.drawOnNextFrame()).catch(e=>console.log("error?", e));
    }

    setViewport(x: number, y: number, width: number, height: number) {
        this.canvas.height = this.canvas.clientHeight;
        x += 1;
        y = this.canvas.height - y - height;

        mat4.ortho(this.uiProjectionMatrix, 0, width, height, 0, -20, 20);

        this.viewport = [x, y, width, height];

        this.restoreViewport();
    }

    restoreViewport() {
        this.gl.viewport(
            this.viewport[0],
            this.viewport[1],
            this.viewport[2],
            this.viewport[3]
        );
        this.gl.scissor(
            this.viewport[0],
            this.viewport[1],
            this.viewport[2],
            this.viewport[3]
        );
    }

    viewportToWindow() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.setViewport(
            0,
            this.canvas.height,
            this.canvas.width,
            this.canvas.height
        );
    }

    draw() {
        this.brushEngine.updateTextures();
        for (let [_, slate] of this.scene.materials) {
            slate.updateTextures();
        }

        this.viewportToWindow();

        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clearDepth(1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        for (let i = 0; i < this.drawList.length; i++) {
            const { widget, position, width, height, widgetProps } =
                this.drawList[i];
            this.setViewport(position[0], position[1], width, height);
            widget.draw(this, width, height, widgetProps);
        }
    }

    drawOnNextFrame() {
        if (!this.frameRequest) {
            this.frameRequest = requestAnimationFrame(() => {
                this.frameRequest = null;
                this.draw();
            });
        }
    }

    addToDrawList(
        WidgetConstructor: { new (): Widget },
        position: vec2,
        width: number,
        height: number,
        widgetProps: any,
        zIndex: number
    ) {
        const id = this.drawId++;

        if (!this.widgets.has(WidgetConstructor)) {
            const widget = new WidgetConstructor();

            widget.initGL(this.gl).then((redraw) => {
                if (redraw) {
                    this.drawOnNextFrame();
                }
            });

            this.widgets.set(WidgetConstructor, widget);
        }

        this.drawList.push({
            widget: this.widgets.get(WidgetConstructor),
            position,
            width,
            height,
            widgetProps,
            id,
            zIndex,
        });

        this.drawList.sort((a, b) => a.zIndex - b.zIndex);

        this.drawOnNextFrame();

        return id;
    }

    removeFromDrawList(cancelId: number) {
        // TODO: this is actually called on every widget state update so linear search might not be the fastest if there's a larger number of widgets
        this.drawList = this.drawList.filter(({ id }) => id !== cancelId);
        this.drawOnNextFrame();
    }
}

const glAssertEnable = (gl: WebGL2RenderingContext, extName: string) => {
    const ext = gl.getExtension(extName);
    if (!ext) {
        throw new Error(
            `browser or GPU does not support required extension ${extName}`
        );
    }
    return ext;
};

// TODO: been a while since I wrote this but isn't it weird this is here? probably put it somewhere else
export function loadTextureFromImage(
    gl: WebGL2RenderingContext,
    texture: WebGLTexture,
    image: Image
): WebGLTexture {
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;

    const float = image.storage.type === ImageStorage.Float32;

    let internalFormat: number;
    let srcFormat: number;
    if (image.format === ImageFormat.RGB) {
        internalFormat = float ? gl.RGB32F : gl.RGB;
        srcFormat = gl.RGB;
    } else if (image.format === ImageFormat.RGBA) {
        internalFormat = float ? gl.RGBA32F : gl.RGBA;
        srcFormat = gl.RGBA;
    }

    let srcType = float ? gl.FLOAT : gl.UNSIGNED_BYTE;

    const border = 0;
    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        image.width,
        image.height,
        border,
        srcFormat,
        srcType,
        image.storage.pixels
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // TODO: do I want to allow mipmaps here?
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
}
