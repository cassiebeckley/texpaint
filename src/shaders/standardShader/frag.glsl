precision mediump float;

varying highp vec2 vTextureCoord;
varying highp vec3 vVertexNormal;

uniform sampler2D uSampler;

const highp vec3 lightDir = normalize(vec3(1.0, 0.8, 0.1));
const vec3 lightColor = vec3(0.8, 0.8, 0.8);
const vec3 ambient = vec3(0.2, 0.2, 0.2);

void main() {
    vec2 coord = vTextureCoord;
    coord.y = 1.0 - coord.y; // TODO: figure out if this should be done in the loader

    vec3 color = texture2D(uSampler, coord).rgb;

    highp vec3 normal = normalize(vVertexNormal);
    float luminance = clamp(dot(normal, lightDir), 0.0, 1.0);
    vec3 light = lightColor * luminance;

    gl_FragColor.rgb = color * light + color * ambient;
    gl_FragColor.a = 1.0;
}