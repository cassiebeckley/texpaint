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

    startStroke(imageCoord, pressure) {
        this.imageDisplay.checkpoint(); // save image in undo stack

        vec3.copy(this.segmentStart, imageCoord);
        this.segmentStartPressure = pressure;
        this.segmentSoFar = 0;
    }

    continueStroke(imageCoord, pressure) {
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

    finishStroke(imageCoord, pressure) {
        this.iteration(imageCoord, pressure);
    }

    iteration(brushCenter, pressure) {
        // a single dot of the brush

        const factor = pressure * pressure;
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

        this.wuCircle(brushCenter, radius);
        this.fillCircle(brushCenter, radius);

        this.imageDisplay.markUpdate();

        return radius;
    }

    // Xiolin Wu anti-aliased circle algorithm
    // see https://yellowsplash.wordpress.com/2009/10/23/fast-antialiased-circles-and-ellipses-from-xiaolin-wus-concepts/
    wuCircle(center, radius) {
        if (radius < 0.5) return;

        const rsq = radius * radius; // radius squared

        // forty-five degree coordinate, to determine where to switch from horizontal to vertical
        const ffd = Math.round(radius / Math.sqrt(2));

        for (let x = 0; x < ffd + 1; x++) {
            const y = Math.sqrt(rsq - x * x);
            const frc = y % 1;
            const flr = Math.floor(y);
            this.plot4Points(center, x, flr, 1 - frc);
            this.plot4Points(center, x, flr + 1, frc);
        }

        for (let y = 0; y < ffd; y++) {
            const x = Math.sqrt(rsq - y * y);
            const frc = x % 1;
            const flr = Math.floor(x);
            this.plot4Points(center, flr, y, 1 - frc);
            this.plot4Points(center, flr + 1, y, frc);
        }
    }

    plot4Points(center, x, y, f) {
        const point = vec3.create();
        const color = vec4.create();

        vec4.set(color, this.color[0], this.color[1], this.color[2], f);

        vec3.add(point, center, [x, y, 0]);
        this.applyPixel(point, color);

        vec3.add(point, center, [x, -y, 0]);
        this.applyPixel(point, color);

        vec3.add(point, center, [-x, y, 0]);
        this.applyPixel(point, color);

        vec3.add(point, center, [-x, -y, 0]);
        this.applyPixel(point, color);
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
            this.applyPixel(center, color);
        }

        const radiusSquare = vec3.create();
        vec3.set(radiusSquare, radius, radius, 0);

        const startPosition = vec3.create();
        vec3.sub(startPosition, center, radiusSquare);

        const offset = vec3.create();

        for (let x = startPosition[0]; x < startPosition[0] + radius * 2; x++) {
            for (
                let y = startPosition[1];
                y < startPosition[1] + radius * 2;
                y++
            ) {
                vec3.set(offset, x, y, 0);

                this.fillCirclePixel(center, offset, radius);
            }
        }
    }

    fillCirclePixel(brushCenter, pixelCoord, radius) {
        let color = vec4.create();

        const distance = vec3.distance(brushCenter, pixelCoord);
        let alpha = 0.0;
        if (distance < radius) {
            alpha = 1.0;
        }

        vec4.set(color, this.color[0], this.color[1], this.color[2], alpha);

        this.applyPixel(pixelCoord, color);
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

    applyPixel(pixelCoord: vec3, color: vec4) {
        if (pixelCoord[0] < 0 || pixelCoord[0] >= this.imageDisplay.width)
            return;
        if (pixelCoord[1] < 0 || pixelCoord[1] >= this.imageDisplay.height)
            return;

        const fracX = pixelCoord[0] % 1;
        const fracY = pixelCoord[1] % 1;

        if (
            Math.abs(fracX) < Number.EPSILON &&
            Math.abs(fracY) < Number.EPSILON
        ) {
            this.applyPixelInteger(pixelCoord, color);
        } else if (Math.abs(fracX) < Number.EPSILON) {
            const colorFirst = vec4.clone(color);
            const colorSecond = vec4.clone(color);

            colorFirst[3] *= 1 - fracY;
            colorSecond[3] *= fracY;

            const flooredCoord = vec3.create();
            vec3.floor(flooredCoord, pixelCoord);

            const currentCoord = vec3.clone(flooredCoord);
            this.applyPixelInteger(currentCoord, colorFirst);

            vec3.add(currentCoord, flooredCoord, [0, 1.0, 0]);
            this.applyPixelInteger(currentCoord, colorSecond);
        } else if (Math.abs(fracY) < Number.EPSILON) {
            const colorFirst = vec4.clone(color);
            const colorSecond = vec4.clone(color);

            colorFirst[3] *= 1 - fracX;
            colorSecond[3] *= fracX;

            const flooredCoord = vec3.create();
            vec3.floor(flooredCoord, pixelCoord);

            const currentCoord = vec3.clone(flooredCoord);
            this.applyPixelInteger(currentCoord, colorFirst);

            vec3.add(currentCoord, flooredCoord, [1.0, 0, 0]);
            this.applyPixelInteger(currentCoord, colorSecond);
        } else {
            const colorFirst = vec4.clone(color);
            const colorSecond = vec4.clone(color);
            const colorThird = vec4.clone(color);
            const colorFourth = vec4.clone(color);

            colorFirst[3] *= (1 - fracX + 1 - fracY) / 2;
            colorSecond[3] *= (fracX + 1 - fracY) / 2;
            colorThird[3] *= (1 - fracX + fracY) / 2;
            colorFourth[3] *= (fracX + fracY) / 2;

            const flooredCoord = vec3.create();
            vec3.floor(flooredCoord, pixelCoord);

            const currentCoord = vec3.clone(flooredCoord);
            this.applyPixelInteger(currentCoord, colorFirst);

            vec3.add(currentCoord, flooredCoord, [1.0, 0, 0]);
            this.applyPixelInteger(currentCoord, colorSecond);

            vec3.add(currentCoord, flooredCoord, [0.0, 1.0, 0]);
            this.applyPixelInteger(currentCoord, colorThird);

            vec3.add(currentCoord, flooredCoord, [1.0, 1.0, 0]);
            this.applyPixelInteger(currentCoord, colorFourth);
        }
    }
}
