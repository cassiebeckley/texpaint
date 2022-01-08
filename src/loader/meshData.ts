import { vec2, vec3 } from 'gl-matrix';

export type Triangle = [number, number, number];

export default class MeshData {
    name: string;
    vertices: vec3[];
    vertexNormals: vec3[];
    uvs: vec2[];
    triangles: Triangle[];
    materialId: string;

    constructor(
        name: string,
        materialId: string,
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
        this.materialId = materialId;
    }

    intersect(
        outputPoint: vec3,
        outputUV: vec2,
        origin: vec3,
        direction: vec3,
        triangleIndex: number
    ) {
        const triangle = this.triangles[triangleIndex];

        return rayTriangleIntersection(
            outputPoint,
            outputUV,
            origin,
            direction,
            this.vertices[triangle[0]],
            this.vertices[triangle[1]],
            this.vertices[triangle[2]]
        );
    }

    getNormal(outputNormal: vec3, uv: vec2, triangleIndex: number) {
        const [u, v] = uv;
        const triangle = this.triangles[triangleIndex];
        vec3.zero(outputNormal);

        const normalContribution = vec3.create();

        vec3.scale(normalContribution, this.vertexNormals[triangle[0]], u);
        vec3.add(outputNormal, outputNormal, normalContribution);

        vec3.scale(normalContribution, this.vertexNormals[triangle[1]], v);
        vec3.add(outputNormal, outputNormal, normalContribution);

        vec3.scale(
            normalContribution,
            this.vertexNormals[triangle[2]],
            1 - u - v
        );
        vec3.add(outputNormal, outputNormal, normalContribution);

        vec3.normalize(outputNormal, outputNormal);
    }

    raycast(
        outputIntersection: vec3,
        outputNormal: vec3,
        origin: vec3,
        direction: vec3
    ) {
        // TODO: use a BVH to speed this up
        let closest = Infinity;
        let closestPoint = vec3.create();
        const closestUV = vec2.create();
        let closestTriangleIndex = 0;

        const currentPoint = vec3.create();
        const currentUV = vec2.create();

        for (let i = 0; i < this.triangles.length; i++) {
            const intersection = this.intersect(
                currentPoint,
                currentUV,
                origin,
                direction,
                i
            );
            if (intersection > 0 && intersection < closest) {
                closest = intersection;
                vec3.copy(closestPoint, currentPoint);
                vec2.copy(closestUV, currentUV);
                closestTriangleIndex = i;
            }
        }

        if (isFinite(closest)) {
            vec3.copy(outputIntersection, closestPoint);

            this.getNormal(outputNormal, currentUV, closestTriangleIndex);
        }

        return closest;
    }
}

const rayTriangleIntersection = (
    point: vec3,
    uv: vec2,
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

    const pvec = vec3.create();
    vec3.cross(pvec, direction, v0v2);

    const det = vec3.dot(v0v1, pvec);

    // if (det < Number.EPSILON) return Infinity; // backface culling

    if (Math.abs(det) < Number.EPSILON) {
        // ray and triangle are parallel
        return Infinity;
    }

    const invDet = 1 / det;

    const tvec = vec3.create();
    vec3.sub(tvec, origin, v0);
    const u = vec3.dot(tvec, pvec) * invDet;
    if (u < 0 || u > 1) {
        return Infinity;
    }

    const qvec = vec3.create();
    vec3.cross(qvec, tvec, v0v1);
    const v = vec3.dot(direction, qvec) * invDet;
    if (v < 0 || u + v > 1) return Infinity;

    const t = vec3.dot(v0v2, qvec) * invDet;

    vec3.zero(point);
    vec3.scale(point, direction, t);
    vec3.add(point, point, origin);

    vec2.set(uv, u, v);

    return t;
};
