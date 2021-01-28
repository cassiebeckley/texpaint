import { vec3 } from 'gl-matrix';
import { srgbToRgb } from './color';
import { fillTexture } from './compositor';

const DEFAULT_ROUGHNESS = 0.5;
const DEFAULT_METALLIC = 0.0;

export default class Brush {
    gl: WebGLRenderingContext;

    albedoTexture: WebGLTexture;
    roughnessTexture: WebGLTexture;
    metallicTexture: WebGLTexture;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;

        this.albedoTexture = gl.createTexture();
        this.roughnessTexture = gl.createTexture();
        this.metallicTexture = gl.createTexture();

        this.color = vec3.create();
        this.roughness = DEFAULT_ROUGHNESS;
        this.metallic = DEFAULT_METALLIC;
    }

    set color(sRgb: vec3) {
        const [r, g, b] = sRgb.map(srgbToRgb);
        fillTexture(
            this.gl,
            this.albedoTexture,
            1,
            1,
            new Uint8ClampedArray([r * 255, g * 255, b * 255, 255])
        );
    }

    set roughness(roughness: number) {
        const roughnessByte = roughness * 255;
        fillTexture(
            this.gl,
            this.roughnessTexture,
            1,
            1,
            new Uint8ClampedArray([
                roughnessByte,
                roughnessByte,
                roughnessByte,
                255,
            ])
        );
    }

    set metallic(metallic: number) {
        const metallicByte = metallic * 255;
        fillTexture(
            this.gl,
            this.metallicTexture,
            1,
            1,
            new Uint8ClampedArray([
                metallicByte,
                metallicByte,
                metallicByte,
                255,
            ])
        );
    }
}
