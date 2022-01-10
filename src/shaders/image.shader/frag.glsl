#version 300 es
#pragma glslify: rgb_to_srgb = require(../color/rgb_to_srgb)

precision mediump float;

in highp vec2 vTextureCoord;

out vec4 color;

uniform sampler2D uSampler;

void main() {
    color = texture(uSampler, vTextureCoord);
    color.rgb = rgb_to_srgb(color.rgb);
    color.rgb *= color.a; // premultiply alpha
}