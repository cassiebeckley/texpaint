precision mediump float;

varying highp vec3 vWorldPosition;

void main() {
    gl_FragColor.rgb = vWorldPosition;
    gl_FragColor.a = 1.0;
}