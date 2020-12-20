import Module from './wasm/wrap_tinyexr';
import m_Url from 'url:./wasm/wrap_tinyexr.wasm';
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
    const tinyexr = await getInstance();

    const exr = new tinyexr.EXRLoader(data);
    if (!exr.ok()) {
        throw new Error(`couldn't load EXR: ${exr.error()}`);
    }

    const width = exr.width();
    const height = exr.height();

    const imageBuffer: Float32Array = exr.getBytes();

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