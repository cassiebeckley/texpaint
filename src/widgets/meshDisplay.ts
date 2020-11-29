import { mat4, quat, vec3 } from 'gl-matrix';
import WindowManager from '../windowManager';

export default class MeshDisplay {
    constructor() {}

    initGL(gl: WebGLRenderingContext) {}

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        { mesh, position, rotation, scale }
    ) {
        const gl = windowManager.gl;
        gl.enable(gl.DEPTH_TEST);

        gl.clearColor(0.2, 0.1, 0.3, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (mesh) {
            const view = mat4.create();
            mat4.identity(view);

            const translation = vec3.create();
            vec3.set(translation, 0, 0, -6);
            vec3.scale(translation, translation, scale);

            mat4.translate(view, view, translation);

            mat4.translate(view, view, position);

            const rotationMatrix = mat4.create();
            mat4.fromQuat(rotationMatrix, rotation);

            mat4.mul(view, view, rotationMatrix);

            const projection = mat4.create();
            mat4.identity(projection);
            mat4.perspective(
                projection,
                (27 * Math.PI) / 180,
                width / height,
                0.1,
                100.0
            );

            mesh.draw(gl, view, projection);
        }

        gl.disable(gl.DEPTH_TEST);
    }

    // resetImageTransform() {
    //     mat4.identity(this.viewMatrix);
    //     mat4.translate(this.viewMatrix, this.viewMatrix, [0.0, 0.0, -6.0]);
    // }

    uiToMeshCoordinates(uiCoord: vec3) {
        // TODO: figure out wtf I'm trying to do
        const wm = getWindowManager();
        const canvas = wm.canvas;
        const clipCoords = vec3.create(); // TODO: optimization: minimize allocations
        vec3.set(
            clipCoords,
            uiCoord[0] / canvas.clientWidth,
            uiCoord[0] / canvas.clientHeight,
            0.0
        );

        const invProjectionMatrix = mat4.create();
        mat4.invert(invProjectionMatrix, wm.projectionMatrix);

        vec3.transformMat4(clipCoords, clipCoords, invProjectionMatrix);
        return clipCoords;
    }
}
