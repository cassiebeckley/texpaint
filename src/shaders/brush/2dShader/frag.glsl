precision mediump float;

varying highp vec2 vTextureCoord;
// varying float vPixelWidth;

void main() {
    float pixelWidth = 0.025; // TODO: calculate this accurately
    float mask = smoothstep(0.5, 0.5 + pixelWidth * 2.0, 1.0 - length(vTextureCoord - 0.5));
    gl_FragColor = vec4(mask);
}