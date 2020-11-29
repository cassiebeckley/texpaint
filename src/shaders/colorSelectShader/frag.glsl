precision mediump float;

uniform lowp vec3 uHSV;
uniform lowp float uDisplay; // TODO: remove

uniform highp float uRadius;
uniform highp float uWheelWidth;

varying highp vec2 vTextureCoord;

const highp vec2 center = vec2(0.5, 0.5);

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
    highp float smoothDelta = uRadius / 110.0;
    highp vec2 centerDisplacement = vTextureCoord - center;
    highp float centerDistance = length(centerDisplacement);

    lowp float inOuterCircle = 1.0 - smoothstep(uRadius + uWheelWidth, uRadius + uWheelWidth + smoothDelta, centerDistance);
    lowp float outsideInnerCircle = smoothstep(uRadius, uRadius + smoothDelta, centerDistance);
    lowp float inWheel = inOuterCircle * outsideInnerCircle;

    highp float angleFromCenter = atan(centerDisplacement.y, centerDisplacement.x);
    lowp float wheelHue = degrees(angleFromCenter) + 180.0;

    lowp vec3 wheelHSV = vec3(wheelHue, 1.0, 1.0);

    highp float triangleY = vTextureCoord.y - center.y + uRadius;

    highp float triangleHeight = uRadius * 1.5;
    highp float triangleWidth = triangleHeight * (2.0 / sqrt(3.0));

    highp float triangleX = vTextureCoord.x - (center.x - triangleWidth / 2.0);
    highp float horizontalLineLength = triangleY * (2.0 / sqrt(3.0));
    highp float horizontalLineStart = triangleWidth / 2.0 - horizontalLineLength / 2.0;
    highp float horizontalLineEnd = horizontalLineStart + horizontalLineLength;

    highp float relativeX = triangleX - horizontalLineStart;

    lowp float value = triangleY / triangleHeight;
    lowp float saturation = relativeX / horizontalLineLength;

    lowp float inTriangle = smoothstep(horizontalLineStart, horizontalLineStart + smoothDelta, triangleX) * (1.0 - smoothstep(horizontalLineEnd, horizontalLineEnd + smoothDelta, triangleX)) * (1.0 - step(triangleHeight, triangleY));

    lowp vec4 wheelRGB = vec4(hsvToRgb(wheelHSV) * inWheel, inWheel);

    lowp vec3 triangleHSV = vec3(uHSV.x, saturation, value);
    lowp vec4 triangleRGB = vec4(hsvToRgb(triangleHSV) * inTriangle, inTriangle);

    gl_FragColor = wheelRGB + triangleRGB;
    gl_FragColor.a = clamp(gl_FragColor.a, 0.0, 1.0);
    gl_FragColor.rgb *= gl_FragColor.a; // premultiply alpha
}