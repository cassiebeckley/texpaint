precision mediump float;

varying highp vec2 vTextureCoord;

uniform sampler2D uSampler;

const float exposure = 1.0;

vec3 tonemap(vec3 hdrColor) {
    const float gamma = 2.2;

    // exposure tone mapping
    vec3 mapped = vec3(1.0) - exp(-hdrColor * exposure);
    // gamma correction
    return pow(mapped, vec3(1.0 / gamma));
}

void main() {
    vec2 coord = vTextureCoord;
    coord.y = 1.0 - coord.y;

    vec4 inputColor = texture2D(uSampler, coord);
    gl_FragColor.rgb = tonemap(inputColor.rgb);
    gl_FragColor.a = inputColor.a;

    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}