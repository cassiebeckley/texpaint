precision mediump float;

vec3 srgb_to_rgb(vec3 srgb)
{
    bvec3 cutoff = lessThan(srgb, vec3(0.04045));
    vec3 higher = pow((srgb + vec3(0.055))/vec3(1.055), vec3(2.4));
    vec3 lower = srgb/vec3(12.92);

    return mix(higher, lower, vec3(cutoff));
}

#pragma glslify: export(srgb_to_rgb)