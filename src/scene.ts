import MeshData from './loader/meshData';
import RenderMesh from './renderMesh';
import MaterialSlate from './materialSlate';
import Compositor from './compositor';
import Brush from './brush';
import BVH from './bvh';
import { vec3 } from 'gl-matrix';

export default class Scene {
    gl: WebGL2RenderingContext;
    brush: Brush;

    size: number;
    compositor: Compositor;

    materials: Map<string, MaterialSlate>;
    meshes: RenderMesh[];
    bvh: BVH;

    constructor(
        gl: WebGL2RenderingContext,
        size: number,
        compositor: Compositor
    ) {
        this.gl = gl;
        this.brush = new Brush(gl);

        this.size = size;
        this.compositor = compositor;

        this.materials = new Map();
        this.meshes = [];
    }

    setMeshes(meshes: MeshData[]) {
        this.meshes = [];
        const triangles = [];

        for (let meshData of meshes) {
            this.addMaterial(meshData.materialId);
            this.meshes.push(new RenderMesh(this.gl, meshData));

            for (let triangle of meshData.triangles) {
                triangles.push({
                    mesh: meshData,
                    indices: triangle,
                });
            }
        }

        this.bvh = new BVH(triangles);
    }

    addMaterial(materialId: string) {
        if (this.materials.has(materialId)) {
            return;
        }

        const slate = new MaterialSlate(
            this.gl,
            this.brush,
            this.size,
            materialId,
            this.compositor
        );
        this.materials.set(materialId, slate);

        return slate;
    }

    getMaterialList() {
        return Array.from(this.materials.keys());
    }

    raycast(point: vec3, normal: vec3, origin: vec3, direction: vec3) {
        let closest = Infinity;

        for (let i = 0; i < this.meshes.length; i++) {
            const currentPoint = vec3.create();
            const currentNormal = vec3.create();

            const intersection = this.meshes[i].data.raycast(
                currentPoint,
                currentNormal,
                origin,
                direction
            );

            if (intersection > 0 && intersection < closest) {
                closest = intersection;
                vec3.copy(point, currentPoint);
                vec3.copy(normal, currentNormal);
            }
        }

        return closest;
    }
}
