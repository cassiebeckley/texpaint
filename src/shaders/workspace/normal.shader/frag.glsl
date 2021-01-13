precision mediump float;

varying highp vec3 vVertexNormal;

void main() {
    gl_FragColor.rgb = (vVertexNormal + 1.0) / 2.0;
    gl_FragColor.a = 1.0;
}