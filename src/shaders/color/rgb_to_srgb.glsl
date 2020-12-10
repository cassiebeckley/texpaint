precision mediump float;

vec3 rgb_to_srgb(vec3 rgb) {
    bvec3 cutoff = lessThan(rgb, vec3(0.0031308));
    vec3 higher = vec3(1.055)*pow(rgb, vec3(1.0/2.4)) - vec3(0.055);
    vec3 lower = rgb * vec3(12.92);

    return mix(higher, lower, vec3(cutoff));
}

#pragma glslify: export(rgb_to_srgb)