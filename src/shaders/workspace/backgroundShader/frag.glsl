#pragma glslify: rgb_to_srgb = require(../../color/rgb_to_srgb)

precision mediump float;

varying vec3 vPosition;

uniform samplerCube uSkybox;

void main() {
    vec3 direction = normalize(vPosition);

    gl_FragColor = textureCube(uSkybox, direction);
    gl_FragColor.rgb = rgb_to_srgb(gl_FragColor.rgb);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}