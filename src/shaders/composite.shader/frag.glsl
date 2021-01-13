precision mediump float;

varying highp vec2 vTextureCoord;

uniform sampler2D uTextureA;
uniform sampler2D uTextureB;

uniform int uMode;

const int MODE_NORMAL = 0;
const int MODE_MASK = 1;

void main() { // TODO: converting between premultiplied and straight alpha on every composite; try to stick to one internally
    vec4 a = texture2D(uTextureA, vTextureCoord);
    vec4 b = texture2D(uTextureB, vTextureCoord);

    if (uMode == MODE_NORMAL) {
        a.rgb *= a.a; // convert to premultiplied alpha
        b.rgb *= b.a;

        gl_FragColor = a + b * (1.0 - a.a);

        float denom = max(gl_FragColor.a, 0.00001);

        gl_FragColor.rgb /= denom; // convert to straight alpha
    } else if (uMode == MODE_MASK) {
        gl_FragColor.rgb = b.rgb;
        gl_FragColor.a = b.a * a.x;
    }
}