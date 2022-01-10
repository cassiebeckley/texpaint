import ShaderSource, { Shader } from '../shaders';

// TODO: don't hard code these in widgets
// TODO: currently duplicated with meshDisplay
import skybox0 from 'url:../assets/backgrounds/forest_slope/skybox0.png';
import skybox1 from 'url:../assets/backgrounds/forest_slope/skybox1.png';
import skybox2 from 'url:../assets/backgrounds/forest_slope/skybox2.png';
import skybox3 from 'url:../assets/backgrounds/forest_slope/skybox3.png';
import skybox4 from 'url:../assets/backgrounds/forest_slope/skybox4.png';
import skybox5 from 'url:../assets/backgrounds/forest_slope/skybox5.png';

import vertBallShader from '../shaders/environmentBall.shader/vert.glsl';
import fragBallShader from '../shaders/environmentBall.shader/frag.glsl';

import { getUnitRectPositionBuffer, getUnitRectUVBuffer } from '../primitives';
import { mat4 } from 'gl-matrix';
import WindowManager from '../windowManager';
import { loadAssetFromURL } from '../loader';
import { AssetType } from '../loader/asset';
import { ImageStorage } from '../loader/image';

export default class EnvironmentBall {
    ballShader: Shader;
    skyboxTexture: WebGLTexture;
    skyboxLoaded: boolean;

    async initGL(gl: WebGL2RenderingContext) {
        const imageSource = new ShaderSource(
            'environmentBall',
            vertBallShader,
            fragBallShader
        );
        this.ballShader = imageSource.load(gl);

        this.skyboxTexture = gl.createTexture();

        let skyboxFaces = await Promise.all(
            [skybox0, skybox1, skybox2, skybox3, skybox4, skybox5].map((url) =>
                loadAssetFromURL(url)
            )
        );

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxTexture);

        let sides = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        ];

        for (let i = 0; i < skyboxFaces.length; i++) {
            let face = skyboxFaces[i];
            if (face.type !== AssetType.Image) {
                throw new Error('need image');
            }

            let image = face.image;

            if (image.storage.type != ImageStorage.Uint8) {
                throw new Error('skybox should be SDR');
            }

            let pixels = image.storage.pixels;

            const level = 0;
            const internalFormat = gl.RGBA;
            const format = gl.RGBA;
            const type = gl.UNSIGNED_BYTE;
            gl.texImage2D(
                sides[i],
                level,
                internalFormat,
                image.width,
                image.height,
                0,
                format,
                type,
                pixels
            );
        }

        // TODO: check if this texture is a duplicate

        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

        this.skyboxLoaded = true;

        return true;
    }

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        { rotation, backgroundOffset }
    ) {
        if (!this.skyboxLoaded) {
            // TODO: maybe have a default skybox image instead?
            return;
        }
        const gl = windowManager.gl;

        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);
        mat4.scale(modelViewMatrix, modelViewMatrix, [width, height, 0]);

        let shader = this.ballShader;

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

        const invRotation = mat4.clone(rotation);
        mat4.rotateY(invRotation, invRotation, backgroundOffset);
        mat4.invert(invRotation, invRotation);
        mat4.rotateY(invRotation, invRotation, Math.PI);

        gl.uniformMatrix4fv(
            shader.uniforms.uRotationMatrix,
            false,
            invRotation
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

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxTexture);
        gl.uniform1i(this.ballShader.uniforms.uSkybox, 0);

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }
}
