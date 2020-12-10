import { vec2, vec3 } from "gl-matrix";

export type Triangle = [number, number, number];

export default class MeshData {
    name: string;
    vertices: vec3[];
    vertexNormals: vec3[];
    uvs: vec2[];
    triangles: Triangle[];

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