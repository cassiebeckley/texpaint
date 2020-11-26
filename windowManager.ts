import { mat4, vec3 } from 'gl-matrix';
import type { Widget } from './widget';
import { dirty } from './events';

const uiProjectionMatrix = mat4.create();

class WindowManager {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    uiProjectionMatrix: mat4;
    projectionMatrix: mat4;

    widgets: Widget[];

    animationFrameRequest: number;

    constructor() {
        this.canvas = <HTMLCanvasElement>document.getElementById('application');
        this.gl = null;
        this.uiProjectionMatrix = mat4.create();
        this.projectionMatrix = mat4.create();

        this.widgets = [];
    }

    initGL() {
        this.gl = this.canvas.getContext('webgl', { alpha: false });

        if (!this.gl) {
            throw new Error('WebGL is not supported');
        }

        // TODO: enable CULL_FACE

        // set alpha blend mode
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

        return this.gl;
    }

    viewportToWindow() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        mat4.ortho(
            this.uiProjectionMatrix,
            0,
            this.canvas.width,
            this.canvas.height,
            0,
            -1,
            1
        );

        mat4.perspective(
            this.projectionMatrix,
            (27 * Math.PI) / 180,
            this.canvas.width / this.canvas.height,
            0.1,
            100.0
        );

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setColor(color: vec3) {
        const htmlColor = vec3.create();
        vec3.scale(htmlColor, color, 255);
        vec3.round(htmlColor, htmlColor);
        const elements: HTMLCollection = document.getElementsByClassName(
            'brush-color'
        );
        for (let i = 0; i < elements.length; i++) {
            const element: HTMLElement = <HTMLElement>elements[i];
            element.style.backgroundColor = `rgb(${htmlColor})`;
        }
    }

    draw() {
        if (!dirty()) {
            // don't redraw if nothing's changed
            return;
        }
        this.gl.clearColor(0.23, 0.23, 0.23, 1.0);
        this.gl.clearDepth(1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        for (let i = 0; i < this.widgets.length; i++) {
            this.widgets[i].draw();
        }
    }

    drawOnNextTick() {
        if (!this.animationFrameRequest) {
            this.animationFrameRequest = window.requestAnimationFrame(() => {
                this.animationFrameRequest = null;
                this.draw();
            });
        }
    }
}

let singleton = null;
export default function getWindowManager(): WindowManager {
    if (singleton === null) {
        singleton = new WindowManager();
    }

    return singleton;
}
