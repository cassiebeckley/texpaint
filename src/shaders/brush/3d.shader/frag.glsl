#version 300 es
precision mediump float;

in vec3 vWorldPosition;
in float vPixelWidth;

out vec4 color;

uniform vec3 uCenter;
uniform float uRadius;

uniform bool uSoft;

void main() {
    float mask = 0.0;

    float distance = length(uCenter - vWorldPosition);

    if (!uSoft) {
        mask = 1.0 - smoothstep(uRadius, uRadius + vPixelWidth * 2.0, distance);
    } else {
        float linear = clamp(1.0 - (distance / uRadius), 0.0, 1.0);
        mask = linear * linear;
    }

    color = vec4(mask);
}