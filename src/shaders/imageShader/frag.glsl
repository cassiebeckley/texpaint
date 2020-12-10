#pragma glslify: rgb_to_srgb = require(../color/rgb_to_srgb)

precision mediump float;

varying highp vec2 vTextureCoord;

uniform sampler2D uSampler;

#define PI 3.1415926538

vec4 equirectangular(sampler2D tex, vec3 direction) {
    float x = (1.0 + atan(direction.z, direction.x) / PI) / 2.0;
    float y = acos(direction.y) / PI;
    vec2 coord = vec2(x, y);
    return texture2D(tex, coord);
}

void main() {
    gl_FragColor = texture2D(uSampler, vTextureCoord);
    gl_FragColor.rgb = rgb_to_srgb(gl_FragColor.rgb);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}