#pragma glslify: rgb_to_srgb = require(../color/rgb_to_srgb)

precision mediump float;

uniform samplerCube uSkybox;
uniform mat4 uRotationMatrix;

varying highp vec2 vTextureCoord;

#define PI 3.1415926538

#define SPHERE_RADIUS 0.5

void main() {
    float pixelWidth = 1.0 / 150.0; // hard coded for now, might have to change when working on mobile CSS

    vec2 offset = vTextureCoord - 0.5;

    float y = offset.x;
    float x = offset.y;

    float distance = length(vTextureCoord - vec2(0.5, 0.5));
    float inBall = 1.0 - smoothstep(0.5 - pixelWidth, 0.5, distance);

    float rho = length(offset);

    float sin_c = rho / SPHERE_RADIUS;
    float c = asin(sin_c);

    float sin_phi = (y * sin_c) / rho;

    float phi = asin(sin_phi);
    float lambda = atan(x * sin_c, rho * cos(c));

    vec3 normal = vec3(sin_phi, cos(phi) * sin(lambda), cos(phi) * cos(lambda));

    vec3 reflection = reflect(vec3(0, 0, 1), normal);

    vec3 rotated = normalize((uRotationMatrix * vec4(reflection, 0.0)).xyz);

    gl_FragColor = vec4(textureCube(uSkybox, rotated).rgb, inBall);
    gl_FragColor.rgb = rgb_to_srgb(gl_FragColor.rgb);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}