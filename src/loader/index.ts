import { srgbToRgb } from "../color";
import parseExr from "./exr";
import { getHDRImage } from "./hdr";
import Image, { ImageFormat, ImageStorage } from "./image";
import Asset, { AssetType } from './asset';
import parseTiff from "./tiff";
import parseWaveformObj from "./obj";

const getExtension = (path: string) => {
    const parts = path.split('.');
    return parts[parts.length - 1];
};

const loaders: { [extension: string]: (data: ArrayBuffer) => Promise<Asset> } = {
    "exr": parseExr,
    "hdr": getHDRImage,
    "tiff": parseTiff,
    "obj": parseWaveformObj
};

const loadImageDOM = (url: string): Promise<Image> => new Promise((resolve, reject) => {
    // parse image file
    // we have to use Canvas as an intermediary
    const tempImg = document.createElement('img');

    tempImg.addEventListener('load', () => {
        if (tempImg.width === 0 && tempImg.height === 0) {
            reject(new Error("image failed to load or is empty"));
        }
        try {
            const scratchCanvas = document.createElement('canvas');
            scratchCanvas.width = tempImg.width;
            scratchCanvas.height = tempImg.height;
            const scratchContext = scratchCanvas.getContext('2d');
            scratchContext.drawImage(tempImg, 0, 0);
            const imageData = scratchContext.getImageData(
                0,
                0,
                tempImg.width,
                tempImg.height
            );

            const image: Image = {
                width: imageData.width,
                height: imageData.height,
                format: ImageFormat.RGB,
                storage: {
                    type: ImageStorage.Uint8,
                    pixels: imageData.data.map(u => srgbToRgb(u / 255) * 255) // assume all images loaded by the browser are in sRGB
                }
            };

            resolve(image);
        } catch (e) {
            reject(e);
        }
    });

    tempImg.addEventListener('error', e => reject(e.error));

    tempImg.src = url;
});

const loadAssetFromURLNoCache = async (url: string): Promise<Asset> => {
    const extension = getExtension(url);

    if (loaders.hasOwnProperty(extension)) {
        const response = await fetch(url);
        const data = await response.arrayBuffer();

        return loaders[extension](data);
    }

    console.log('no registered loaders, trying to load as <img>');

    const image = await loadImageDOM(url);
    return {
        type: AssetType.Image,
        image
    };
};

const cache: { [identifier: string]: Asset } = {};

export async function loadAssetFromURL(url: string): Promise<Asset> {
    const urlIdentifier = `url:${url}`;

    if (cache.hasOwnProperty(urlIdentifier)) {
        return cache[urlIdentifier]
    }
    
    cache[urlIdentifier] = await loadAssetFromURLNoCache(url);

    return cache[urlIdentifier];
};

export async function loadAssetFromBlob(name: string, blob: Blob): Promise<Asset> {
    console.log('trying to load', name);
    const extension = getExtension(name);

    if (loaders.hasOwnProperty(extension)) {
        const data = await blob.arrayBuffer();
        return loaders[extension](data);
    }

    const url = URL.createObjectURL(blob);
    try {
        const image = await loadImageDOM(url);

        return {
            type: AssetType.Image,
            image
        };
    } catch (e) {
        throw new Error(`Couldn't load .${extension} file through the DOM`)
    } finally {
        URL.revokeObjectURL(url);
    }
}