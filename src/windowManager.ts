import { mat4, vec3 } from 'gl-matrix';
import BrushEngine from './brushEngine';
import Image, { ImageFormat, ImageStorage } from './loader/image';
import MeshData from './loader/meshData';
import Mesh from './mesh';
import Slate from './slate';
import type Widget from './widget';

const brushSize = 40.0;
const brushColor = vec3.create();
vec3.set(brushColor, 0, 0, 0);

export default class WindowManager {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    widgets: { [name: string]: Widget };
    uiProjectionMatrix: mat4;

    drawId: number;
    drawList: {
        widget: Widget;
        position: vec3;
        width: number;
        height: number;
        widgetProps: any;
        id: number;
    }[];

    frameRequest: number;

    slate: Slate; // keeping this here until I find a better home for it
    mesh: Mesh; // and this
    brushEngine: BrushEngine; // and this as well

    constructor(canvas: HTMLCanvasElement, widgets: { new (): Widget }[]) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', { alpha: true });
        this.uiProjectionMatrix = mat4.create();

        glAssertEnable(this.gl, 'OES_texture_float');

        this.gl.enable(this.gl.CULL_FACE);

        // set alpha blend mode
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

        this.gl.enable(this.gl.SCISSOR_TEST);

        this.viewportToWindow();

        this.widgets = {};

        for (let i = 0; i < widgets.length; i++) {
            const WidgetConstructor = widgets[i];
            const widget = new WidgetConstructor();

            widget.initGL(this.gl).then(redraw => {
                if (redraw) {
                    this.drawOnNextFrame();
                }
            });

            this.widgets[WidgetConstructor.name] = widget;
        }

        const handleResize = () => {
            this.drawOnNextFrame();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'z' && e.ctrlKey) {
                this.slate.undo();

                this.drawOnNextFrame();
            } else if ((e.key === 'y' || e.key === 'Z') && e.ctrlKey) {
                this.slate.redo();

                this.drawOnNextFrame();
            }
        });

        this.drawId = 0;
        this.drawList = [];

        this.slate = new Slate(this.gl, 1024, 576);
        this.mesh = null;
        this.brushEngine = new BrushEngine(brushSize, brushColor, 0.4, this);
    }

    setViewport(x: number, y: number, width: number, height: number) {
        this.canvas.height = this.canvas.clientHeight;
        x += 1;
        y = this.canvas.height - y - height;

        mat4.ortho(this.uiProjectionMatrix, 0, width, height, 0, -20, 20);

        this.gl.viewport(x, y, width, height);
        this.gl.scissor(x, y, width, height);
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
        this.viewportToWindow();

        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clearDepth(1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.slate.uploadTexture(this.gl);

        for (let i = 0; i < this.drawList.length; i++) {
            const {
                widget,
                position,
                width,
                height,
                widgetProps,
            } = this.drawList[i];
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
        widget: string,
        position: vec3,
        width: number,
        height: number,
        widgetProps: any,
        zIndex: number
    ) {
        position[2] = zIndex;

        const id = this.drawId++;
        this.drawList.push({
            widget: this.widgets[widget],
            position,
            width,
            height,
            widgetProps,
            id,
        });

        this.drawList.sort((a, b) => a.position[2] - b.position[2]); // TODO: replace this with depth test

        this.drawOnNextFrame();

        return id;
    }

    removeFromDrawList(cancelId: number) {
        this.drawList = this.drawList.filter(({ id }) => id !== cancelId);
        this.drawOnNextFrame();
    }

    setMesh(meshData: MeshData) {
        this.mesh = new Mesh(this.gl, this.slate, meshData);
    }
}

const glAssertEnable = (gl: WebGLRenderingContext, extName: string) => {
    const ext = gl.getExtension(extName);
    if (!ext) {
        throw new Error(
            `browser or GPU does not support required extension ${extName}`
        );
    }
    return ext;
};

export function loadTextureFromImage(gl: WebGLRenderingContext, texture: WebGLTexture, image: Image): WebGLTexture {
    let format = gl.RGB;
    if (image.format === ImageFormat.RGBA) {
        format = gl.RGBA;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    const level = 0;
    const internalFormat = format;
    const srcFormat = format;

    let srcType = gl.UNSIGNED_BYTE;
    if (image.storage.type === ImageStorage.Float32) {
        srcType = gl.FLOAT;
    }

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

    if (image.storage.type === ImageStorage.Uint8) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else if (image.storage.type === ImageStorage.Float32) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    return texture;
}