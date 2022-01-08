import { vec3 } from 'gl-matrix';
import MeshData from './loader/meshData';

// TODO: this could really use tests

type MeshTriangle = {
    mesh: MeshData;
    indices: [number, number, number];
};

type Slab = {
    near: number;
    far: number;
};

type Extent = Slab[];

const SLANT = Math.sqrt(3) / 3;
const EXTENT_NORMALS = [
    vec3.clone([1, 0, 0]),
    vec3.clone([0, 1, 0]),
    vec3.clone([0, 0, 1]),
    vec3.clone([SLANT, SLANT, SLANT]),
    vec3.clone([-SLANT, SLANT, SLANT]),
    vec3.clone([SLANT, -SLANT, SLANT]),
    vec3.clone([SLANT, SLANT, -SLANT]),
];

enum NodeType {
    Leaf,
    Branch,
}

type LeafNode = {
    type: NodeType.Leaf;
    triangle: MeshTriangle;
};

type BranchNode = {
    type: NodeType.Branch;
    extent: Extent;
    children: Node[];
};

type Node = LeafNode | BranchNode;

const triangleCenterCache = new WeakMap();
const getTriangleCenter = (centerOutput: vec3, triangle: MeshTriangle) => {
    if (!triangleCenterCache.has(triangle)) {
        const center = vec3.create();
        vec3.add(center, center, triangle.mesh.vertices[triangle.indices[0]]);
        vec3.add(center, center, triangle.mesh.vertices[triangle.indices[1]]);
        vec3.add(center, center, triangle.mesh.vertices[triangle.indices[2]]);
        vec3.scale(center, center, 1 / 3);
        triangleCenterCache.set(triangle, center);
    }

    vec3.copy(centerOutput, triangleCenterCache.get(triangle));
};

const getNodeExtent = (node: Node): Extent => {
    switch (node.type) {
        case NodeType.Branch:
            return node.extent;
        case NodeType.Leaf:
            return EXTENT_NORMALS.map((normal) =>
                extentForNormal(normal, [node.triangle])
            );
    }
};

const combineExtents = (a: Extent, b: Extent) => {
    const combined = [];

    for (let i = 0; i < a.length; i++) {
        const currentA = a[i];
        const currentB = b[i];

        combined.push({
            near: Math.min(currentA.near, currentB.near),
            far: Math.max(currentA.far, currentB.far),
        });
    }

    return combined;
};

class Octree {
    center: vec3;
    side: number;

    children:
        | { type: NodeType.Leaf; triangles: MeshTriangle[] }
        | { type: NodeType.Branch; branches: Octree[] };

    constructor(center: vec3, side: number) {
        this.center = center;
        this.side = side;

        this.children = {
            type: NodeType.Leaf,
            triangles: [],
        };
    }

    private indexToOffset(outputOffset: vec3, index: number) {
        const x = index & 1;
        const y = (index >> 1) & 1;
        const z = (index >> 2) & 1;

        vec3.set(outputOffset, x, y, z);
    }

    private offsetToIndex(offset: vec3) {
        return offset[0] | (offset[1] << 1) | (offset[2] << 2);
    }

    private positionToOffset(outputOffset: vec3, position: vec3) {
        vec3.sub(outputOffset, this.center, position);

        vec3.set(
            outputOffset,
            Number(outputOffset[0] >= 0),
            Number(outputOffset[1] >= 0),
            Number(outputOffset[2] >= 0)
        );
    }

    insert(triangle: MeshTriangle, depth = 0) {
        let values = [];

        if (this.children.type === NodeType.Leaf) {
            if (this.children.triangles.length === 0 || depth >= 16) {
                this.children.triangles.push(triangle);
                return;
            }

            values = this.children.triangles;

            this.children = { type: NodeType.Branch, branches: [] };

            const firstChildCenter = vec3.create();
            vec3.sub(firstChildCenter, this.center, [
                this.side / 4,
                this.side / 4,
                this.side / 4,
            ]);

            const offset = vec3.create();

            for (let i = 0; i < 8; i++) {
                this.indexToOffset(offset, i);
                vec3.mul(offset, offset, [
                    this.side / 2,
                    this.side / 2,
                    this.side / 2,
                ]);
                vec3.add(offset, offset, firstChildCenter);
                this.children.branches.push(
                    new Octree(vec3.clone(offset), this.side / 2)
                );
            }
        }

        values.push(triangle);

        const offset = vec3.create();
        const center = vec3.create();
        for (let value of values) {
            getTriangleCenter(center, value);
            this.positionToOffset(offset, center);
            const index = this.offsetToIndex(offset);
            this.children.branches[index].insert(value, depth + 1);
        }
    }

    toBVH(): Node {
        switch (this.children.type) {
            case NodeType.Leaf: {
                const triangles = this.children.triangles;
                const children = [];
                for (let triangle of triangles) {
                    children.push({
                        type: NodeType.Leaf,
                        triangle,
                    });
                }

                if (children.length === 0) {
                    return null;
                }

                if (children.length === 1) {
                    return children[0];
                }

                const extent = EXTENT_NORMALS.map((normal) =>
                    extentForNormal(normal, triangles)
                );

                return {
                    type: NodeType.Branch,
                    extent,
                    children,
                };
            }
            case NodeType.Branch: {
                const children = this.children.branches
                    .map((branch) => branch.toBVH())
                    .filter((node) => node !== null);

                if (children.length === 0) {
                    return null;
                }

                if (children.length === 1) {
                    return children[0];
                }

                let extent = getNodeExtent(children[0]);

                for (let node of children) {
                    extent = combineExtents(extent, getNodeExtent(node));
                }

                return {
                    type: NodeType.Branch,
                    extent,
                    children,
                };
            }
        }
    }
}

const extentForNormal = (normal: vec3, triangles: MeshTriangle[]): Slab => {
    const first = triangles[0].mesh.vertices[0];
    let near = vec3.dot(first, normal);
    let far = near;

    for (let triangle of triangles) {
        for (let index of triangle.indices) {
            const vertex = triangle.mesh.vertices[index];
            const projected = vec3.dot(vertex, normal);

            if (projected < near) near = projected;
            if (projected > far) far = projected;
        }
    }

    return { near, far };
};

export default class BVH {
    private root: Node;

    constructor(triangles: MeshTriangle[]) {
        const x = extentForNormal(EXTENT_NORMALS[0], triangles);
        const y = extentForNormal(EXTENT_NORMALS[1], triangles);
        const z = extentForNormal(EXTENT_NORMALS[2], triangles);

        const dims = vec3.create();
        vec3.set(dims, x.far - x.near, y.far - y.near, z.far - z.near);

        const side = Math.max(dims[0], dims[1], dims[2]);

        const center = vec3.create();
        vec3.set(center, x.far + x.near, y.far + y.near, z.far + z.near);
        vec3.scale(center, center, 0.5);

        console.log('starting to build');

        const octree = new Octree(center, side);
        let i = 0;
        for (let triangle of triangles) {
            i++;
            octree.insert(triangle);
        }

        console.log('hi,', i, 'triangles');

        this.root = octree.toBVH();

        console.log(JSON.stringify(blavh(this.root), null, 4));
    }
}

const blavh = (node: Node) => {
    switch (node.type) {
        case NodeType.Leaf:
            return {
                type: NodeType.Leaf,
                triangle: [
                    node.triangle.mesh.vertices[node.triangle.indices[0]],
                    node.triangle.mesh.vertices[node.triangle.indices[1]],
                    node.triangle.mesh.vertices[node.triangle.indices[2]],
                ],
            };
        case NodeType.Branch:
            return {
                type: NodeType.Branch,
                extent: node.extent,
                children: node.children.map(blavh),
            };
    }
};
