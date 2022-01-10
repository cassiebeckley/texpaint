#version 300 es
precision mediump float;

in vec4 aVertexPosition;
in vec2 aTextureCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform int uTextureWidth;
uniform int uTextureHeight;

out vec3 vWorldPosition;
out float vPixelWidth;

void main() {
    vec2 position = aTextureCoord * vec2(uTextureWidth, uTextureHeight);

    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(position, 0.0, 1.0);
    vWorldPosition = vec3(aVertexPosition); // IMPORTANT: this is actually model * pos, but since we aren't transforming the model matrix it's the same as model coordinates

    vPixelWidth = 1.0 / float(uTextureWidth);
}