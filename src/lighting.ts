import brdf_lut_url from 'url:./assets/brdf_smith_schlick_ggx.exr';

import irradiance0 from 'url:./assets/backgrounds/forest_slope/irradiance0.exr';
import irradiance1 from 'url:./assets/backgrounds/forest_slope/irradiance1.exr';
import irradiance2 from 'url:./assets/backgrounds/forest_slope/irradiance2.exr';
import irradiance3 from 'url:./assets/backgrounds/forest_slope/irradiance3.exr';
import irradiance4 from 'url:./assets/backgrounds/forest_slope/irradiance4.exr';
import irradiance5 from 'url:./assets/backgrounds/forest_slope/irradiance5.exr';

import prefiltered_roughness0_0__0 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_0-0.exr';
import prefiltered_roughness0_0__1 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_0-1.exr';
import prefiltered_roughness0_0__2 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_0-2.exr';
import prefiltered_roughness0_0__3 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_0-3.exr';
import prefiltered_roughness0_0__4 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_0-4.exr';
import prefiltered_roughness0_0__5 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_0-5.exr';

import prefiltered_roughness0_2__0 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_2-0.exr';
import prefiltered_roughness0_2__1 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_2-1.exr';
import prefiltered_roughness0_2__2 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_2-2.exr';
import prefiltered_roughness0_2__3 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_2-3.exr';
import prefiltered_roughness0_2__4 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_2-4.exr';
import prefiltered_roughness0_2__5 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_2-5.exr';

import prefiltered_roughness0_5__0 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_5-0.exr';
import prefiltered_roughness0_5__1 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_5-1.exr';
import prefiltered_roughness0_5__2 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_5-2.exr';
import prefiltered_roughness0_5__3 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_5-3.exr';
import prefiltered_roughness0_5__4 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_5-4.exr';
import prefiltered_roughness0_5__5 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_5-5.exr';

import prefiltered_roughness0_7__0 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_7-0.exr';
import prefiltered_roughness0_7__1 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_7-1.exr';
import prefiltered_roughness0_7__2 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_7-2.exr';
import prefiltered_roughness0_7__3 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_7-3.exr';
import prefiltered_roughness0_7__4 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_7-4.exr';
import prefiltered_roughness0_7__5 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness0_7-5.exr';

import prefiltered_roughness1_0__0 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness1_0-0.exr';
import prefiltered_roughness1_0__1 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness1_0-1.exr';
import prefiltered_roughness1_0__2 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness1_0-2.exr';
import prefiltered_roughness1_0__3 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness1_0-3.exr';
import prefiltered_roughness1_0__4 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness1_0-4.exr';
import prefiltered_roughness1_0__5 from 'url:./assets/backgrounds/forest_slope/prefiltered_roughness1_0-5.exr';

import skybox0 from 'url:./assets/backgrounds/forest_slope/skybox0.png';
import skybox1 from 'url:./assets/backgrounds/forest_slope/skybox1.png';
import skybox2 from 'url:./assets/backgrounds/forest_slope/skybox2.png';
import skybox3 from 'url:./assets/backgrounds/forest_slope/skybox3.png';
import skybox4 from 'url:./assets/backgrounds/forest_slope/skybox4.png';
import skybox5 from 'url:./assets/backgrounds/forest_slope/skybox5.png';
import { AssetType } from './loader/asset';
import { ImageStorage } from './loader/image';
import { loadTextureFromImage } from './windowManager';
import { loadAssetFromURL } from './loader';

export default class Lighting {
    loaded: boolean;
    gl: WebGL2RenderingContext;

    skyboxTexture: WebGLTexture;
    brdfTexture: WebGLTexture;
    irradianceTexture: WebGLTexture;
    prefilteredTextures: WebGLTexture[];

    constructor(gl: WebGL2RenderingContext) {
        // TODO: take irradiance and prefiltered environment maps as parameters
        this.loaded = false;
        this.gl = gl;

        this.skyboxTexture = gl.createTexture();
        this.brdfTexture = gl.createTexture();
        this.irradianceTexture = gl.createTexture();
        this.prefilteredTextures = [1, 2, 3, 4, 5].map((_) =>
            gl.createTexture()
        );
    }

    async load() {
        const gl = this.gl;
        let brdf_lut = await loadAssetFromURL(brdf_lut_url);

        let skyboxFaces = await Promise.all(
            [skybox0, skybox1, skybox2, skybox3, skybox4, skybox5].map((url) =>
                loadAssetFromURL(url)
            )
        );
        let irradianceFaces = await Promise.all(
            [
                irradiance0,
                irradiance1,
                irradiance2,
                irradiance3,
                irradiance4,
                irradiance5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_0Faces = await Promise.all(
            [
                prefiltered_roughness0_0__0,
                prefiltered_roughness0_0__1,
                prefiltered_roughness0_0__2,
                prefiltered_roughness0_0__3,
                prefiltered_roughness0_0__4,
                prefiltered_roughness0_0__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_2Faces = await Promise.all(
            [
                prefiltered_roughness0_2__0,
                prefiltered_roughness0_2__1,
                prefiltered_roughness0_2__2,
                prefiltered_roughness0_2__3,
                prefiltered_roughness0_2__4,
                prefiltered_roughness0_2__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_5Faces = await Promise.all(
            [
                prefiltered_roughness0_5__0,
                prefiltered_roughness0_5__1,
                prefiltered_roughness0_5__2,
                prefiltered_roughness0_5__3,
                prefiltered_roughness0_5__4,
                prefiltered_roughness0_5__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness0_7Faces = await Promise.all(
            [
                prefiltered_roughness0_7__0,
                prefiltered_roughness0_7__1,
                prefiltered_roughness0_7__2,
                prefiltered_roughness0_7__3,
                prefiltered_roughness0_7__4,
                prefiltered_roughness0_7__5,
            ].map((url) => loadAssetFromURL(url))
        );
        let prefiltered_roughness1_0Faces = await Promise.all(
            [
                prefiltered_roughness1_0__0,
                prefiltered_roughness1_0__1,
                prefiltered_roughness1_0__2,
                prefiltered_roughness1_0__3,
                prefiltered_roughness1_0__4,
                prefiltered_roughness1_0__5,
            ].map((url) => loadAssetFromURL(url))
        );
        console.log('loaded background');

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxTexture);

        let sides = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        ];

        for (let i = 0; i < skyboxFaces.length; i++) {
            let face = skyboxFaces[i];
            if (face.type !== AssetType.Image) {
                throw new Error('need image');
            }

            let image = face.image;

            if (image.storage.type != ImageStorage.Uint8) {
                throw new Error('skybox should be SDR');
            }

            let pixels = image.storage.pixels;

            const level = 0;
            const internalFormat = gl.RGBA;
            const format = gl.RGBA;
            const type = gl.UNSIGNED_BYTE;
            gl.texImage2D(
                sides[i],
                level,
                internalFormat,
                image.width,
                image.height,
                0,
                format,
                type,
                pixels
            );
        }

        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.irradianceTexture);

        for (let i = 0; i < irradianceFaces.length; i++) {
            let face = irradianceFaces[i];
            if (face.type !== AssetType.Image) {
                throw new Error('need image');
            }

            let image = face.image;

            if (image.storage.type != ImageStorage.Float32) {
                throw new Error('irradiance should be HDR');
            }

            let pixels = image.storage.pixels;

            const level = 0;
            const internalFormat = gl.RGBA32F;
            const format = gl.RGBA;
            const type = gl.FLOAT;
            gl.texImage2D(
                sides[i],
                level,
                internalFormat,
                image.width,
                image.height,
                0,
                format,
                type,
                pixels
            );
        }

        gl.texParameteri(
            gl.TEXTURE_CUBE_MAP,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR
        );
        gl.texParameteri(
            gl.TEXTURE_CUBE_MAP,
            gl.TEXTURE_MAG_FILTER,
            gl.LINEAR
        );

        if (brdf_lut.type != AssetType.Image) {
            throw new Error('BRDF must be an image');
        }
        loadTextureFromImage(gl, this.brdfTexture, brdf_lut.image);

        let prefilteredLevels = [
            prefiltered_roughness0_0Faces,
            prefiltered_roughness0_2Faces,
            prefiltered_roughness0_5Faces,
            prefiltered_roughness0_7Faces,
            prefiltered_roughness1_0Faces,
        ];

        for (let level = 0; level < prefilteredLevels.length; level++) {
            gl.bindTexture(
                gl.TEXTURE_CUBE_MAP,
                this.prefilteredTextures[level]
            );

            let prefilteredFaces = prefilteredLevels[level];
            for (let i = 0; i < prefilteredFaces.length; i++) {
                let face = prefilteredFaces[i];
                if (face.type != AssetType.Image) {
                    throw new Error('need image');
                }

                let image = face.image;

                if (image.storage.type != ImageStorage.Float32) {
                    throw new Error('prefiltered environment should be HDR');
                }

                let pixels = image.storage.pixels;

                const mipLevel = 0;
                const internalFormat = gl.RGBA32F;
                const format = gl.RGBA;
                const type = gl.FLOAT;
                gl.texImage2D(
                    sides[i],
                    mipLevel,
                    internalFormat,
                    image.width,
                    image.height,
                    0,
                    format,
                    type,
                    pixels
                );
            }

            // TODO: almost certainly need to store different prefilter levels as mip livels and use mip linear lookup
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_MIN_FILTER,
                gl.LINEAR
            );
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_MAG_FILTER,
                gl.LINEAR
            );
        }

        this.loaded = true;
    }
}
