precision mediump float;

#pragma glslify: XYZ_2_AP1_MAT = require('~/src/shaders/color/aces/xyz_2_ap1_mat')
#pragma glslify: AP0_2_XYZ_MAT = require('~/src/shaders/color/aces/ap0_2_xyz_mat')

const mat3 AP0_2_AP1_MAT = XYZ_2_AP1_MAT * AP0_2_XYZ_MAT;

#pragma glslify: export(AP0_2_AP1_MAT)