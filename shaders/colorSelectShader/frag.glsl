precision mediump float;

uniform lowp vec3 uHSV;

varying highp vec2 vTextureCoord;

// these might one day be uniforms

const lowp float hue = 352.0;
const lowp float currentSaturation = 0.409;
const lowp float currentValue = 0.91;

const lowp float display = 1.0;

const highp vec2 center = vec2(0.5, 0.5);
const highp float radius = 0.4;
const highp float wheelWidth = 0.09;

lowp float hsvToRgbF(lowp vec3 hsv, lowp float n) {
    lowp float h = hsv.x;
    lowp float s = hsv.y;
    lowp float v = hsv.z;

    lowp float k = mod(n + h / 60.0, 6.0);
    return v - v * s * max(0.0, min(k, min(4.0 - k, 1.0)));
}

lowp vec3 hsvToRgb(lowp vec3 hsv) {
    return vec3(hsvToRgbF(hsv, 5.0), hsvToRgbF(hsv, 3.0), hsvToRgbF(hsv, 1.0));
}

void main() {
    highp vec2 centerDisplacement = vTextureCoord - center;
    highp float centerDistance = length(centerDisplacement);

    lowp float inOuterCircle = 1.0 - step(radius + wheelWidth, centerDistance);
    lowp float outsideInnerCircle = step(radius, centerDistance);
    lowp float inWheel = inOuterCircle * outsideInnerCircle;

    highp float angleFromCenter = atan(centerDisplacement.y, centerDisplacement.x);
    lowp float wheelHue = degrees(angleFromCenter) + 180.0;

    lowp float hueLine = step(abs(wheelHue - hue), 1.0) * display;

    lowp vec3 wheelHSV = vec3(wheelHue, 1.0, 1.0);
    lowp vec4 wheelRGB = vec4(hsvToRgb(wheelHSV) * inWheel * (1.0 - hueLine), inWheel);

    highp float triangleY = vTextureCoord.y - center.y + radius;

    highp float triangleHeight = radius * 1.5;
    highp float triangleWidth = triangleHeight * (2.0 / sqrt(3.0));

    highp float triangleX = vTextureCoord.x - (center.x - triangleWidth / 2.0);
    highp float horizontalLineLength = triangleY * (2.0 / sqrt(3.0));
    highp float horizontalLineStart = triangleWidth / 2.0 - horizontalLineLength / 2.0;
    highp float horizontalLineEnd = horizontalLineStart + horizontalLineLength;

    highp float relativeX = triangleX - horizontalLineStart;

    lowp float value = triangleY / triangleHeight;
    lowp float saturation = relativeX / horizontalLineLength;

    lowp float inTriangle = step(horizontalLineStart, triangleX) * (1.0 - step(horizontalLineEnd, triangleX)) * (1.0 - step(triangleHeight, triangleY));

    highp float svHorizontalLineLength = triangleHeight * currentValue * 2.0 / sqrt(3.0);
    highp float svHorizontalLineStart = triangleWidth / 2.0 - svHorizontalLineLength / 2.0;

    highp vec2 svCoordinate = vec2(svHorizontalLineLength * currentSaturation + svHorizontalLineStart, triangleHeight * currentValue + center.y - radius);
    lowp float svCircle = step(distance(vTextureCoord, svCoordinate), 0.01) * display;

    lowp vec3 triangleHSV = vec3(hue, saturation, value);
    lowp vec4 triangleRGB = vec4(hsvToRgb(triangleHSV) * inTriangle * (1.0 - svCircle), inTriangle);

    lowp vec4 background = vec4((1.0 - inTriangle) * (1.0 - inWheel) * vec3(0.5, 0.5, 0.5), 1.0) * display;

    gl_FragColor = wheelRGB + triangleRGB + background;
    gl_FragColor.a = clamp(gl_FragColor.a, 0.0, 1.0);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}