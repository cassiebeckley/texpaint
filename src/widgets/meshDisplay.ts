import { mat4, quat, vec3 } from 'gl-matrix';
import {
    CUBE_INDICES,
    CUBE_LINE_INDICES,
    CUBE_VERTICES,
} from '../primitives';
import WindowManager, { loadTextureFromImage } from '../windowManager';

import loadShaderProgram, { Shader } from '../shaders';

import irradiance0 from 'url:../assets/backgrounds/forest_slope/irradiance0.exr';
import irradiance1 from 'url:../assets/backgrounds/forest_slope/irradiance1.exr';
import irradiance2 from 'url:../assets/backgrounds/forest_slope/irradiance2.exr';
import irradiance3 from 'url:../assets/backgrounds/forest_slope/irradiance3.exr';
import irradiance4 from 'url:../assets/backgrounds/forest_slope/irradiance4.exr';
import irradiance5 from 'url:../assets/backgrounds/forest_slope/irradiance5.exr';

import skybox0 from 'url:../assets/backgrounds/forest_slope/skybox0.png';
import skybox1 from 'url:../assets/backgrounds/forest_slope/skybox1.png';
import skybox2 from 'url:../assets/backgrounds/forest_slope/skybox2.png';
import skybox3 from 'url:../assets/backgrounds/forest_slope/skybox3.png';
import skybox4 from 'url:../assets/backgrounds/forest_slope/skybox4.png';
import skybox5 from 'url:../assets/backgrounds/forest_slope/skybox5.png';

import vertUVShader from '../shaders/uvShader/vert.glsl';
import fragUVShader from '../shaders/uvShader/frag.glsl';

import vertBackgroundShader from '../shaders/workspace/backgroundShader/vert.glsl';
import fragBackgroundShader from '../shaders/workspace/backgroundShader/frag.glsl';

import { FIELD_OF_VIEW } from '../constants';
import Mesh from '../mesh';
import { loadAssetFromURL } from '../loader';
import { AssetType } from '../loader/asset';
import { ImageStorage } from '../loader/image';

export default class MeshDisplay {
    cubeBuffer: WebGLBuffer;
    cubeIndexBuffer: WebGLBuffer;
    cubeLineIndexBuffer: WebGLBuffer;

    lineShader: Shader;

    backgroundLoaded: boolean;
    skyboxTexture: WebGLTexture;
    irradianceTexture: WebGLTexture;
    backgroundShader: Shader;

    async initGL(gl: WebGLRenderingContext) {
        this.skyboxTexture = gl.createTexture();
        this.irradianceTexture = gl.createTexture();

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

        this.cubeLineIndexBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeLineIndexBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(CUBE_LINE_INDICES),
            gl.STATIC_DRAW
        );

        this.backgroundShader = loadShaderProgram(
            gl,
            vertBackgroundShader,
            fragBackgroundShader
        );
        this.lineShader = loadShaderProgram(gl, vertUVShader, fragUVShader);

        let skyboxFaces = await Promise.all([skybox0, skybox1, skybox2, skybox3, skybox4, skybox5].map(url => loadAssetFromURL(url)));
        let irradianceFaces = await Promise.all([irradiance0, irradiance1, irradiance2, irradiance3, irradiance4, irradiance5].map(url => loadAssetFromURL(url)));
        console.log('loaded background');

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxTexture);

        let sides = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];

        const magenta = new Uint8ClampedArray([255, 0, 255]);

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
            gl.texImage2D(sides[i], level, internalFormat, image.width, image.height, 0, format, type, pixels);

            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }

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
            const internalFormat = gl.RGB;
            const format = gl.RGB;
            const type = gl.FLOAT;
            gl.texImage2D(sides[i], level, internalFormat, image.width, image.height, 0, format, type, pixels);

            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }

        this.backgroundLoaded = true;

        return true;
    }

    drawMainPass(
        gl: WebGLRenderingContext,
        width: number,
        height: number,
        mesh: Mesh,
        { position, rotation, scale, brushCursor }
    ) {
        gl.enable(gl.DEPTH_TEST);

        const view = mat4.create();
        getView(view, position, rotation, scale);

        const projection = mat4.create();
        getProjection(projection, width, height);

        if (this.backgroundLoaded) {
            this.drawBackground(gl, rotation, projection);
        }

        if (mesh) {
            mesh.draw(gl, view, projection, this.irradianceTexture);
        }

        // this.drawCube(gl, view, projection, [0, 0, 0], 0.4);
        this.drawCube(gl, view, projection, [0, 1, 0], 0.4);

        if (brushCursor) {
            // TODO: move UI gizmos to a later pass so they're not tonemapped
            this.drawCube(gl, view, projection, brushCursor, 0.4);
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

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.clearColor(0.2, 0.1, 0.3, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.drawMainPass(gl, width, height, windowManager.mesh, widgetProps);
    }

    drawBackground(
        gl: WebGLRenderingContext,
        rotation: quat,
        projectionMatrix: mat4
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

    drawCube(
        gl: WebGLRenderingContext,
        viewMatrix: mat4,
        projectionMatrix: mat4,
        position: vec3,
        brushRadius: number
    ) {
        gl.disable(gl.CULL_FACE);
        gl.useProgram(this.lineShader.program);

        const modelMatrix = mat4.create();
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, position);
        brushRadius *= 0.1;
        mat4.scale(modelMatrix, modelMatrix, [
            brushRadius,
            brushRadius,
            brushRadius,
        ]);

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
            gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
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

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeLineIndexBuffer);

        gl.drawElements(
            gl.LINES,
            CUBE_LINE_INDICES.length,
            gl.UNSIGNED_SHORT,
            0
        );

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
    mat4.perspective(out, FIELD_OF_VIEW, width / height, 0.1, 100.0);
}