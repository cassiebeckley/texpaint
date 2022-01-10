#version 300 es
precision mediump float;

uniform bool uSoft;

in highp vec2 vTextureCoord;
in float vPixelWidth;

out vec4 color;

void main() {
    float mask = 0.0;
    
    if (!uSoft) {
        mask = smoothstep(0.5, 0.5 + vPixelWidth * 2.0, 1.0 - length(vTextureCoord - 0.5));
    } else {
        float linear = clamp(1.0 - length(vTextureCoord - 0.5) * 2.0, 0.0, 1.0);
        mask = linear * linear;
    }

    color = vec4(mask);
}