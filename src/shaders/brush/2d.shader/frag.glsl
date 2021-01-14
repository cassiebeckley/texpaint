precision mediump float;

uniform bool uSoft;

varying highp vec2 vTextureCoord;
varying float vPixelWidth;

void main() {
    float mask = 0.0;
    
    if (!uSoft) {
        mask = smoothstep(0.5, 0.5 + vPixelWidth * 2.0, 1.0 - length(vTextureCoord - 0.5));
    } else {
        float linear = clamp(1.0 - length(vTextureCoord - 0.5) * 2.0, 0.0, 1.0);
        mask = linear * linear;
    }

    gl_FragColor = vec4(mask);
}