#pragma glslify: tonemap = require(../../tonemap)

precision mediump float;

varying vec3 vPosition;

uniform sampler2D uSampler;

const float backgroundStrength = 1.0; // this probably makes more sense as a shared const or even a uniform

#define PI 3.1415926538

vec4 equirectangular(sampler2D tex, vec3 direction) {
    float x = (1.0 + atan(direction.z, direction.x) / PI) / 2.0;
    float y = acos(direction.y) / PI;
    vec2 coord = vec2(x, y);
    return texture2D(tex, coord);
}

void main() {
    vec3 direction = normalize(vPosition);

    vec2 coord = normalize(vPosition.xy);

    vec3 color = equirectangular(uSampler, direction).rgb * 2.0;

    gl_FragColor = vec4(tonemap(color), 1.0);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}