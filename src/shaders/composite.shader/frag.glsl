#version 300 es
precision mediump float;

in highp vec2 vTextureCoord;

out vec4 color;

uniform sampler2D uTextureA;
uniform sampler2D uTextureB;

uniform int uMode;

const int MODE_NORMAL = 0;
const int MODE_MASK = 1;

void main() { // TODO: converting between premultiplied and straight alpha on every composite; try to stick to one internally
    vec4 a = texture(uTextureA, vTextureCoord);
    vec4 b = texture(uTextureB, vTextureCoord);

    if (uMode == MODE_NORMAL) {
        a.rgb *= a.a; // convert to premultiplied alpha
        b.rgb *= b.a;

        color = a + b * (1.0 - a.a);

        float denom = max(color.a, 0.00001);

        color.rgb /= denom; // convert to straight alpha
    } else if (uMode == MODE_MASK) {
        color.rgb = b.rgb;
        color.a = b.a * a.x;
    }
}