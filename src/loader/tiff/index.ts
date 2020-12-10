import Module from './wasm/wrap_libtiff';
import m_Url from 'url:./wasm/wrap_libtiff.wasm';
import Asset, { AssetType } from '../asset';
import Image, { ImageFormat, ImageStorage } from '../image';
import { srgbToRgb } from '../../color';

let instance = null;
const getInstance = async () => {
    if (instance) {
        return instance;
    }

    instance = Module({ locateFile: () => m_Url });
    return instance;
}

export default async function parseTiff(data: ArrayBuffer): Promise<Asset> {
    const libtiff = await getInstance();

    const tiff = new libtiff.TIFFLoader(data);
    if (!tiff.ok()) {
        throw new Error("couldn't load TIFF");
    }

    const width = tiff.width();
    const height = tiff.height();

    const imageBufferPacked: Uint32Array = tiff.getBytes();
    const imageBuffer = new Uint8ClampedArray(width * height * 4);

    let destIndex = 0;

    for (let i = 0; i < imageBufferPacked.length; i++) {
        const pixel = imageBufferPacked[i];
        const r = pixel & 0xff;
        const g = (pixel >> 8) & 0xff;
        const b = (pixel >> 16) & 0xff;
        const a = (pixel >> 24) & 0xff;

        imageBuffer[destIndex++] = 255 * srgbToRgb(r / 255); // assume sRGB 
        imageBuffer[destIndex++] = 255 * srgbToRgb(g / 255);
        imageBuffer[destIndex++] = 255 * srgbToRgb(b / 255);
        imageBuffer[destIndex++] = 255 * srgbToRgb(a / 255);
    }

    const image: Image = {
        width,
        height,
        format: ImageFormat.RGBA,
        storage: {
            type: ImageStorage.Uint8,
            pixels: imageBuffer,
        }
    };

    return {
        type: AssetType.Image,
        image
    };
};