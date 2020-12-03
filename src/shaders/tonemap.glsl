const float exposure = 1.0;

vec3 tonemap(vec3 hdrColor) {
    const float gamma = 2.2;

    // exposure tone mapping
    vec3 mapped = vec3(1.0) - exp(-hdrColor * exposure);
    // gamma correction
    return pow(mapped, vec3(1.0 / gamma));
}

#pragma glslify: export(tonemap)