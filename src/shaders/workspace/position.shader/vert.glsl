precision mediump float;

attribute vec4 aVertexPosition;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying highp vec3 vWorldPosition;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vWorldPosition = vec3(aVertexPosition); // IMPORTANT: this is actually model * pos, but since we aren't transforming the model matrix it's the same as model coordinates
}