#version 300 es
precision mediump float;

out vec4 color;

void main() {
    color = vec4(0, 0, 0, 0.5);
    color.rgb *= color.a; // premultiply alpha
}