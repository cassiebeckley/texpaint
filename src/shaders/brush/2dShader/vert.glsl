precision mediump float;

attribute vec4 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying highp vec2 vTextureCoord;
// varying float vPixelWidth;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vTextureCoord = aTextureCoord;

    // vPixelWidth = 1.0 - (uProjectionMatrix * vec4(0.0, 1.0, 0.0, 1.0)).y;
}