import MeshData from './loader/meshData';
import Mesh from './mesh';
import MaterialSlate from './materialSlate';
import Compositor from './compositor';
import Brush from './brush';

export default class Scene {
    gl: WebGLRenderingContext;
    brush: Brush;

    size: number;
    compositor: Compositor;

    materials: Map<string, MaterialSlate>;
    meshes: Mesh[];

    constructor(
        gl: WebGLRenderingContext,
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

    addMeshes(meshes: MeshData[]) {
        for (let meshData of meshes) {
            this.addMaterial(meshData.materialId);
            this.meshes.push(new Mesh(this.gl, meshData));
        }
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
}
