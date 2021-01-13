precision mediump float;

attribute vec4 aVertexPosition;
attribute vec2 aTextureCoord;
attribute float aBrushRadius;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying highp vec2 vTextureCoord;
varying float vPixelWidth;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vTextureCoord = aTextureCoord;

    vPixelWidth = 1.0 / (aBrushRadius * 2.0);
}