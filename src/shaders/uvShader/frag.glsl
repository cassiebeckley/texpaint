precision mediump float;

void main() {
    gl_FragColor = vec4(0, 0, 0, 0.5);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}