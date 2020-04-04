import getWindowManager from './windowManager';
import loadShaderProgram, { Shader } from './shaders';

import vertColorSelectShader from './shaders/colorSelectShader/vert.glsl';
import fragColorSelectShader from './shaders/colorSelectShader/frag.glsl';

import { generateRectVerticesStrip, rectVerticesStripUV } from './primitives';
import { mat4 } from 'gl-matrix';

const width = 300;
// const height = 350;
const height = 300;

export default class ColorSelect {
    colorSelectShader: Shader;

    vertexBuffer: WebGLBuffer;
    uvBuffer: WebGLBuffer;

    constructor() {
        const gl = getWindowManager().gl;
        this.colorSelectShader = loadShaderProgram(
            gl,
            vertColorSelectShader,
            fragColorSelectShader
        );

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
                generateRectVerticesStrip(100, 100, width, height)
            ),
            gl.STATIC_DRAW
        );

        this.uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(rectVerticesStripUV),
            gl.STATIC_DRAW
        );
    }

    draw() {
        const windowManager = getWindowManager();
        const gl = windowManager.gl;

        gl.useProgram(this.colorSelectShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.colorSelectShader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );

        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);
        gl.uniformMatrix4fv(
            this.colorSelectShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        // gl.uniform3fv(this.colorSelectShader.uniforms.uHSV, [352, 0.409, 0.91]);
        gl.uniform3fv(this.colorSelectShader.uniforms.uHSV, [0.0, 0.409, 0.91]);

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
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
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
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
