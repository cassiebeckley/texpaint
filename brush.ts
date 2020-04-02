import { vec3, vec4 } from 'gl-matrix';
import { lerp } from './math';

// TODO: dedupe from imageDisplay
const imageTexturePositions = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];

export default class Brush {
    constructor(radius, color, spacing, imageDisplay) {
        this.radius = radius + 0.1;
        this.color = color;
        this.spacing = spacing;

        this.imageDisplay = imageDisplay;

        this.segmentStart = vec3.create();
        this.segmentStartPressure = 0;
        this.segmentSoFar = 0;
    }

    startStroke(imageCoord, pressure, iterate) {
        this.imageDisplay.checkpoint(); // save image in undo stack

        vec3.copy(this.segmentStart, imageCoord);
        this.segmentStartPressure = pressure;
        this.segmentSoFar = 0;

        if (iterate) {
            this.iteration(imageCoord, pressure);
        }
    }

    continueStroke(imageCoord, pressure) {
        // this.tempS(imageCoord, pressure);
        const displacement = vec3.create();
        vec3.sub(displacement, imageCoord, this.segmentStart);
        const segmentLength = vec3.len(displacement);
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
            if (nextSpacing < 0.01) {
                nextSpacing = 0.01;
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

        const radius = this.radius * pressure;

        if (
            brushCenter[0] <= -this.radius ||
            brushCenter[0] >= this.imageDisplay.width + this.radius ||
            brushCenter[1] <= -this.radius ||
            brushCenter[1] >= this.imageDisplay.height + this.radius
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
        const rsq = radius * radius; // radius squared

        // forty-five degree coordinate, to determine where to switch from horizontal to vertical
        const ffd = Math.round(radius / Math.sqrt(2));

        for (let x = 0; x < ffd; x++) {
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
        const color = vec4.clone(this.color);

        color[3] = f;

        vec3.add(point, center, [x, y, 0]);
        this.applyPixel(point, color);

        vec3.add(point, center, [x, -y, 0]);
        this.applyPixel(point, color);

        vec3.add(point, center, [-x, y, 0]);
        this.applyPixel(point, color);

        vec3.add(point, center, [-x, -y, 0]);
        this.applyPixel(point, color);
    }

    fillCircle(center, radius) {
        vec3.round(center, center); //?
        const radiusSquare = vec3.create();
        vec3.set(radiusSquare, radius, radius, 0);

        const startPosition = vec3.create();
        vec3.sub(startPosition, center, radiusSquare);

        const offset = vec3.create();

        for (let x = startPosition[0]; x < startPosition[0] + radius * 2; x++) {
            if (x < 0 || x >= this.imageDisplay.width) continue;
            for (
                let y = startPosition[1];
                y < startPosition[1] + radius * 2;
                y++
            ) {
                if (y < 0 || y >= this.imageDisplay.height) continue;

                vec3.set(offset, x, y, 0);
                vec3.floor(offset, offset);

                this.fillCirclePixel(center, offset, radius);
            }
        }
    }

    fillCirclePixel(brushCenter, pixelCoord, radius) {
        let color = vec4.clone(this.color);
        const distance = vec3.distance(brushCenter, pixelCoord);
        if (distance < radius) {
            color[3] = 1.0;
        } else {
            color[3] = 0.0;
        }

        this.applyPixel(pixelCoord, color);
    }

    applyPixel(pixelCoord, color) {
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
        const colorRGB = vec3.clone(color);

        vec3.lerp(colorRGB, existing, colorRGB, color[3]);

        this.imageDisplay.buffer[baseIndex] = colorRGB[0] * 255;
        this.imageDisplay.buffer[baseIndex + 1] = colorRGB[1] * 255;
        this.imageDisplay.buffer[baseIndex + 2] = colorRGB[2] * 255;
        this.imageDisplay.buffer[baseIndex + 3] = 255;
    }
}
