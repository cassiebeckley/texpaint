import MeshData from './meshData';
import Image from './image';

export enum AssetType {
    Image,
    Mesh,
}

export interface ImageAsset {
    type: AssetType.Image;
    image: Image;
}

export interface MeshAsset {
    type: AssetType.Mesh;
    meshes: MeshData[]; // TODO: better handling for file types that contain multiple assets, ie OBJ with meshes
}

export type Asset = ImageAsset | MeshAsset;
