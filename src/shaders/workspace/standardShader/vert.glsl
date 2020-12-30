precision mediump float;

attribute vec4 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec3 aVertexNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying highp vec2 vTextureCoord;
varying highp vec3 vVertexNormal;

varying highp vec3 vWorldPosition;

// TODO: perhaps calculate lighting in view space

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vTextureCoord = aTextureCoord;
    vVertexNormal = normalize(aVertexNormal); // TODO: possibly not necessary if normalize is set in gl.attribArray
    vWorldPosition = vec3(aVertexPosition); // IMPORTANT: this is actually model * pos, but since we aren't transforming the model matrix it's the same as model coordinates
}