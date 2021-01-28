import { mat4 } from 'gl-matrix';
import ShaderSource, { Shader } from '../shaders';

import vertStandardShader from '../shaders/workspace/standard.shader/vert.glsl';
import fragStandardShader from '../shaders/workspace/standard.shader/frag.glsl';

import vertImageShader from '../shaders/image.shader/vert.glsl';
import fragImageShader from '../shaders/image.shader/frag.glsl';

import {
    getUnitRectNormalBuffer,
    getUnitRectPositionBuffer,
    getUnitRectUVBuffer,
    getUnitRectUVBufferInverted,
} from '../primitives';
import WindowManager from '../windowManager';
import { setUpStandard } from '../mesh';

export enum Channel {
    Material,
    Albedo,
    Roughness,
    Metallic,
}

export default class TextureDisplay {
    standardShader: Shader;
    imageShader: Shader;

    async initGL(gl: WebGLRenderingContext) {
        const standardSource = new ShaderSource(
            'standard',
            vertStandardShader,
            fragStandardShader
        );
        this.standardShader = standardSource.load(gl);

        const imageSource = new ShaderSource(
            'image',
            vertImageShader,
            fragImageShader
        );
        this.imageShader = imageSource.load(gl);

        return false;
    }

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        { view, drawUVMap, channel }
    ) {
        const gl = windowManager.gl;

        const modelMatrix = getModelMatrix(
            windowManager.slate.width,
            windowManager.slate.height
        );

        const modelViewMatrix = mat4.create();
        mat4.mul(modelViewMatrix, view, modelMatrix);

        const backgroundMatrix = mat4.create();
        mat4.identity(backgroundMatrix);

        if (channel === Channel.Material) {
            //// draw 2d image view ////
            setUpStandard(
                gl,
                modelViewMatrix,
                windowManager.uiProjectionMatrix,
                windowManager.lighting,
                backgroundMatrix,
                this.standardShader,
                getUnitRectPositionBuffer(gl),
                2,
                getUnitRectUVBufferInverted(gl),
                getUnitRectNormalBuffer(gl),
                windowManager.slate.albedo,
                windowManager.slate.roughness,
                windowManager.slate.metallic,
                gl.NEAREST,
                true
            );
        } else {
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
                gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectPositionBuffer(gl));
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
                gl.bindBuffer(gl.ARRAY_BUFFER, getUnitRectUVBuffer(gl));
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

            switch (channel) {
                case Channel.Albedo:
                    gl.bindTexture(gl.TEXTURE_2D, windowManager.slate.albedo);
                    break;
                case Channel.Roughness:
                    gl.bindTexture(
                        gl.TEXTURE_2D,
                        windowManager.slate.roughness
                    );
                    break;
                case Channel.Metallic:
                    gl.bindTexture(gl.TEXTURE_2D, windowManager.slate.metallic);
                    break;
            }

            gl.uniform1i(this.imageShader.uniforms.uSampler, 0);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // show the pixels
        }

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }

        const mesh = windowManager.mesh;
        if (drawUVMap && mesh) {
            mat4.scale(modelViewMatrix, modelViewMatrix, [1, -1, 1]);
            mat4.translate(modelViewMatrix, modelViewMatrix, [0, -1, 0]);
            mesh.drawUVLines(
                gl,
                modelViewMatrix,
                windowManager.uiProjectionMatrix
            );
        }
    }
}

export function getModelMatrix(slateWidth: number, slateHeight: number) {
    const modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    mat4.scale(modelMatrix, modelMatrix, [slateWidth, slateHeight, 1]);
    return modelMatrix;
}
