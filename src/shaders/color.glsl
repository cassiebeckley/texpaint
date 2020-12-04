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

vec3 rgb_to_srgb(vec3 rgb) {
    bvec3 cutoff = lessThan(rgb, vec3(0.0031308));
    vec3 higher = vec3(1.055)*pow(rgb, vec3(1.0/2.4)) - vec3(0.055);
    vec3 lower = rgb * vec3(12.92);

    return mix(higher, lower, vec3(cutoff));
}

vec3 srgb_to_rgb(vec3 srgb)
{
    bvec3 cutoff = lessThan(srgb, vec3(0.04045));
    vec3 higher = pow((srgb + vec3(0.055))/vec3(1.055), vec3(2.4));
    vec3 lower = srgb/vec3(12.92);

    return mix(higher, lower, vec3(cutoff));
}

vec3 tonemap(vec3 hdrColor) {
    vec3 sRgb = rgb_to_srgb(hdrColor);

    vec3 color = ACESInput * sRgb;
    
    color = RRTAndODTFit(color);

    color = ACESOutput * color;

    // return color;
    return clamp(color, 0.0, 1.0);
}