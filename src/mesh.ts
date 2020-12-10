import { vec3, vec2, mat4 } from 'gl-matrix';
import loadShaderProgram, { Shader } from './shaders';

import vertStandardShader from './shaders/workspace/standardShader/vert.glsl';
import fragStandardShader from './shaders/workspace/standardShader/frag.glsl';

import vertUVShader from './shaders/uvShader/vert.glsl';
import fragUVShader from './shaders/uvShader/frag.glsl';
import MeshData from './loader/meshData';
import Slate from './slate';

export default class Mesh {
    data: MeshData;

    vertexBuffer: WebGLBuffer;
    normalBuffer: WebGLBuffer;
    uvBuffer: WebGLBuffer;

    uvLineBuffer: WebGLBuffer;
    uvLineCount: number;

    indexBuffer: WebGLBuffer;
    standardShader: Shader;
    uvShader: Shader;

    slate: Slate;

    constructor(
        gl: WebGLRenderingContext,
        slate: Slate,
        data: MeshData
    ) {
        this.slate = slate;
        this.data = data;

        this.vertexBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
        this.uvBuffer = gl.createBuffer();

        this.uvLineBuffer = gl.createBuffer();
        this.uvLineCount = 0;

        this.indexBuffer = gl.createBuffer();

        this.standardShader = loadShaderProgram(
            gl,
            vertStandardShader,
            fragStandardShader
        );

        this.uvShader = loadShaderProgram(gl, vertUVShader, fragUVShader);

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
        irradiance: WebGLTexture
    ) {
        gl.useProgram(this.standardShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.standardShader.uniforms.uProjectionMatrix,
            false,
            projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.standardShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        const invModelView = mat4.create();
        mat4.invert(invModelView, modelViewMatrix);

        const cameraPos = vec3.create();
        vec3.transformMat4(cameraPos, cameraPos, invModelView);

        gl.uniform3fv(
            this.standardShader.uniforms.uCameraPosition,
            cameraPos
        );

        {
            const size = 3;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.vertexAttribPointer(
                this.standardShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.standardShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            gl.vertexAttribPointer(
                this.standardShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.standardShader.attributes.aTextureCoord
            );
        }

        {
            const size = 3;
            const type = gl.FLOAT;
            const normalize = true;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.vertexAttribPointer(
                this.standardShader.attributes.aVertexNormal,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.standardShader.attributes.aVertexNormal
            );
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.slate.albedo);
        gl.uniform1i(this.standardShader.uniforms.uAlbedo, 0);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, irradiance);
        gl.uniform1i(this.standardShader.uniforms.uIrradiance, 1);

        gl.drawElements( // TODO: do instanced draw with drawArrays
            gl.TRIANGLES,
            this.data.triangles.length * 3,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    drawUV(
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

    raycast(intersection: vec3, origin: vec3, direction: vec3) {
        // TODO: use a BVH to speed this up
        return this.data.raycast(intersection, origin, direction);
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
