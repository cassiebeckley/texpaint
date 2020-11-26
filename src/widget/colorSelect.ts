import getWindowManager from '../windowManager';
import loadShaderProgram, { Shader } from '../shaders';

import vertColorSelectShader from '../shaders/colorSelectShader/vert.glsl';
import fragColorSelectShader from '../shaders/colorSelectShader/frag.glsl';

import { generateRectVerticesStrip, rectVerticesStripUV } from '../primitives';
import { vec3, mat4 } from 'gl-matrix';
import { mouseEventToVec3 } from '../events';
import type Brush from '../brush';
import { SlateState } from '../slate';

const radius = 110;
const wheelWidth = 40;

enum ColorResultType {
    None,
    Hue,
    SaturationValue,
}

class ColorResult {
    type: ColorResultType;
    hsv: vec3;
    constructor(type: ColorResultType, hsv?: vec3) {
        this.type = type;
        this.hsv = hsv;
    }
}

export default class ColorSelect {
    colorSelectShader: Shader;

    hsvColor: vec3;

    position: vec3;
    width: number;
    height: number;
    vertexBuffer: WebGLBuffer;
    uvBuffer: WebGLBuffer;

    slateState: SlateState;

    selectOutputTexture: WebGLTexture;
    selectOutputFramebuffer: WebGLFramebuffer;

    mouseDown: boolean;

    brush: Brush;

    constructor(brush: Brush, slateState: SlateState) {
        this.width = this.height = 300;
        this.position = vec3.create();
        vec3.set(
            this.position,
            getWindowManager().canvas.clientWidth - this.width - 30,
            90,
            0
        );

        this.brush = brush;
        this.hsvColor = vec3.clone(brush.color);

        const gl = getWindowManager().gl;
        this.colorSelectShader = loadShaderProgram(
            gl,
            vertColorSelectShader,
            fragColorSelectShader
        );

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
                generateRectVerticesStrip(
                    this.position[0],
                    this.position[1],
                    this.width,
                    this.width
                )
            ),
            gl.STATIC_DRAW
        );

        this.uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(rectVerticesStripUV),
            gl.STATIC_DRAW
        );

        this.slateState = slateState;

        this.selectOutputTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.selectOutputTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.width,
            this.width,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.selectOutputFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.selectOutputFramebuffer);

        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.selectOutputTexture,
            0
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    isVisible() {
        return this.slateState.showColorWheel;
    }

    getWidgetWidth() {
        return this.width;
    }

    getWidgetHeight() {
        return this.height;
    }

    drawWheel(display: boolean, modelViewMatrix?: mat4) {
        if (!modelViewMatrix) {
            modelViewMatrix = mat4.create();
            mat4.identity(modelViewMatrix);
        }

        const windowManager = getWindowManager();
        const gl = windowManager.gl;

        gl.useProgram(this.colorSelectShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.colorSelectShader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );

        gl.uniformMatrix4fv(
            this.colorSelectShader.uniforms.uModelViewMatrix,
            false,
            modelViewMatrix
        );

        gl.uniform3fv(this.colorSelectShader.uniforms.uHSV, this.hsvColor);
        gl.uniform1f(
            this.colorSelectShader.uniforms.uDisplay,
            display ? 1.0 : 0.0
        );
        gl.uniform1f(
            this.colorSelectShader.uniforms.uRadius,
            radius / this.width
        );
        gl.uniform1f(
            this.colorSelectShader.uniforms.uWheelWidth,
            wheelWidth / this.width
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.vertexAttribPointer(
                this.colorSelectShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.colorSelectShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
            gl.vertexAttribPointer(
                this.colorSelectShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.colorSelectShader.attributes.aTextureCoord
            );
        }

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }

    draw() {
        this.drawWheel(true);
    }

    hsvColorAt(point: vec3): ColorResult {
        const center = vec3.create();
        vec3.set(center, this.width / 2, this.width / 2, 0);
        if (vec3.distance(center, point) > radius + wheelWidth) {
            return new ColorResult(ColorResultType.None);
        }

        if (vec3.distance(center, point) > radius) {
            const toPoint = vec3.create();
            vec3.sub(toPoint, point, center);
            let angle = (vec3.angle(toPoint, [1, 0, 0]) * 180) / Math.PI + 180;
            if (toPoint[1] < 0) {
                angle = 360 - angle;
            }
            return new ColorResult(ColorResultType.Hue, [angle, 0, 0]);
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
            triangleX > horizontalLineStart &&
            triangleX < horizontalLineEnd &&
            triangleY < triangleHeight
        ) {
            return new ColorResult(ColorResultType.SaturationValue, [
                0,
                saturation,
                value,
            ]);
        }

        return new ColorResult(ColorResultType.None);
    }

    setHsvColor(hsv: vec3) {
        this.hsvColor = hsv;
        const rgb = hsvToRgb(this.hsvColor);
        this.brush.color = rgb;
        getWindowManager().setColor(rgb);
    }

    setColorByCoords(point: vec3) {
        const localPosition = vec3.create();
        vec3.sub(localPosition, point, this.position);
        const colorResult = this.hsvColorAt(localPosition);

        const hsvColor = vec3.clone(this.hsvColor);
        switch (colorResult.type) {
            case ColorResultType.SaturationValue:
                hsvColor[1] = colorResult.hsv[1];
                hsvColor[2] = colorResult.hsv[2];
                break;
            case ColorResultType.Hue:
                hsvColor[0] = colorResult.hsv[0];
                break;
        }

        if (colorResult.type !== ColorResultType.None) {
            this.setHsvColor(hsvColor);
        }
    }

    handleWheel(amount: number) {
        // do nothing
    }

    handleMouseDown(e: MouseEvent) {
        this.mouseDown = true;
    }

    handleMouseUp(e: MouseEvent) {
        if (this.mouseDown) {
            this.setColorByCoords(mouseEventToVec3(e));
        }
        this.mouseDown = false;
    }

    handleMouseMove(e: MouseEvent) {
        if (this.mouseDown) {
            this.setColorByCoords(mouseEventToVec3(e));
        }
    }

    handlePointerDown(e: PointerEvent) {
        this.handleMouseDown(e);
    }

    handlePointerUp(e: PointerEvent) {
        this.handleMouseUp(e);
    }

    handlePointerMove(e: PointerEvent) {
        this.handleMouseMove(e);
    }
}

const hsvToRgb = (hsv: vec3): vec3 => {
    function hsvToRgbF(hsv: vec3, n: number) {
        const h = hsv[0];
        const s = hsv[1];
        const v = hsv[2];

        const k = (n + h / 60.0) % 6.0;
        return v - v * s * Math.max(0.0, Math.min(k, 4.0 - k, 1.0));
    }

    const rgb = vec3.create();
    vec3.set(
        rgb,
        hsvToRgbF(hsv, 5.0),
        hsvToRgbF(hsv, 3.0),
        hsvToRgbF(hsv, 1.0)
    );

    return rgb;
};

const rgbToHsv = (rgb: vec3) => {
    const hsv = vec3.create();

    const xMin = Math.min(rgb[0], rgb[1], rgb[2]);
    const xMax = Math.max(rgb[0], rgb[1], rgb[2]);

    hsv[2] = xMax;

    const chroma = xMax - xMin;

    if (xMax !== 0) {
        hsv[1] = chroma / xMax;
    } else {
        hsv[1] = 0;
        return hsv;
    }

    if (chroma === 0) {
        hsv[0] = 0;
        return hsv;
    }

    if (rgb[0] === xMax) {
        hsv[0] = rgb[1] - rgb[2] / chroma;
    } else if (rgb[1] === xMax) {
        hsv[0] = 2 + (rgb[2] - rgb[0]) / chroma;
    } else {
        hsv[0] = 4 + (rgb[0] - rgb[1]) / chroma;
    }

    hsv[0] *= 60;
    if (hsv[0] < 0) {
        hsv[0] += 360;
    }

    return hsv;
};
