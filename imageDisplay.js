import { mat4, vec3 } from 'gl-matrix';
import getWindowManager from './windowManager';
import loadShaderProgram from './shaders';

import vertImageShader from './shaders/imageShader/vert.glsl';
import fragImageShader from './shaders/imageShader/frag.glsl';

const imageTexturePositions = [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0];

let shaders = {};

export default class ImageDisplay {
    constructor(width, height) {
        const gl = getWindowManager().gl;

        const buffer = new Uint8ClampedArray(width * height * 4);

        buffer.fill(255);

        this.width = width;
        this.height = height;
        this.buffer = buffer;
        this.texture = gl.createTexture();
        this.imagePositionBuffer = gl.createBuffer();
        this.imageMatrix = mat4.create();
        this.gl = gl;
        this.shaders = gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        this.imageShader = loadShaderProgram(
            gl,
            vertImageShader,
            fragImageShader
        );

        this.imageTextureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.imageTextureBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(imageTexturePositions),
            gl.STATIC_DRAW
        );
    }

    draw() {
        const windowManager = getWindowManager();
        const gl = windowManager.gl;

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

            this.swapBuffer();
            this.resetImageTransform();
        });
        tempImg.src = url;
    }

    swapBuffer() {
        // upload texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const width = this.width;
        const height = this.height;
        const border = 0;
        const srcFormat = this.gl.RGBA;
        const srcType = this.gl.UNSIGNED_BYTE;
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
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
        const canvas = getWindowManager().canvas;

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.imagePositionBuffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            new Float32Array(generateImageVertices(this)),
            this.gl.STATIC_DRAW
        );

        //// initialize 2d image ////
        mat4.identity(this.imageMatrix);
        mat4.translate(this.imageMatrix, this.imageMatrix, [
            canvas.width / 2 - this.width / 2,
            canvas.height / 2 - this.height / 2,
            0,
        ]);
    }

    uiToImageCoordinates(uiCoord) {
        const imageCoord = vec3.create();
        const invImageMatrix = mat4.create();
        mat4.invert(invImageMatrix, this.imageMatrix);
        vec3.transformMat4(imageCoord, uiCoord, invImageMatrix);
        return imageCoord;
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
