import { vec2, vec3 } from 'gl-matrix';
import Asset, { AssetType } from '../asset';
import MeshData, { Triangle } from '../meshData';

interface IndexedVertex {
    vertexIndex: number;
    uvIndex: number;
    normalIndex: number;
}
type IndexedTriangle = [IndexedVertex, IndexedVertex, IndexedVertex];

const reIndex = (
    name: string,
    vertices: vec3[],
    normals: vec3[],
    uvs: vec2[],
    triangles: IndexedTriangle[]
): MeshData => {
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

    const mesh = new MeshData(name);

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

    return mesh;
};

const utf8decoder = new TextDecoder();

export default async function parseWaveformObj(
    objBuffer: ArrayBuffer
): Promise<Asset> {
    const obj = utf8decoder.decode(objBuffer);
    const meshes: MeshData[] = [];

    const vertices: vec3[] = [];
    const normals: vec3[] = [];
    const uvs: vec2[] = [];

    let name: string = '';
    let indexedTriangles: IndexedTriangle[] = [];

    let startIndex = 0;
    let currentIndex = 0; // TODO: check if this actually works

    const saveMesh = () => {
        meshes.push(reIndex(name, vertices, normals, uvs, indexedTriangles));

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
                vec2.set(uv, parseFloat(operands[1]), parseFloat(operands[2]));
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

    return {
        type: AssetType.Mesh,
        meshes,
    };
}
