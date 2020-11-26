import { vec3, vec2, mat4 } from 'gl-matrix';
import getWindowManager from './windowManager';
import loadShaderProgram, { Shader } from './shaders';

import vertStandardShader from './shaders/standardShader/vert.glsl';
import fragStandardShader from './shaders/standardShader/frag.glsl';

interface IndexedVertex {
    vertexIndex: number;
    uvIndex: number;
    normalIndex: number;
}

type Triangle = [number, number, number];
type IndexedTriangle = [IndexedVertex, IndexedVertex, IndexedVertex];

const reIndex = (
    name: string,
    vertices: vec3[],
    normals: vec3[],
    uvs: vec2[],
    triangles: IndexedTriangle[]
): Mesh => {
    const allVertices = [];
    const allNormals = [];
    const allUVs = [];

    for (let i = 0; i < triangles.length; i++) {
        const indexedTriangle: IndexedTriangle = triangles[i];

        for (let j = 0; j < indexedTriangle.length; j++) {
            // OBJ faces are 1-indexed
            const indices: IndexedVertex = indexedTriangle[j];
            allVertices.push(vertices[indices.vertexIndex - 1]);
            allNormals.push(normals[indices.normalIndex - 1]);
            allUVs.push(uvs[indices.uvIndex - 1]);
        }
    }

    const newIndex = {};
    let currentIndex = 0;

    const mesh = new Mesh(name);

    for (let i = 0; i < allVertices.length; i += 3) {
        const triangle: Triangle = [0, 0, 0];
        for (let j = 0; j < 3; j++) {
            const vertex = allVertices[i + j];
            const normal = allNormals[i + j];
            const uv = allUVs[i + j];

            const ref = `${vertex}:${normal}:${uv}`;

            if (!newIndex.hasOwnProperty(ref)) {
                mesh.vertices[currentIndex] = vertex;
                mesh.vertexNormals[currentIndex] = normal;
                mesh.uvs[currentIndex] = uv;

                newIndex[ref] = currentIndex;
                currentIndex++;
            }
            triangle[j] = newIndex[ref];
        }
        mesh.triangles.push(triangle);
    }

    mesh.setBuffers();

    return mesh;
};

export default class Mesh {
    name: string;
    vertices: vec3[];
    vertexNormals: vec3[];
    uvs: vec2[];
    triangles: Triangle[];

    vertexBuffer: WebGLBuffer;
    normalBuffer: WebGLBuffer;
    uvBuffer: WebGLBuffer;

    indexBuffer: WebGLBuffer;
    standardShader: Shader;

    texture: WebGLTexture;

    constructor(
        name: string,
        vertices: vec3[] = [],
        vertexNormals: vec3[] = [],
        uvs: vec2[] = [],
        triangles: Triangle[] = []
    ) {
        this.name = name;
        this.vertices = vertices;
        this.vertexNormals = vertexNormals;
        this.uvs = uvs;
        this.triangles = triangles;

        const gl = getWindowManager().gl;
        this.vertexBuffer = gl.createBuffer();
        this.normalBuffer = gl.createBuffer();
        this.uvBuffer = gl.createBuffer();

        this.indexBuffer = gl.createBuffer();

        this.standardShader = loadShaderProgram(
            gl,
            vertStandardShader,
            fragStandardShader
        );
    }

    setTexture(tex: WebGLTexture) {
        this.texture = tex;
    }

    setBuffers() {
        const gl = getWindowManager().gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(this.vertices)),
            gl.STATIC_DRAW
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(this.vertexNormals)),
            gl.STATIC_DRAW
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(flatten(this.uvs)),
            gl.STATIC_DRAW
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(flatten(this.triangles)),
            gl.STATIC_DRAW
        );
    }

    draw(modelViewMatrix: mat4) {
        const windowManager = getWindowManager();
        const gl = windowManager.gl;

        //// draw 2d image view ////
        gl.useProgram(this.standardShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.standardShader.uniforms.uProjectionMatrix,
            false,
            windowManager.projectionMatrix
        );
        gl.uniformMatrix4fv(
            this.standardShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
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

        if (this.texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(this.standardShader.uniforms.uSampler, 0);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }

        gl.drawElements(
            gl.TRIANGLES,
            this.triangles.length * 3,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    static fromWaveformObj(obj: string): Mesh[] {
        const meshes: Mesh[] = [];

        const vertices: vec3[] = [];
        const normals: vec3[] = [];
        const uvs: vec2[] = [];

        let name: string = '';
        let indexedTriangles: IndexedTriangle[] = [];

        let startIndex = 0;
        let currentIndex = 0; // TODO: check if this actually works

        const saveMesh = () => {
            meshes.push(
                reIndex(name, vertices, normals, uvs, indexedTriangles)
            );

            indexedTriangles = [];
        };

        const lines = obj.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const operands = line.split(' ');

            switch (operands[0].toLowerCase()) {
                case 'o': // new mesh
                    if (indexedTriangles.length > 0) {
                        saveMesh();
                    }
                    name = operands[1];
                    break;
                case 'v':
                    currentIndex++;
                    const vertex = vec3.create();
                    vec3.set(
                        vertex,
                        parseFloat(operands[1]),
                        parseFloat(operands[2]),
                        parseFloat(operands[3])
                    );
                    vertices.push(vertex);
                    break;
                case 'vt':
                    const uv = vec2.create();
                    vec2.set(
                        uv,
                        parseFloat(operands[1]),
                        parseFloat(operands[2])
                    );
                    uvs.push(uv);
                    break;
                case 'vn':
                    const normal = vec3.create();
                    vec3.set(
                        normal,
                        parseFloat(operands[1]),
                        parseFloat(operands[2]),
                        parseFloat(operands[3])
                    );
                    normals.push(normal);
                    break;
                case 'f':
                    // here I'm assuming the faces have a CCW order
                    const faceIndices = [];
                    for (let i = 1; i < operands.length; i++) {
                        let [vertexIndex, uvIndex, normalIndex] = operands[i]
                            .split('/')
                            .map((n) => parseFloat(n) - startIndex);

                        if (isNaN(uvIndex)) {
                            uvIndex = vertexIndex - startIndex;
                        }

                        if (isNaN(normalIndex)) {
                            normalIndex = vertexIndex - startIndex;
                        }

                        faceIndices.push({
                            vertexIndex,
                            uvIndex,
                            normalIndex,
                        });
                    }

                    const sharedVertex = faceIndices[0];
                    for (let i = 2; i < faceIndices.length; i++) {
                        indexedTriangles.push([
                            sharedVertex,
                            faceIndices[i - 1],
                            faceIndices[i],
                        ]);
                    }
                    break;
            }
        }

        if (indexedTriangles.length > 0) {
            saveMesh();
        }

        return meshes;
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
