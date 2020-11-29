import WindowManager from './windowManager';

export default interface Widget {
    initGL(gl: WebGLRenderingContext): void;
    draw(
        windowManager: WindowManager, // TODO: maybe just pass gl and projection matrix instead of this?
        width: number,
        height: number,
        props: any
    ): void;
}
