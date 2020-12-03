import { mat4, quat, vec3 } from 'gl-matrix';
import {
    CUBE_INDICES,
    CUBE_LINE_INDICES,
    CUBE_VERTICES,
    generateRectVerticesStrip,
    rectVerticesStripUV,
} from '../primitives';
import WindowManager from '../windowManager';

import loadShaderProgram, { Shader } from '../shaders';

import background from '../immenstadter_horn_1k.hdr';
// import background from '../../test_assets/classroom_blender.hdr';
// import background from '../../test_assets/10px_blender.hdr';
// import background from '../../test_assets/4px_blender.hdr';
console.log(background);

import vertUVShader from '../shaders/uvShader/vert.glsl';
import fragUVShader from '../shaders/uvShader/frag.glsl';

import vertBackgroundShader from '../shaders/backgroundShader/vert.glsl';
import fragBackgroundShader from '../shaders/backgroundShader/frag.glsl';

import vertCompositeShader from '../shaders/compositeShader/vert.glsl';
import fragCompositeShader from '../shaders/compositeShader/frag.glsl';

import { FIELD_OF_VIEW } from '../constants';
import { parseRadianceHDR } from '../parser';
import Mesh from '../mesh';

export default class MeshDisplay {
    cubeBuffer: WebGLBuffer;
    cubeIndexBuffer: WebGLBuffer;
    cubeLineIndexBuffer: WebGLBuffer;

    lineShader: Shader;

    backgroundLoaded: boolean;
    backgroundTexture: WebGLTexture;
    backgroundShader: Shader;

    compositePositionBuffer: WebGLBuffer;
    compositeUVBuffer: WebGLBuffer;

    compositeFramebuffer: WebGLFramebuffer;
    compositeDepthBuffer: WebGLRenderbuffer;
    compositeShader: Shader;

    initGL(gl: WebGLRenderingContext) {
        this.backgroundTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        this.backgroundLoaded = false;
        loadEnvironment(background).then((hdr) => {
            console.log('loaded background'); // TODO: redraw on load

            gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
            const level = 0;
            const internalFormat = gl.RGB;
            const srcFormat = gl.RGB;
            const srcType = gl.FLOAT;
            const border = 0;
            gl.texImage2D(
                gl.TEXTURE_2D,
                level,
                internalFormat,
                hdr.width,
                hdr.height,
                border,
                srcFormat,
                srcType,
                hdr.pixels
            );
            this.backgroundLoaded = true;
        });

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

        this.compositePositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.compositePositionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(generateRectVerticesStrip(0, 0, 1, 1)),
            gl.STATIC_DRAW
        );

        this.compositeUVBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.compositeUVBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(rectVerticesStripUV),
            gl.STATIC_DRAW
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        this.compositeFramebuffer = gl.createFramebuffer();
        this.compositeDepthBuffer = gl.createRenderbuffer();

        this.compositeShader = loadShaderProgram(
            gl,
            vertCompositeShader,
            fragCompositeShader
        );
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
            mesh.draw(gl, view, projection, this.backgroundTexture);
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

        const wv = gl.getParameter(gl.VIEWPORT);

        const cTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, cTexture);
        {
            const level = 0;
            const internalFormat = gl.RGBA;
            const border = 0;
            const format = gl.RGBA;
            const type = gl.FLOAT;
            const data = null;
            gl.texImage2D(
                gl.TEXTURE_2D,
                level,
                internalFormat,
                width,
                height,
                border,
                format,
                type,
                data
            );
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            cTexture,
            0
        );

        gl.bindRenderbuffer(gl.RENDERBUFFER, this.compositeDepthBuffer);
        gl.renderbufferStorage(
            gl.RENDERBUFFER,
            gl.DEPTH_COMPONENT16,
            width,
            height
        );
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            this.compositeDepthBuffer
        );

        gl.viewport(0, 0, width, height);

        gl.clearColor(0.2, 0.1, 0.3, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.drawMainPass(gl, width, height, windowManager.mesh, widgetProps);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.useProgram(this.compositeShader.program); // set projection and model*view matrices;

        const modelViewMatrix = mat4.create();
        mat4.identity(modelViewMatrix);
        mat4.scale(modelViewMatrix, modelViewMatrix, [width, height, 1]);

        gl.uniformMatrix4fv(
            this.compositeShader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );
        gl.uniformMatrix4fv(
            this.compositeShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.compositePositionBuffer);
            gl.vertexAttribPointer(
                this.compositeShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.compositeShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.compositeUVBuffer);
            gl.vertexAttribPointer(
                this.compositeShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.compositeShader.attributes.aTextureCoord
            );
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, cTexture);
        gl.uniform1i(this.compositeShader.uniforms.uSampler, 0);

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }

        gl.viewport(wv[0], wv[1], wv[2], wv[3]);

        gl.deleteTexture(cTexture);
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
        gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
        gl.uniform1i(this.backgroundShader.uniforms.uSampler, 0);

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

const loadEnvironment = async (background: string) => {
    const response = await fetch(background);
    const data = await response.arrayBuffer();
    return await parseRadianceHDR(data);
};
