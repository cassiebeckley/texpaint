import Module from './wasm/wrap_openexr';
import m_Url from 'url:./wasm/wrap_openexr.wasm';
import Image, { ImageFormat, ImageStorage } from '../image';
import Asset, { AssetType } from '../asset';

let instance = null;
const getInstance = async () => {
    if (instance) {
        return instance;
    }

    instance = Module({ locateFile: () => m_Url });
    return instance;
}

export default async function parseExr(data: ArrayBuffer): Promise<Asset> {
    const openexr = await getInstance();

    const exr = new openexr.EXRLoader(data);

    const width = exr.width();
    const height = exr.height();

    const imageBuffer: Float32Array = exr.getBytes().slice(0);
    // It might be better to leave this in WASM memory space rather than cloning
    // would need to remove the delete below

    exr.delete(); // free memory

    const image: Image = {
        width,
        height,
        format: ImageFormat.RGBA,
        storage: {
            type: ImageStorage.Float32,
            pixels: imageBuffer,
        }
    };

    return {
        type: AssetType.Image,
        image
    };
};