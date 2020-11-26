import { vec3, vec4 } from 'gl-matrix';
import { lerp } from './math';
import type ImageDisplay from './imageDisplay';

export default class Brush {
    radius: number;
    color: vec3;
    spacing: number;
    imageDisplay: ImageDisplay;

    segmentStart: vec3;
    segmentStartPressure: number;
    segmentSoFar: number;

    constructor(
        diameter: number,
        color: vec3,
        spacing: number,
        imageDisplay: ImageDisplay
    ) {
        const radius = diameter / 2;
        this.radius = radius;
        this.color = color;
        this.spacing = spacing;

        this.imageDisplay = imageDisplay;

        this.segmentStart = vec3.create();
        this.segmentStartPressure = 0;
        this.segmentSoFar = 0;
    }

    startStroke(imageCoord: vec3, pressure: number) {
        this.imageDisplay.checkpoint(); // save image in undo stack

        vec3.copy(this.segmentStart, imageCoord);
        this.segmentStartPressure = pressure;
        this.segmentSoFar = 0;
    }

    continueStroke(imageCoord: vec3, pressure: number) {
        const displacement = vec3.create();
        vec3.sub(displacement, imageCoord, this.segmentStart);
        let segmentLength = vec3.len(displacement);
        const currentPoint = vec3.create();

        while (this.segmentSoFar <= segmentLength) {
            const t = this.segmentSoFar / segmentLength;
            vec3.scale(currentPoint, displacement, t);
            vec3.add(currentPoint, currentPoint, this.segmentStart);

            const currentPressure = lerp(
                this.segmentStartPressure,
                pressure,
                t
            );

            const radius = this.iteration(currentPoint, currentPressure);

            let nextSpacing = this.spacing * radius;
            if (nextSpacing < 1) {
                nextSpacing = 1;
            }
            this.segmentSoFar += nextSpacing;
        }

        this.segmentSoFar -= segmentLength;
        if (segmentLength < 0) {
            segmentLength = 0;
        }

        this.segmentStartPressure = pressure;
        vec3.copy(this.segmentStart, imageCoord);
    }

    finishStroke(imageCoord: vec3, pressure: number) {
        this.iteration(imageCoord, pressure);
    }

    iteration(brushCenter: vec3, pressure: number) {
        // a single dot of the brush

        const factor = pressure * pressure * pressure;
        const radius = this.radius * factor;

        if (
            brushCenter[0] <= -radius ||
            brushCenter[0] >= this.imageDisplay.width + radius ||
            brushCenter[1] <= -radius ||
            brushCenter[1] >= this.imageDisplay.height + radius
        ) {
            // entirely outside image bounds
            return radius;
        }

        this.fillCircle(brushCenter, radius);

        this.imageDisplay.markUpdate();

        return radius;
    }

    fillCircle(center: vec3, radius: number) {
        if (radius < 0.5) {
            const color = vec4.create();
            vec4.set(
                color,
                this.color[0],
                this.color[1],
                this.color[2],
                radius * 2
            );
            this.applyPixelInteger(center, color);
        }

        const radiusSquare = vec3.create();
        vec3.set(radiusSquare, radius, radius, 0);

        const startPosition = vec3.create();
        vec3.sub(startPosition, center, radiusSquare);

        const offset = vec3.create();

        for (let x = Math.floor(startPosition[0]); x <= Math.ceil(startPosition[0] + radius * 2); x++) {
            for (
                let y = Math.floor(startPosition[1]);
                y <= Math.ceil(startPosition[1] + radius * 2);
                y++
            ) {
                vec3.set(offset, x, y, 0);

                this.fillCirclePixel(center, offset, radius);
            }
        }
    }

    fillCirclePixel(brushCenter: vec3, pixelCoord: vec3, radius: number) {
        let color = vec4.create();

        const distance = vec3.distance(brushCenter, pixelCoord);
        const delta = 2; // this is a bit soft, but it looks nice to me so I'm keeping it

        const alpha = 1 - smoothstep(radius - delta, radius, distance);

        vec4.set(color, this.color[0], this.color[1], this.color[2], alpha);

        this.applyPixelInteger(pixelCoord, color);
    }

    applyPixelInteger(pixelCoord: vec3, color: vec4) {
        // round pixel coordinates
        vec3.round(pixelCoord, pixelCoord);
        const baseIndex =
            (pixelCoord[1] * this.imageDisplay.width + pixelCoord[0]) * 4;
        const existing = vec3.create();
        vec3.set(
            existing,
            this.imageDisplay.buffer[baseIndex],
            this.imageDisplay.buffer[baseIndex + 1],
            this.imageDisplay.buffer[baseIndex + 2]
        );
        vec3.scale(existing, existing, 1 / 255);

        const colorRGB = vec3.create();
        vec3.set(colorRGB, color[0], color[1], color[2]);

        vec3.lerp(colorRGB, existing, colorRGB, color[3]);

        this.imageDisplay.buffer[baseIndex] = colorRGB[0] * 255;
        this.imageDisplay.buffer[baseIndex + 1] = colorRGB[1] * 255;
        this.imageDisplay.buffer[baseIndex + 2] = colorRGB[2] * 255;
        this.imageDisplay.buffer[baseIndex + 3] = 255;
    }
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
    let t = (x - edge0) / (edge1 - edge0);

    if (t < 0.0) {
        t = 0.0;
    } else if (t > 1.0) {
        t = 1.0;
    }

    return t * t * (3.0 - 2.0 * t);
};