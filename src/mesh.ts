import { vec3, vec2, mat4 } from 'gl-matrix';
import loadShaderProgram, { Shader } from './shaders';

import vertStandardShader from './shaders/standardShader/vert.glsl';
import fragStandardShader from './shaders/standardShader/frag.glsl';

import vertUVShader from './shaders/uvShader/vert.glsl';
import fragUVShader from './shaders/uvShader/frag.glsl';

interface IndexedVertex {
    vertexIndex: number;
    uvIndex: number;
    normalIndex: number;
}

type Triangle = [number, number, number];
type IndexedTriangle = [IndexedVertex, IndexedVertex, IndexedVertex];

const reIndex = (
    gl: WebGLRenderingContext,
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

    const mesh = new Mesh(gl, name);

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

    mesh.setBuffers(gl);

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

    uvLineBuffer: WebGLBuffer;
    uvLineCount: number;

    indexBuffer: WebGLBuffer;
    standardShader: Shader;
    uvShader: Shader;

    texture: WebGLTexture;

    constructor(
        gl: WebGLRenderingContext,
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
    }

    setTexture(tex: WebGLTexture) {
        this.texture = tex;
    }

    setBuffers(gl: WebGLRenderingContext) {
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

        // I'm calculating the line data here since it seems unlikely we'll need to access it from JS
        const lines = [];
        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];

            lines.push(this.uvs[triangle[0]]);
            lines.push(this.uvs[triangle[1]]);

            lines.push(this.uvs[triangle[1]]);
            lines.push(this.uvs[triangle[2]]);

            lines.push(this.uvs[triangle[2]]);
            lines.push(this.uvs[triangle[0]]);

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
        lighting: WebGLTexture
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

        if (lighting) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, lighting);
            gl.uniform1i(this.standardShader.uniforms.uBackground, 1);
        }

        gl.drawElements(
            gl.TRIANGLES,
            this.triangles.length * 3,
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

    static fromWaveformObj(gl: WebGLRenderingContext, obj: string): Mesh[] {
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
                reIndex(gl, name, vertices, normals, uvs, indexedTriangles)
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

    raycast(intersection: vec3, origin: vec3, direction: vec3) {
        // TODO: use a BVH to speed this up
        let closest = Infinity;
        let closestPoint = vec3.create();

        const currentPoint = vec3.create();

        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];

            const intersection = rayTriangleIntersection(
                currentPoint,
                origin,
                direction,
                this.vertices[triangle[0]],
                this.vertices[triangle[1]],
                this.vertices[triangle[2]]
            );
            if (intersection > 0 && intersection < closest) {
                closest = intersection;
                vec3.copy(closestPoint, currentPoint);
            }
        }

        if (isFinite(closest)) {
            vec3.copy(intersection, closestPoint);
            return true;
        }

        return false;
    }
}

const rayTriangleIntersection = (
    point: vec3,
    origin: vec3,
    direction: vec3,
    v0: vec3,
    v1: vec3,
    v2: vec3
) => {
    const v0v1 = vec3.create();
    const v0v2 = vec3.create();

    vec3.sub(v0v1, v1, v0);
    vec3.sub(v0v2, v2, v0);

    const normal = vec3.create();
    vec3.cross(normal, v0v1, v0v2);
    vec3.normalize(normal, normal);

    const normalDotRayDirection = vec3.dot(normal, direction);
    if (Math.abs(normalDotRayDirection) < Number.EPSILON) {
        return Infinity;
    }

    const d = vec3.dot(normal, v0);
    const t = (vec3.dot(normal, origin) + d) / -normalDotRayDirection;

    if (t < 0) {
        return -1;
    }

    vec3.zero(point);
    vec3.scale(point, direction, t);
    vec3.add(point, point, origin);

    const edge0 = vec3.create();
    vec3.sub(edge0, v1, v0);

    const vp0 = vec3.create();
    vec3.sub(vp0, point, v0);

    const C = vec3.create();
    vec3.cross(C, edge0, vp0);

    if (vec3.dot(normal, C) < 0) {
        return Infinity;
    }

    const edge1 = vec3.create();
    vec3.sub(edge1, v2, v1);

    const vp1 = vec3.create();
    vec3.sub(vp1, point, v1);
    vec3.cross(C, edge1, vp1);

    if (vec3.dot(normal, C) < 0) {
        return Infinity;
    }

    const edge2 = vec3.create();
    vec3.sub(edge2, v0, v2);

    const vp2 = vec3.create();
    vec3.sub(vp2, point, v0);
    vec3.cross(C, edge2, vp2);

    if (vec3.dot(normal, C) < 0) {
        return Infinity;
    }

    return t;
};

// const rayTriangleIntersection = (origin: vec3, direction: vec3, v0: vec3, v1: vec3, v2: vec3): number => {
//     console.log('ray-triangle check:', origin, direction, v0, v1, v2);
//     const edge1 = vec3.create();
//     const edge2 = vec3.create();

//     const h = vec3.create();
//     const s = vec3.create();
//     const q = vec3.create();

//     vec3.sub(edge1, v1, v0);
//     vec3.sub(edge2, v2, v0);

//     vec3.cross(h, direction, edge2);
//     const a = vec3.dot(edge1, h);
//     if (a > -Number.EPSILON && a < Number.EPSILON) {
//         console.log('parallel');
//         // ray is parallel to triangle
//         return 0;
//     }

//     const f = 1 / a;
//     vec3.sub(s, origin, v0);
//     const u = f * vec3.dot(s, h);
//     if (u < 0 || u > 1) {
//         console.log('failed check 1');
//         return 0;
//     }

//     vec3.cross(q, s, edge1);
//     const v = f * vec3.dot(direction, q);
//     if (v < 0 || u + v > 0) {
//         console.log('failed check 2');
//         return 0;
//     }

//     const t = f * vec3.dot(edge2, q);
//     if (t > Number.EPSILON) {
//         return t;
//     }

//     console.log('um... t?', t);

//     return 0;
// }

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
