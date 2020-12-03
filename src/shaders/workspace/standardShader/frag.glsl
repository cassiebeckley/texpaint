precision mediump float;

varying highp vec2 vTextureCoord;
varying highp vec3 vVertexNormal;

uniform sampler2D uSampler;
uniform sampler2D uBackground;

const highp vec3 lightDir = normalize(vec3(1.0, 0.8, 0.1));
const vec3 lightColor = vec3(0.8, 0.8, 0.8);
const vec3 ambient = vec3(0.2, 0.2, 0.2);

#pragma glslify: tonemap = require(../../tonemap.glsl)

#define PI 3.1415926538

vec4 equirectangular(sampler2D tex, vec3 direction) {
    float x = (1.0 + atan(direction.z, direction.x) / PI) / 2.0;
    float y = acos(direction.y) / PI;
    vec2 coord = vec2(x, y);
    return texture2D(tex, coord);
}

void main() {
    vec2 coord = vTextureCoord;
    coord.y = 1.0 - coord.y; // TODO: figure out if this should be done in the loader

    vec3 color = texture2D(uSampler, coord).rgb;

    highp vec3 normal = normalize(vVertexNormal);
    float luminance = clamp(dot(normal, lightDir), 0.0, 1.0);
    vec3 light = lightColor * luminance;

    vec3 diffuse = vec3(0, 0, 0);

    const int cbrt_samples = 12;

    for (int i = 0; i < cbrt_samples; i++) {
        for (int j = 0; j < cbrt_samples; j++) {
            for (int k = 0; k < cbrt_samples; k++) {
                vec3 ray = normalize(vec3((float(i) + 0.5) / float(cbrt_samples), vec3((float(j) + 0.5) / float(cbrt_samples), vec3((float(k) + 0.5) / float(cbrt_samples)))));

                ray *= sign(dot(ray, normal));

                diffuse += equirectangular(uBackground, ray).xyz;
            }
        }
    }

    diffuse /= float(cbrt_samples * cbrt_samples * cbrt_samples);

    // gl_FragColor.rgb = color * light + color * ambient;
    gl_FragColor.rgb = tonemap(color * diffuse);
    gl_FragColor.a = 1.0;
}