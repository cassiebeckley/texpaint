import { mat4 } from 'gl-matrix';

const uiProjectionMatrix = mat4.create();

class WindowManager {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    uiProjectionMatrix: mat4;

    constructor() {
        this.canvas = <HTMLCanvasElement>document.getElementById('application');
        this.gl = null;
        this.uiProjectionMatrix = mat4.create();
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

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
}

let singleton = null;
export default function getWindowManager(): WindowManager {
    if (singleton === null) {
        singleton = new WindowManager();
    }

    return singleton;
}
