import { mat4, vec3 } from 'gl-matrix';
import getWindowManager from './windowManager';
import loadShaderProgram, { Shader } from './shaders';

import vertImageShader from './shaders/imageShader/vert.glsl';
import fragImageShader from './shaders/imageShader/frag.glsl';

import { SCROLL_SCALE } from './constants';
import Brush from './brush';

const imageTexturePositions = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];

const eventState = {
    mouseButtonsDown: [],
    lastMousePosition: vec3.create(),
    lastPointerPosition: vec3.create(),
    lastPressure: 0,
    pointerDown: false, // TODO: distinguish pointers
};

const brushSize = 40.0;
const brushColor = vec3.create();
vec3.set(brushColor, 0, 0, 0);

export default class ImageDisplay {
    width: number;
    height: number;
    buffer: Uint8ClampedArray;

    history: Uint8ClampedArray[];
    historyIndex: number;

    updated: boolean;

    texture: WebGLTexture;
    imagePositionBuffer: WebGLBuffer;
    imageMatrix: mat4;

    imageShader: Shader;
    imageTextureBuffer: WebGLBuffer;
    brush: Brush;

    // texture:
    constructor(width, height) {
        const gl = getWindowManager().gl;

        this.width = width;
        this.height = height;
        this.buffer = this.createLayerBuffer(true);

        this.history = [];
        this.historyIndex = 0;

        this.updated = false;

        this.texture = gl.createTexture();
        this.imagePositionBuffer = gl.createBuffer();
        this.imageMatrix = mat4.create();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        this.imageShader = loadShaderProgram(
            gl,
            vertImageShader,
            fragImageShader
        );

        // TODO create texture for each layer (probably split layer into a class)

        this.imageTextureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.imageTextureBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(imageTexturePositions),
            gl.STATIC_DRAW
        );

        this.brush = new Brush(brushSize, brushColor, 0.4, this);
    }

    createLayerBuffer(opaque) {
        const buffer = new Uint8ClampedArray(this.width * this.height * 4);

        if (opaque) {
            buffer.fill(255);
        }

        return buffer;
    }

    draw() {
        const windowManager = getWindowManager();
        const gl = windowManager.gl;

        //// update texture if necessary ////
        if (this.updated) {
            this._swapBuffer();
            this.updated = false;
        }

        //// draw 2d image view ////
        gl.useProgram(this.imageShader.program);

        // set projection and model*view matrices;
        gl.uniformMatrix4fv(
            this.imageShader.uniforms.uProjectionMatrix,
            false,
            windowManager.uiProjectionMatrix
        );
        gl.uniformMatrix4fv(
            this.imageShader.uniforms.uModelViewMatrix,
            false,
            this.imageMatrix
        );

        {
            const size = 2;
            const type = gl.FLOAT; // 32 bit floats
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.imagePositionBuffer);
            gl.vertexAttribPointer(
                this.imageShader.attributes.aVertexPosition,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.imageShader.attributes.aVertexPosition
            );
        }

        {
            const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.imageTextureBuffer);
            gl.vertexAttribPointer(
                this.imageShader.attributes.aTextureCoord,
                size,
                type,
                normalize,
                stride,
                offset
            );
            gl.enableVertexAttribArray(
                this.imageShader.attributes.aTextureCoord
            );
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.imageShader.uniforms.uSampler, 0);

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }

    load(url) {
        // parse image file
        // we have to use Canvas as an intermediary
        const tempImg = document.createElement('img');

        // TODO: probably return Promise

        tempImg.addEventListener('load', () => {
            const tempImageCanvas = document.createElement('canvas');
            tempImageCanvas.width = tempImg.width;
            tempImageCanvas.height = tempImg.height;
            const ctx = tempImageCanvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            const imageData = ctx.getImageData(
                0,
                0,
                tempImg.width,
                tempImg.height
            );
            this.buffer = imageData.data;
            this.width = imageData.width;
            this.height = imageData.height;

            this.markUpdate();
            this.resetImageTransform();
        });
        tempImg.src = url;
    }

    markUpdate() {
        this.updated = true;
    }

    // Internal, should only be called in draw if update necessary
    _swapBuffer() {
        const gl = getWindowManager().gl;
        // upload texture
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = this.width;
        const height = this.height;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            width,
            height,
            border,
            srcFormat,
            srcType,
            this.buffer
        );
    }

    resetImageTransform() {
        const windowManager = getWindowManager();
        const canvas = windowManager.canvas;
        const gl = windowManager.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.imagePositionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(generateImageVertices(this)),
            gl.STATIC_DRAW
        );

        //// initialize 2d image ////
        mat4.identity(this.imageMatrix);
        mat4.translate(this.imageMatrix, this.imageMatrix, [
            canvas.width / 2 - this.width / 2,
            canvas.height / 2 - this.height / 2,
            0,
        ]);

        // reset history
        this.history = [];
        this.historyIndex = 0;
    }

    uiToImageCoordinates(uiCoord) {
        const imageCoord = vec3.create();
        const invImageMatrix = mat4.create();
        mat4.invert(invImageMatrix, this.imageMatrix);
        vec3.transformMat4(imageCoord, uiCoord, invImageMatrix);
        return imageCoord;
    }

    // event handlers
    handleWheel(deltaY) {
        if (deltaY != 0) {
            let scaleFactor = 1;

            if (deltaY < 0) {
                scaleFactor /= -deltaY * SCROLL_SCALE;
            } else {
                scaleFactor *= deltaY * SCROLL_SCALE;
            }

            // Scale with mouse as origin
            const imageMousePos = this.uiToImageCoordinates(
                eventState.lastMousePosition
            );
            mat4.translate(this.imageMatrix, this.imageMatrix, imageMousePos);
            mat4.scale(this.imageMatrix, this.imageMatrix, [
                scaleFactor,
                scaleFactor,
                1,
            ]);

            vec3.negate(imageMousePos, imageMousePos);
            mat4.translate(this.imageMatrix, this.imageMatrix, imageMousePos);
        }
    }

    handleMouseDown(button) {
        eventState.mouseButtonsDown[button] = true;

        if (button === 0) {
            const imageCoord = this.uiToImageCoordinates(
                eventState.lastMousePosition
            );
            this.brush.startStroke(imageCoord, 1.0);
        }

        if (button === 1) {
            // MMV
            document.body.style.cursor = 'grab';
        }
    }

    handleMouseUp(button) {
        eventState.mouseButtonsDown[button] = false;

        if (button === 0) {
            const imageCoord = this.uiToImageCoordinates(
                eventState.lastMousePosition
            );
            this.brush.finishStroke(imageCoord, 1.0);
        }

        if (button === 1) {
            // MMV
            document.body.style.cursor = 'auto';
        }
    }

    handleMouseMove(currentMousePosition) {
        const delta = vec3.create();
        vec3.sub(delta, currentMousePosition, eventState.lastMousePosition);

        // if LMB is down (draw)
        if (eventState.mouseButtonsDown[0]) {
            const imageCoord = this.uiToImageCoordinates(currentMousePosition);
            this.brush.continueStroke(imageCoord, 1.0);
        }

        // if MMB is down (pan)
        if (eventState.mouseButtonsDown[1]) {
            let deltaMouse = this.uiToImageCoordinates(currentMousePosition);
            let lastImageMousePos = this.uiToImageCoordinates(
                eventState.lastMousePosition
            );
            vec3.sub(deltaMouse, deltaMouse, lastImageMousePos);
            mat4.translate(this.imageMatrix, this.imageMatrix, deltaMouse);
        }

        eventState.lastMousePosition = currentMousePosition;
    }

    handlePointerDown(e) {
        const imageCoord = this.uiToImageCoordinates(
            eventState.lastPointerPosition
        );
        this.brush.startStroke(imageCoord, e.pressure);
        eventState.pointerDown = true;
        eventState.lastPressure = e.pressure;
    }

    handlePointerUp(e) {
        const imageCoord = this.uiToImageCoordinates(
            eventState.lastPointerPosition
        );
        this.brush.finishStroke(imageCoord, eventState.lastPressure);
        eventState.pointerDown = false;
    }

    handlePointerMove(currentPointerPosition, e) {
        if (eventState.pointerDown) {
            const imageCoord = this.uiToImageCoordinates(
                currentPointerPosition
            );
            this.brush.continueStroke(imageCoord, e.pressure);
        }

        eventState.lastPointerPosition = currentPointerPosition;
        eventState.lastPressure = e.pressure;
    }

    // Undo history
    checkpoint() {
        // save image state in undo queue

        this.history.length = this.historyIndex;

        const currentBuffer = new Uint8ClampedArray(this.buffer);
        this.history.push(currentBuffer);
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > this.history.length) {
            this.historyIndex = this.history.length;
        }
        if (this.historyIndex > 0) {
            this.history[this.historyIndex] = new Uint8ClampedArray(
                this.buffer
            );
            this.historyIndex--;
            this.buffer = this.history[this.historyIndex];
            this.markUpdate();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.buffer = this.history[this.historyIndex];
            this.markUpdate();
        }
    }
}

const generateImageVertices = (currentImage) => [
    0,
    0,

    0,
    currentImage.height,

    currentImage.width,
    0,

    currentImage.width,
    currentImage.height,
];
