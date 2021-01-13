precision mediump float;

varying vec3 vWorldPosition;
varying float vPixelWidth;

uniform vec3 uCenter;
uniform float uRadius;

void main() {
    // float mask = 1.0 - step(uRadius, length(uCenter - vWorldPosition));
    float mask = 1.0 - smoothstep(uRadius, uRadius + vPixelWidth * 2.0, length(uCenter - vWorldPosition));
    gl_FragColor = vec4(mask);
}