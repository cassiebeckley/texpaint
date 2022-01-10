import ShaderSource, { Shader } from '../shaders';

import vertColorSelectShader from '../shaders/colorSelect.shader/vert.glsl';
import fragColorSelectShader from '../shaders/colorSelect.shader/frag.glsl';

import { getUnitRectPositionBuffer, getUnitRectUVBuffer } from '../primitives';
import { mat4 } from 'gl-matrix';
import WindowManager from '../windowManager';

export default class ColorSelect {
    colorSelectShader: Shader;

    async initGL(gl: WebGL2RenderingContext) {
        const colorSource = new ShaderSource(
            'colorSelect',
            vertColorSelectShader,
            fragColorSelectShader
        );
        this.colorSelectShader = colorSource.load(gl);

        return false;
    }

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        { hsvColor, radius, wheelWidth }
    ) {
        const gl = windowManager.gl;

        gl.clearColor(0.5, 0.5, 0.5, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);
        mat4.scale(modelViewMatrix, modelViewMatrix, [width, height, 0]);

        gl.useProgram(this.colorSelectShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.colorSelectShader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );

        gl.uniformMatrix4fv(
            this.colorSelectShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        gl.uniform3fv(this.colorSelectShader.uniforms.uHSV, hsvColor);
        gl.uniform1f(this.colorSelectShader.uniforms.uRadius, radius / width);
        gl.uniform1f(
            this.colorSelectShader.uniforms.uWheelWidth,
            wheelWidth / width
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectPositionBuffer(gl));
            gl.vertexAttribPointer(
                this.colorSelectShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.colorSelectShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectUVBuffer(gl));
            gl.vertexAttribPointer(
                this.colorSelectShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.colorSelectShader.attributes.aTextureCoord
            );
        }

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }
}
