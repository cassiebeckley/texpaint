import ShaderSource, { Shader } from '../shaders';

import vertImageShader from '../shaders/image.shader/vert.glsl';
import fragImageShader from '../shaders/image.shader/frag.glsl';

import { getUnitRectPositionBuffer, getUnitRectUVBuffer } from '../primitives';
import { mat4 } from 'gl-matrix';
import WindowManager, { loadTextureFromImage } from '../windowManager';

export default class ImageWidget {
    imageShader: Shader;

    imageTexture: WebGLTexture;

    async initGL(gl: WebGLRenderingContext) {
        const imageSource = new ShaderSource(
            'image',
            vertImageShader,
            fragImageShader
        );
        this.imageShader = imageSource.load(gl);

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
            gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectPositionBuffer(gl));
            gl.vertexAttribPointer(
                shader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(shader.attributes.aVertexPosition);
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectUVBuffer(gl));
            gl.vertexAttribPointer(
                shader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(shader.attributes.aTextureCoord);
        }

        this.imageTexture = loadTextureFromImage(gl, this.imageTexture, image); // TODO: don't reupload on every redraw

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }
}
