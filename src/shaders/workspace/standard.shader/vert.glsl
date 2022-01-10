#version 300 es
precision mediump float;

in vec4 aVertexPosition;
in vec2 aTextureCoord;
in vec3 aVertexNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out highp vec2 vTextureCoord;
out highp vec3 vVertexNormal;

out highp vec3 vWorldPosition;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vTextureCoord = aTextureCoord;
    vVertexNormal = aVertexNormal;
    vWorldPosition = vec3(aVertexPosition); // IMPORTANT: this is actually model * pos, but since we aren't transforming the model matrix it's the same as model coordinates
}