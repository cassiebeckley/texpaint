#version 300 es
#pragma glslify: rgb_to_srgb = require(../../color/rgb_to_srgb)

precision mediump float;

in vec3 vPosition;

out vec4 color;

uniform samplerCube uSkybox;

void main() {
    vec3 direction = normalize(vPosition);

    color = texture(uSkybox, direction);
    color.rgb = rgb_to_srgb(color.rgb);
    color.rgb *= color.a; // premultiply alpha
}