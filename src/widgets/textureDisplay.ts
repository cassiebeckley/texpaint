import { mat4, vec3 } from 'gl-matrix';
import loadShaderProgram, { Shader } from '../shaders';

import vertImageShader from 'url:../shaders/imageShader/vert.glsl';
import fragImageShader from 'url:../shaders/imageShader/frag.glsl';

import { generateRectVerticesStrip, rectVerticesStripUV } from '../primitives';
import WindowManager from '../windowManager';

export default class TextureDisplay {
    imagePositionBuffer: WebGLBuffer;

    imageShader: Shader;
    imageUVBuffer: WebGLBuffer; // TODO: share this with all rectangles?

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

        return false;
    }

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        { scale, position, drawUVMap }
    ) {
        const gl = windowManager.gl;

        const modelViewMatrix = getModelViewMatrix(
            windowManager.slate.width,
            windowManager.slate.height,
            width,
            height,
            scale,
            position
        );

        //// draw 2d image view ////
        gl.useProgram(this.imageShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.imageShader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );
        gl.uniformMatrix4fv(
            this.imageShader.uniforms.uModelViewMatrix,
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
                this.imageShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.imageShader.attributes.aVertexPosition
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
                this.imageShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.imageShader.attributes.aTextureCoord
            );
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, windowManager.slate.albedo);
        gl.uniform1i(this.imageShader.uniforms.uSampler, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // show the pixels

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }

        const mesh = windowManager.mesh;
        if (drawUVMap && mesh) {
            mat4.scale(modelViewMatrix, modelViewMatrix, [1, -1, 1]);
            mat4.translate(modelViewMatrix, modelViewMatrix, [0, -1, 0]);
            mesh.drawUV(gl, modelViewMatrix, windowManager.uiProjectionMatrix);
        }
    }
}

export function getModelViewMatrix(
    slateWidth: number,
    slateHeight: number,
    width: number,
    height: number,
    scale: number,
    position: vec3
) {
    const modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    mat4.scale(modelMatrix, modelMatrix, [slateWidth, slateHeight, 1]);

    const currentWidth = slateWidth * scale;
    const currentHeight = slateHeight * scale;

    const viewMatrix = mat4.create();
    mat4.identity(viewMatrix);
    mat4.translate(viewMatrix, viewMatrix, [
        width / 2 - currentWidth / 2,
        height / 2 - currentHeight / 2,
        0,
    ]);
    mat4.scale(viewMatrix, viewMatrix, [scale, scale, 1]);
    mat4.translate(viewMatrix, viewMatrix, position);

    const modelViewMatrix = mat4.create();
    mat4.mul(modelViewMatrix, viewMatrix, modelMatrix);

    return modelViewMatrix;
}
