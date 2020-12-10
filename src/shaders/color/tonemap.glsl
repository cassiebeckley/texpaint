#pragma glslify: rgb_to_srgb = require('~/src/shaders/color/rgb_to_srgb.glsl')

precision mediump float;

// TODO: see if we can use Open Color IO for this

// approximation of ACES LUT
// adapted from https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 ACESInput = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutput = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602)
);

vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

vec3 tonemap(vec3 hdrColor) {
    vec3 color = ACESInput * hdrColor;
    color = RRTAndODTFit(color);
    color = ACESOutput * color;

    color = rgb_to_srgb(color);

    return color;
}

#pragma glslify: export(tonemap)