import { mat4 } from 'gl-matrix';

const uiProjectionMatrix = mat4.create();

class WindowManager {
    constructor() {
        this.canvas = document.getElementById('application');
        this.gl = null;
        this.uiProjectionMatrix = mat4.create();
    }

    initGL() {
        this.gl = this.canvas.getContext('webgl');

        if (!this.gl) {
            throw new Error('WebGL is not supported');
        }

        // TODO: enable CULL_FACE

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
export default function getWindowManager() {
    if (singleton === null) {
        singleton = new WindowManager();
    }

    return singleton;
}
