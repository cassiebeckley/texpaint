import { vec3 } from 'gl-matrix';

export function hsvToRgb(hsv: vec3): vec3 {
    function hsvToRgbF(hsv: vec3, n: number) {
        const h = hsv[0];
        const s = hsv[1];
        const v = hsv[2];

        const k = (n + h / 60.0) % 6.0;
        return v - v * s * Math.max(0.0, Math.min(k, 4.0 - k, 1.0));
    }

    const rgb = vec3.create();
    vec3.set(
        rgb,
        hsvToRgbF(hsv, 5.0),
        hsvToRgbF(hsv, 3.0),
        hsvToRgbF(hsv, 1.0)
    );

    return rgb;
}

export function rgbToHsv(rgb: vec3) {
    const hsv = vec3.create();

    const xMin = Math.min(rgb[0], rgb[1], rgb[2]);
    const xMax = Math.max(rgb[0], rgb[1], rgb[2]);

    hsv[2] = xMax;

    const chroma = xMax - xMin;

    if (xMax !== 0) {
        hsv[1] = chroma / xMax;
    } else {
        hsv[1] = 0;
        return hsv;
    }

    if (chroma === 0) {
        hsv[0] = 0;
        return hsv;
    }

    if (rgb[0] === xMax) {
        hsv[0] = rgb[1] - rgb[2] / chroma;
    } else if (rgb[1] === xMax) {
        hsv[0] = 2 + (rgb[2] - rgb[0]) / chroma;
    } else {
        hsv[0] = 4 + (rgb[0] - rgb[1]) / chroma;
    }

    hsv[0] *= 60;
    if (hsv[0] < 0) {
        hsv[0] += 360;
    }

    return hsv;
}
