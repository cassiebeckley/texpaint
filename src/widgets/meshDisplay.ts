import { mat4, quat, vec3 } from 'gl-matrix';
import {
    CUBE_INDICES,
    CUBE_LINE_INDICES,
    CUBE_VERTICES,
    generateCircleVertices,
} from '../primitives';
import WindowManager, { loadTextureFromImage } from '../windowManager';

import ShaderSource, { Shader } from '../shaders';

import brdf_lut_url from 'url:../assets/brdf_smith_schlick_ggx.exr';

import irradiance0 from 'url:../assets/backgrounds/forest_slope/irradiance0.exr';
import irradiance1 from 'url:../assets/backgrounds/forest_slope/irradiance1.exr';
import irradiance2 from 'url:../assets/backgrounds/forest_slope/irradiance2.exr';
import irradiance3 from 'url:../assets/backgrounds/forest_slope/irradiance3.exr';
import irradiance4 from 'url:../assets/backgrounds/forest_slope/irradiance4.exr';
import irradiance5 from 'url:../assets/backgrounds/forest_slope/irradiance5.exr';

import prefiltered_roughness0_0__0 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_0-0.exr';
import prefiltered_roughness0_0__1 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_0-1.exr';
import prefiltered_roughness0_0__2 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_0-2.exr';
import prefiltered_roughness0_0__3 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_0-3.exr';
import prefiltered_roughness0_0__4 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_0-4.exr';
import prefiltered_roughness0_0__5 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_0-5.exr';

import prefiltered_roughness0_2__0 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_2-0.exr';
import prefiltered_roughness0_2__1 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_2-1.exr';
import prefiltered_roughness0_2__2 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_2-2.exr';
import prefiltered_roughness0_2__3 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_2-3.exr';
import prefiltered_roughness0_2__4 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_2-4.exr';
import prefiltered_roughness0_2__5 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_2-5.exr';

import prefiltered_roughness0_5__0 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_5-0.exr';
import prefiltered_roughness0_5__1 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_5-1.exr';
import prefiltered_roughness0_5__2 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_5-2.exr';
import prefiltered_roughness0_5__3 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_5-3.exr';
import prefiltered_roughness0_5__4 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_5-4.exr';
import prefiltered_roughness0_5__5 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_5-5.exr';

import prefiltered_roughness0_7__0 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_7-0.exr';
import prefiltered_roughness0_7__1 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_7-1.exr';
import prefiltered_roughness0_7__2 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_7-2.exr';
import prefiltered_roughness0_7__3 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_7-3.exr';
import prefiltered_roughness0_7__4 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_7-4.exr';
import prefiltered_roughness0_7__5 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness0_7-5.exr';

import prefiltered_roughness1_0__0 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness1_0-0.exr';
import prefiltered_roughness1_0__1 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness1_0-1.exr';
import prefiltered_roughness1_0__2 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness1_0-2.exr';
import prefiltered_roughness1_0__3 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness1_0-3.exr';
import prefiltered_roughness1_0__4 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness1_0-4.exr';
import prefiltered_roughness1_0__5 from 'url:../assets/backgrounds/forest_slope/prefiltered_roughness1_0-5.exr';

import skybox0 from 'url:../assets/backgrounds/forest_slope/skybox0.png';
import skybox1 from 'url:../assets/backgrounds/forest_slope/skybox1.png';
import skybox2 from 'url:../assets/backgrounds/forest_slope/skybox2.png';
import skybox3 from 'url:../assets/backgrounds/forest_slope/skybox3.png';
import skybox4 from 'url:../assets/backgrounds/forest_slope/skybox4.png';
import skybox5 from 'url:../assets/backgrounds/forest_slope/skybox5.png';

import vertUVShader from '../shaders/uv.shader/vert.glsl';
import fragUVShader from '../shaders/uv.shader/frag.glsl';

import vertBackgroundShader from '../shaders/workspace/background.shader/vert.glsl';
import fragBackgroundShader from '../shaders/workspace/background.shader/frag.glsl';

import { FAR, FIELD_OF_VIEW, NEAR } from '../constants';
import Mesh from '../mesh';
import { loadAssetFromURL } from '../loader';
import { AssetType } from '../loader/asset';
import { ImageStorage } from '../loader/image';

const UP = vec3.create();
vec3.set(UP, 0, 1, 0);

export default class MeshDisplay {
    cubeBuffer: WebGLBuffer;
    cubeIndexBuffer: WebGLBuffer;

    circleBuffer: WebGLBuffer;
    circleCount: number;

    lineShader: Shader;

    backgroundLoaded: boolean;
    skyboxTexture: WebGLTexture;
    brdfTexture: WebGLTexture;
    irradianceTexture: WebGLTexture;
    prefilteredTextures: WebGLTexture[];
    backgroundShader: Shader;

    async initGL(gl: WebGLRenderingContext) {
        this.skyboxTexture = gl.createTexture();
        this.brdfTexture = gl.createTexture();
        this.irradianceTexture = gl.createTexture();
        this.prefilteredTextures = [1, 2, 3, 4, 5].map((_) =>
            gl.createTexture()
        );

        this.backgroundLoaded = false;

        this.cubeBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(CUBE_VERTICES),
            gl.STATIC_DRAW
        );

        this.cubeIndexBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(CUBE_INDICES),
            gl.STATIC_DRAW
        );

        this.circleCount = 16;
        this.circleBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(generateCircleVertices(this.circleCount)),
            gl.STATIC_DRAW
        );

        const backgroundSource = new ShaderSource(
            'background',
            vertBackgroundShader,
            fragBackgroundShader
        );
        this.backgroundShader = backgroundSource.load(gl);
        const lineSource = new ShaderSource('uv', vertUVShader, fragUVShader);
        this.lineShader = lineSource.load(gl);

        let brdf_lut = await loadAssetFromURL(brdf_lut_url);

        let skyboxFaces = await Promise.all(
            [skybox0, skybox1, skybox2, skybox3, skybox4, skybox5].map((url) =>
                loadAssetFromURL(url)
            )
        );
        let irradianceFaces = await Promise.all(
            [
                irradiance0,
                irradiance1,
                irradiance2,
                irradiance3,
                irradiance4,
                irradiance5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_0Faces = await Promise.all(
            [
                prefiltered_roughness0_0__0,
                prefiltered_roughness0_0__1,
                prefiltered_roughness0_0__2,
                prefiltered_roughness0_0__3,
                prefiltered_roughness0_0__4,
                prefiltered_roughness0_0__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_2Faces = await Promise.all(
            [
                prefiltered_roughness0_2__0,
                prefiltered_roughness0_2__1,
                prefiltered_roughness0_2__2,
                prefiltered_roughness0_2__3,
                prefiltered_roughness0_2__4,
                prefiltered_roughness0_2__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_5Faces = await Promise.all(
            [
                prefiltered_roughness0_5__0,
                prefiltered_roughness0_5__1,
                prefiltered_roughness0_5__2,
                prefiltered_roughness0_5__3,
                prefiltered_roughness0_5__4,
                prefiltered_roughness0_5__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_7Faces = await Promise.all(
            [
                prefiltered_roughness0_7__0,
                prefiltered_roughness0_7__1,
                prefiltered_roughness0_7__2,
                prefiltered_roughness0_7__3,
                prefiltered_roughness0_7__4,
                prefiltered_roughness0_7__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness1_0Faces = await Promise.all(
            [
                prefiltered_roughness1_0__0,
                prefiltered_roughness1_0__1,
                prefiltered_roughness1_0__2,
                prefiltered_roughness1_0__3,
                prefiltered_roughness1_0__4,
                prefiltered_roughness1_0__5,
            ].map((url) => loadAssetFromURL(url))
        );
        console.log('loaded background');

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

        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.irradianceTexture);

        for (let i = 0; i < irradianceFaces.length; i++) {
            let face = irradianceFaces[i];
            if (face.type !== AssetType.Image) {
                throw new Error('need image');
            }

            let image = face.image;

            if (image.storage.type != ImageStorage.Float32) {
                throw new Error('irradiance should be HDR');
            }

            let pixels = image.storage.pixels;

            const level = 0;
            const internalFormat = gl.RGBA;
            const format = gl.RGBA;
            const type = gl.FLOAT;
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

        gl.texParameteri(
            gl.TEXTURE_CUBE_MAP,
            gl.TEXTURE_MIN_FILTER,
            gl.NEAREST
        );
        gl.texParameteri(
            gl.TEXTURE_CUBE_MAP,
            gl.TEXTURE_MAG_FILTER,
            gl.NEAREST
        );

        if (brdf_lut.type != AssetType.Image) {
            throw new Error('BRDF must be an image');
        }
        loadTextureFromImage(gl, this.brdfTexture, brdf_lut.image);

        let prefilteredLevels = [
            prefiltered_roughness0_0Faces,
            prefiltered_roughness0_2Faces,
            prefiltered_roughness0_5Faces,
            prefiltered_roughness0_7Faces,
            prefiltered_roughness1_0Faces,
        ];

        for (let level = 0; level < prefilteredLevels.length; level++) {
            gl.bindTexture(
                gl.TEXTURE_CUBE_MAP,
                this.prefilteredTextures[level]
            );

            let prefilteredFaces = prefilteredLevels[level];
            for (let i = 0; i < prefilteredFaces.length; i++) {
                let face = prefilteredFaces[i];
                if (face.type != AssetType.Image) {
                    throw new Error('need image');
                }

                let image = face.image;

                if (image.storage.type != ImageStorage.Float32) {
                    throw new Error('prefiltered environment should be HDR');
                }

                let pixels = image.storage.pixels;

                const mipLevel = 0;
                const internalFormat = gl.RGBA;
                const format = gl.RGBA;
                const type = gl.FLOAT;
                gl.texImage2D(
                    sides[i],
                    mipLevel,
                    internalFormat,
                    image.width,
                    image.height,
                    0,
                    format,
                    type,
                    pixels
                );
            }

            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_MIN_FILTER,
                gl.NEAREST
            );
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_MAG_FILTER,
                gl.NEAREST
            );
        }

        this.backgroundLoaded = true;

        return true;
    }

    drawMainPass(
        gl: WebGLRenderingContext,
        width: number,
        height: number,
        mesh: Mesh,
        {
            position,
            rotation,
            scale,
            brushCursor,
            brushNormal,
            brushRadius,
            backgroundOffset,
        }
    ) {
        gl.enable(gl.DEPTH_TEST);

        const view = mat4.create();
        getView(view, position, rotation, scale);

        const projection = mat4.create();
        getProjection(projection, width, height);

        if (this.backgroundLoaded) {
            // this.drawBackground(gl, rotation, projection, backgroundOffset);
        }

        if (mesh) {
            const backgroundMatrix = mat4.create();
            mat4.identity(backgroundMatrix);
            mat4.rotateY(backgroundMatrix, backgroundMatrix, -backgroundOffset);

            mesh.draw(
                gl,
                view,
                projection,
                this.irradianceTexture,
                this.prefilteredTextures,
                this.brdfTexture,
                backgroundMatrix
            );
        }

        if (brushCursor) {
            this.drawCircle(
                gl,
                view,
                projection,
                brushCursor,
                brushNormal,
                brushRadius / 50
            );
            this.drawCircle(
                gl,
                view,
                projection,
                brushCursor,
                brushNormal,
                0.02
            );
        }

        gl.disable(gl.DEPTH_TEST);
    }

    draw(
        windowManager: WindowManager,
        width: number,
        height: number,
        widgetProps: any
    ) {
        const gl = windowManager.gl;

        this.drawMainPass(gl, width, height, windowManager.mesh, widgetProps);
    }

    drawBackground(
        gl: WebGLRenderingContext,
        rotation: quat,
        projectionMatrix: mat4,
        backgroundOffset: number
    ) {
        gl.disable(gl.CULL_FACE);
        gl.useProgram(this.backgroundShader.program);

        const modelMatrix = mat4.create();
        mat4.identity(modelMatrix);
        const backgroundScale = 50;
        mat4.scale(modelMatrix, modelMatrix, [
            backgroundScale,
            backgroundScale,
            backgroundScale,
        ]);

        const viewMatrix = mat4.create();
        mat4.fromQuat(viewMatrix, rotation);

        mat4.rotateY(viewMatrix, viewMatrix, backgroundOffset);

        const modelViewMatrix = mat4.create();
        mat4.mul(modelViewMatrix, viewMatrix, modelMatrix);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.backgroundShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.backgroundShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 3;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
            gl.vertexAttribPointer(
                this.backgroundShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.backgroundShader.attributes.aVertexPosition
            );
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxTexture);
        gl.uniform1i(this.backgroundShader.uniforms.uSkybox, 0);

        gl.drawElements(
            gl.TRIANGLES,
            CUBE_INDICES.length,
            gl.UNSIGNED_SHORT,
            0
        );

        gl.enable(gl.CULL_FACE);
    }

    drawCircle(
        gl: WebGLRenderingContext,
        viewMatrix: mat4,
        projectionMatrix: mat4,
        position: vec3,
        normal: vec3,
        brushRadius: number
    ) {
        gl.disable(gl.CULL_FACE);
        gl.useProgram(this.lineShader.program);

        const rotation = quat.create();
        quat.rotationTo(rotation, UP, normal);

        const normalTransform = mat4.create();
        mat4.fromQuat(normalTransform, rotation);

        const modelMatrix = mat4.create();
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, position);
        brushRadius *= 0.1;
        mat4.scale(modelMatrix, modelMatrix, [
            brushRadius,
            brushRadius,
            brushRadius,
        ]);
        mat4.mul(modelMatrix, modelMatrix, normalTransform);
        mat4.translate(modelMatrix, modelMatrix, [0, 0.1, 0]);

        const modelViewMatrix = mat4.create();
        mat4.mul(modelViewMatrix, viewMatrix, modelMatrix);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.lineShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.lineShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 3;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer);
            gl.vertexAttribPointer(
                this.lineShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.lineShader.attributes.aVertexPosition
            );
        }

        gl.drawArrays(gl.LINE_LOOP, 0, this.circleCount);

        gl.enable(gl.CULL_FACE);
    }
}

const INITIAL_TRANSLATION = vec3.create();
vec3.set(INITIAL_TRANSLATION, 0, 0, -6);

export function getView(
    out: mat4,
    position: vec3,
    rotation: quat,
    scale: number
) {
    mat4.identity(out);

    const translation = vec3.create();
    vec3.scale(translation, INITIAL_TRANSLATION, scale);

    mat4.translate(out, out, translation);

    mat4.translate(out, out, position);

    const rotationMatrix = mat4.create();
    mat4.fromQuat(rotationMatrix, rotation);

    mat4.mul(out, out, rotationMatrix);
}

export function getProjection(out: mat4, width: number, height: number) {
    mat4.perspective(out, FIELD_OF_VIEW, width / height, NEAR, FAR);
}
