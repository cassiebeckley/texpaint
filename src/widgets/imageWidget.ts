import loadShaderProgram, { Shader } from '../shaders';

import vertImageShader from '../shaders/imageShader/vert.glsl';
import fragImageShader from '../shaders/imageShader/frag.glsl';

import { generateRectVerticesStrip, rectVerticesStripUV } from '../primitives';
import { mat4 } from 'gl-matrix';
import WindowManager, { loadTextureFromImage } from '../windowManager';

export default class ImageWidget {
    imagePositionBuffer: WebGLBuffer;

    imageShader: Shader;
    imageUVBuffer: WebGLBuffer;

    imageTexture: WebGLTexture;

    async initGL(gl: WebGLRenderingContext) {
        this.imagePositionBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.imagePositionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(generateRectVerticesStrip(0, 0, 1, 1)),
            gl.STATIC_DRAW
        );

        this.imageShader = loadShaderProgram(
            gl,
            vertImageShader,
            fragImageShader
        );

        this.imageUVBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.imageUVBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(rectVerticesStripUV),
            gl.STATIC_DRAW
        );

        this.imageTexture = gl.createTexture();

        return false;
    }

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        { image }
    ) {
        const gl = windowManager.gl;

        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);
        mat4.scale(modelViewMatrix, modelViewMatrix, [width, height, 0]);

        let shader = this.imageShader;

        gl.useProgram(shader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            shader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );

        gl.uniformMatrix4fv(
            shader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.imagePositionBuffer);
            gl.vertexAttribPointer(
                shader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                shader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.imageUVBuffer);
            gl.vertexAttribPointer(
                shader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                shader.attributes.aTextureCoord
            );
        }

        this.imageTexture = loadTextureFromImage(gl, this.imageTexture, image); // TODO: don't reupload on every redraw

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }
}
