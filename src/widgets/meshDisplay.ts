import { mat4, quat, vec3 } from 'gl-matrix';
import {
    CUBE_INDICES,
    CUBE_VERTICES,
    generateCircleVertices,
} from '../primitives';
import WindowManager from '../windowManager';

import ShaderSource, { Shader } from '../shaders';

import vertUVShader from '../shaders/uv.shader/vert.glsl';
import fragUVShader from '../shaders/uv.shader/frag.glsl';

import vertBackgroundShader from '../shaders/workspace/background.shader/vert.glsl';
import fragBackgroundShader from '../shaders/workspace/background.shader/frag.glsl';

import { FAR, FIELD_OF_VIEW, NEAR } from '../constants';
import Mesh from '../mesh';
import type Lighting from '../lighting';

const UP = vec3.create();
vec3.set(UP, 0, 1, 0);

export default class MeshDisplay {
    cubeBuffer: WebGLBuffer;
    cubeIndexBuffer: WebGLBuffer;

    circleBuffer: WebGLBuffer;
    circleCount: number;

    lineShader: Shader;

    backgroundShader: Shader;

    async initGL(gl: WebGLRenderingContext) {
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

        return true;
    }

    drawMainPass(
        gl: WebGLRenderingContext,
        width: number,
        height: number,
        mesh: Mesh,
        lighting: Lighting,
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

        if (lighting.loaded) {
            // this.drawBackground(gl, rotation, projection, lighting, backgroundOffset);
        }

        if (mesh) {
            const backgroundMatrix = mat4.create();
            mat4.identity(backgroundMatrix);
            mat4.rotateY(backgroundMatrix, backgroundMatrix, -backgroundOffset);

            mesh.draw(
                gl,
                view,
                projection,
                lighting.irradianceTexture,
                lighting.prefilteredTextures,
                lighting.brdfTexture,
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

        this.drawMainPass(
            gl,
            width,
            height,
            windowManager.mesh,
            windowManager.lighting,
            widgetProps
        );
    }

    drawBackground(
        gl: WebGLRenderingContext,
        rotation: quat,
        projectionMatrix: mat4,
        lighting: Lighting,
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
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.skyboxTexture);
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
