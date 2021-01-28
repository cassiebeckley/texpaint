import { vec3, mat4, vec2 } from 'gl-matrix';
import ShaderSource, { Shader } from './shaders';

import vertStandardShader from './shaders/workspace/standard.shader/vert.glsl';
import fragStandardShader from './shaders/workspace/standard.shader/frag.glsl';

import vertNormalShader from './shaders/workspace/normal.shader/vert.glsl';
import fragNormalShader from './shaders/workspace/normal.shader/frag.glsl';

import vertPositionShader from './shaders/workspace/position.shader/vert.glsl';
import fragPositionShader from './shaders/workspace/position.shader/frag.glsl';

import vertUVShader from './shaders/uv.shader/vert.glsl';
import fragUVShader from './shaders/uv.shader/frag.glsl';

import MeshData from './loader/meshData';
import MaterialSlate from './materialSlate';
import Lighting from './lighting';

export default class Mesh {
    data: MeshData;

    vertexBuffer: WebGLBuffer;
    normalBuffer: WebGLBuffer;
    uvBuffer: WebGLBuffer;

    uvLineBuffer: WebGLBuffer;
    uvLineCount: number;

    indexBuffer: WebGLBuffer;
    standardShader: Shader;
    normalShader: Shader;
    positionShader: Shader;
    uvShader: Shader;

    constructor(gl: WebGLRenderingContext, data: MeshData) {
        this.data = data;

        this.vertexBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
        this.uvBuffer = gl.createBuffer();

        this.uvLineBuffer = gl.createBuffer();
        this.uvLineCount = 0;

        this.indexBuffer = gl.createBuffer();

        const standardSource = new ShaderSource(
            'standard',
            vertStandardShader,
            fragStandardShader
        );
        this.standardShader = standardSource.load(gl);

        const normalShaderSource = new ShaderSource(
            'normal',
            vertNormalShader,
            fragNormalShader
        );
        this.normalShader = normalShaderSource.load(gl);

        this.positionShader = new ShaderSource(
            'position',
            vertPositionShader,
            fragPositionShader
        ).load(gl);

        const uvSource = new ShaderSource('uv', vertUVShader, fragUVShader);
        this.uvShader = uvSource.load(gl);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(this.data.vertices)),
            gl.STATIC_DRAW
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(this.data.vertexNormals)),
            gl.STATIC_DRAW
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(this.data.uvs)),
            gl.STATIC_DRAW
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(flatten(this.data.triangles)),
            gl.STATIC_DRAW
        );

        // I'm calculating the line data here since it seems unlikely we'll need to access it from JS
        const lines = [];
        for (let i = 0; i < this.data.triangles.length; i++) {
            const triangle = this.data.triangles[i];

            lines.push(this.data.uvs[triangle[0]]);
            lines.push(this.data.uvs[triangle[1]]);

            lines.push(this.data.uvs[triangle[1]]);
            lines.push(this.data.uvs[triangle[2]]);

            lines.push(this.data.uvs[triangle[2]]);
            lines.push(this.data.uvs[triangle[0]]);

            this.uvLineCount += 6;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvLineBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(lines)),
            gl.STATIC_DRAW
        );
    }

    draw(
        gl: WebGLRenderingContext,
        modelViewMatrix: mat4,
        projectionMatrix: mat4,
        lighting: Lighting,
        backgroundMatrix: mat4,
        materials: Map<string, MaterialSlate>
    ) {
        const slate = materials.get(this.data.materialId);

        setUpStandard(
            gl,
            modelViewMatrix,
            projectionMatrix,
            lighting,
            backgroundMatrix,
            this.standardShader,
            this.vertexBuffer,
            3,
            this.uvBuffer,
            this.normalBuffer,
            slate.albedo,
            slate.roughness,
            slate.metallic
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(
            gl.TRIANGLES,
            this.data.triangles.length * 3,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    private drawBuffer(
        gl: WebGLRenderingContext,
        modelViewMatrix: mat4,
        projectionMatrix: mat4,
        normal: boolean
    ) {
        const shader = normal ? this.normalShader : this.positionShader;

        gl.useProgram(shader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            shader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            shader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        const invModelView = mat4.create();
        mat4.invert(invModelView, modelViewMatrix);

        const cameraPos = vec3.create();
        vec3.transformMat4(cameraPos, cameraPos, invModelView);

        gl.uniform3fv(shader.uniforms.uCameraPosition, cameraPos);

        {
            const size = 3;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
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

        if (normal) {
            {
                const size = 3;
                const type = gl.FLOAT;
                const normalize = true;
                const stride = 0;
                const offset = 0;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
                gl.vertexAttribPointer(
                    shader.attributes.aVertexNormal,
                    size,
                    type,
                    normalize,
                    stride,
                    offset
                );
                gl.enableVertexAttribArray(shader.attributes.aVertexNormal);
            }
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        gl.drawElements(
            gl.TRIANGLES,
            this.data.triangles.length * 3,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    drawNormals(
        gl: WebGLRenderingContext,
        modelViewMatrix: mat4,
        projectionMatrix: mat4
    ) {
        this.drawBuffer(gl, modelViewMatrix, projectionMatrix, true);
    }

    drawPositions(
        gl: WebGLRenderingContext,
        modelViewMatrix: mat4,
        projectionMatrix: mat4
    ) {
        this.drawBuffer(gl, modelViewMatrix, projectionMatrix, false);
    }

    drawUVLines(
        gl: WebGLRenderingContext,
        modelViewMatrix: mat4,
        uiProjectionMatrix: mat4
    ) {
        gl.useProgram(this.uvShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.uvShader.uniforms.uProjectionMatrix,
            false,
            uiProjectionMatrix
        );
        gl.uniformMatrix4fv(
            this.uvShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvLineBuffer);
            gl.vertexAttribPointer(
                this.uvShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.uvShader.attributes.aVertexPosition
            );
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        gl.drawArrays(gl.LINES, 0, this.uvLineCount);
    }

    raycast(
        intersectionOutput: vec3,
        normalOutput: vec3,
        origin: vec3,
        direction: vec3
    ) {
        // TODO: use a BVH to speed this up
        return this.data.raycast(
            intersectionOutput,
            normalOutput,
            origin,
            direction
        );
    }
}

const flatten = (vs): number[] => {
    let flat = [];

    for (let i = 0; i < vs.length; i++) {
        let v = vs[i];
        for (let j = 0; j < v.length; j++) {
            flat.push(v[j]);
        }
    }

    return flat;
};

export function setUpStandard(
    gl: WebGLRenderingContext,
    modelViewMatrix: mat4,
    projectionMatrix: mat4,
    lighting: Lighting,
    backgroundMatrix: mat4,
    standardShader: Shader,
    vertexBuffer: WebGLBuffer,
    vertexBufferSize: number,
    uvBuffer: WebGLBuffer,
    normalBuffer: WebGLBuffer,
    albedo: WebGLTexture,
    roughness: WebGLTexture,
    metallic: WebGLTexture,
    filter = gl.LINEAR,
    orthographic?: boolean
) {
    gl.useProgram(standardShader.program);

    // set projection and model*view matrices;
    gl.uniformMatrix4fv(
        standardShader.uniforms.uProjectionMatrix,
        false,
        projectionMatrix
    );
    gl.uniformMatrix4fv(
        standardShader.uniforms.uModelViewMatrix,
        false,
        modelViewMatrix
    );
    // Matrix to represent lighting rotation
    gl.uniformMatrix4fv(
        standardShader.uniforms.uBackgroundMatrix,
        false,
        backgroundMatrix
    );

    const invModelView = mat4.create();
    mat4.invert(invModelView, modelViewMatrix);

    const cameraPos = vec3.create();
    vec3.transformMat4(cameraPos, cameraPos, invModelView);

    if (orthographic) {
        cameraPos[2] = -100000;
    }

    gl.uniform3fv(standardShader.uniforms.uCameraPosition, cameraPos);

    {
        const size = vertexBufferSize;
        const type = gl.FLOAT; // 32 bit floats
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(
            standardShader.attributes.aVertexPosition,
            size,
            type,
            normalize,
            stride,
            offset
        );
        gl.enableVertexAttribArray(standardShader.attributes.aVertexPosition);
    }

    {
        const size = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.vertexAttribPointer(
            standardShader.attributes.aTextureCoord,
            size,
            type,
            normalize,
            stride,
            offset
        );
        gl.enableVertexAttribArray(standardShader.attributes.aTextureCoord);
    }

    {
        const size = 3;
        const type = gl.FLOAT;
        const normalize = true;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.vertexAttribPointer(
            standardShader.attributes.aVertexNormal,
            size,
            type,
            normalize,
            stride,
            offset
        );
        gl.enableVertexAttribArray(standardShader.attributes.aVertexNormal);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, albedo);
    gl.uniform1i(standardShader.uniforms.uAlbedo, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, roughness);
    gl.uniform1i(standardShader.uniforms.uRoughness, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, metallic);
    gl.uniform1i(standardShader.uniforms.uMetallic, 2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.irradianceTexture);
    gl.uniform1i(standardShader.uniforms.uIrradiance, 3);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, lighting.brdfTexture);
    gl.uniform1i(standardShader.uniforms.uBrdfLUT, 4);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.prefilteredTextures[0]);
    gl.uniform1i(standardShader.uniforms.uPrefilterMapLevel0, 5);

    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.prefilteredTextures[1]);
    gl.uniform1i(standardShader.uniforms.uPrefilterMapLevel1, 6);

    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.prefilteredTextures[2]);
    gl.uniform1i(standardShader.uniforms.uPrefilterMapLevel2, 7);

    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.prefilteredTextures[3]);
    gl.uniform1i(standardShader.uniforms.uPrefilterMapLevel3, 8);

    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, lighting.prefilteredTextures[4]);
    gl.uniform1i(standardShader.uniforms.uPrefilterMapLevel4, 9);
}
