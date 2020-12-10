// Textbook monomial to basis-function conversion matrix.
const mat3 M = mat3(
    vec3( 0.5, -1.0, 0.5),
    vec3(-1.0,  1.0, 0.5),
    vec3( 0.5,  0.0, 0.0)
);

#pragma glslify: export(M)