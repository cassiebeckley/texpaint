precision mediump float;

#pragma glslify: XYZ_2_AP0_MAT = require('~/src/shaders/color/aces/xyz_2_ap0_mat')
#pragma glslify: AP1_2_XYZ_MAT = require('~/src/shaders/color/aces/ap1_2_xyz_mat')

const mat3 AP1_2_AP0_MAT = XYZ_2_AP0_MAT * AP1_2_XYZ_MAT;

#pragma glslify: export(AP1_2_AP0_MAT)