#version 300 es
precision mediump float;

in vec4 aVertexPosition;
in vec2 aTextureCoord;
in float aBrushRadius;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out highp vec2 vTextureCoord;
out float vPixelWidth;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vTextureCoord = aTextureCoord;

    vPixelWidth = 1.0 / (aBrushRadius * 2.0);
}