#version 300 es
#pragma glslify: ODT = require(../color/aces/odt_academy_srgb)

precision mediump float;

in highp vec2 vTextureCoord;

out vec4 color;

uniform sampler2D uSampler;

void main() {
    color = texture(uSampler, vTextureCoord);
    color.rgb = ODT(color.rgb);
    color.rgb *= color.a; // premultiply alpha
}