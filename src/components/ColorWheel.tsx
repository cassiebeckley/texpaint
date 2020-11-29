import * as React from 'react';
import { useState } from 'react';
import { vec2, vec3 } from 'gl-matrix';
import { hsvToRgb, rgbToHsv } from '../color';
import Widget from './Widget';

enum ColorResultType {
    None,
    Hue,
    SaturationValue,
}

const clamp = (n: number) => {
    if (n < 0.0) {
        return 0.0;
    } else if (n > 1.0) {
        return 1.0;
    }

    return n;
};

const hsvColorAt = (
    point: vec2,
    { width, radius, wheelWidth },
    lockedTo: ColorResultType
) => {
    const center = vec2.create();
    vec2.set(center, width / 2, width / 2);
    if (
        vec2.distance(center, point) > radius + wheelWidth &&
        lockedTo === ColorResultType.None
    ) {
        return { type: ColorResultType.None };
    }

    if (
        (vec2.distance(center, point) > radius &&
            lockedTo !== ColorResultType.SaturationValue) ||
        lockedTo === ColorResultType.Hue
    ) {
        const toPoint = vec2.create();
        vec2.sub(toPoint, point, center);
        let angle = (vec2.angle(toPoint, [1, 0]) * 180) / Math.PI + 180;
        if (toPoint[1] < 0) {
            angle = 360 - angle;
        }
        return { type: ColorResultType.Hue, hsv: [angle, 0, 0] };
    }

    // TODO: see if there's a way to share this code with the fragment shader

    const triangleHeight = radius * 1.5;
    const triangleWidth = triangleHeight * (2.0 / Math.sqrt(3.0));

    const triangleX = point[0] - (center[0] - triangleWidth / 2.0);
    const triangleY = point[1] - center[1] + radius;
    const horizontalLineLength = triangleY * (2.0 / Math.sqrt(3.0));
    const horizontalLineStart =
        triangleWidth / 2.0 - horizontalLineLength / 2.0;
    const horizontalLineEnd = horizontalLineStart + horizontalLineLength;

    const relativeX = triangleX - horizontalLineStart;

    const value = triangleY / triangleHeight;
    const saturation = relativeX / horizontalLineLength;

    if (
        (triangleX > horizontalLineStart &&
            triangleX < horizontalLineEnd &&
            triangleY < triangleHeight) ||
        lockedTo === ColorResultType.SaturationValue
    ) {
        return {
            type: ColorResultType.SaturationValue,
            hsv: [0, clamp(saturation), clamp(value)],
        };
    }

    return { type: ColorResultType.None };
};

export default function ColorWheel({ brushColor, setBrushColor }) {
    const [capturedField, setCapturedField] = useState(ColorResultType.None);
    const [hsvColor, setHsvColor] = useState(rgbToHsv(brushColor));

    const setColorFromHsv = (hsv: vec3) => {
        setHsvColor(hsv);
        setBrushColor(hsvToRgb(hsv));
    };

    const radius = 110;
    const wheelWidth = 40;

    const widgetWidth = 350;
    const padding = (widgetWidth - radius * 2) / 2;

    const svWidth = 20;

    const triangleHeight = radius * 1.5;
    const svHorizontalLineLength =
        (triangleHeight * hsvColor[2] * 2.0) / Math.sqrt(3.0);

    const svCoordinate = vec2.create();
    vec2.set(
        svCoordinate,
        svHorizontalLineLength * hsvColor[1] +
            radius -
            svHorizontalLineLength / 2.0,
        triangleHeight * hsvColor[2]
    );
    vec2.add(svCoordinate, svCoordinate, [padding, padding]); // padding
    vec2.sub(svCoordinate, svCoordinate, [svWidth / 2, svWidth / 2]); // offset

    const hueHeight = 6;

    const handleMouseDown = (e: React.MouseEvent) => {
        const result = hsvColorAt(
            [e.clientX, e.clientY],
            { width: widgetWidth, radius, wheelWidth },
            capturedField
        );
        const newColor = vec3.clone(hsvColor);

        switch (result.type) {
            case ColorResultType.Hue:
                newColor[0] = result.hsv[0];
                setColorFromHsv(newColor);
                break;
            case ColorResultType.SaturationValue:
                newColor[1] = result.hsv[1];
                newColor[2] = result.hsv[2];
                setColorFromHsv(newColor);
                break;
        }

        setCapturedField(result.type);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (capturedField === ColorResultType.None) return;

        handleMouseDown(e);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setCapturedField(ColorResultType.None);
    };

    return (
        <Widget
            type="ColorSelect"
            widgetProps={{ hsvColor, radius, wheelWidth }}
            className="color-widget"
            style={{ height: widgetWidth, width: widgetWidth, zIndex: 1 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <div
                style={{
                    position: 'relative',
                    display: 'block',
                    height: svWidth,
                    width: svWidth,
                    left: svCoordinate[0],
                    top: svCoordinate[1],
                    border: '1px solid white',
                    borderRadius: '50%',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        display: 'block',
                        height: svWidth - 3,
                        width: svWidth - 3,
                        border: '2px solid black',
                        borderRadius: '50%',
                    }}
                ></div>
            </div>
            <div
                style={{
                    position: 'absolute',
                    top: widgetWidth / 2 - hueHeight / 2,
                    left: 0,
                    height: hueHeight,
                    width: '100%',
                    transform: `rotate(${hsvColor[0]}deg)`,
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        display: 'block',
                        height: '100%',
                        width: wheelWidth + 1,
                        left: padding - wheelWidth - 2,
                        border: '2px solid black',
                    }}
                ></div>
            </div>
        </Widget>
    );
}
