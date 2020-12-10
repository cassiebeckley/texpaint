precision mediump float;

#pragma glslify: AP1_2_XYZ_MAT = require('~/src/shaders/color/aces/ap1_2_xyz_mat')

const vec3 AP1_RGB2Y = vec3(
    AP1_2_XYZ_MAT[0][1],
    AP1_2_XYZ_MAT[1][1],
    AP1_2_XYZ_MAT[2][1]
);

#pragma glslify: export(AP1_RGB2Y)