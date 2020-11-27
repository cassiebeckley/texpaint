import { mat4, vec3 } from 'gl-matrix';
import getWindowManager from '../../windowManager';
import loadShaderProgram, { Shader } from '../../shaders';

import vertImageShader from '../../shaders/imageShader/vert.glsl';
import fragImageShader from '../../shaders/imageShader/frag.glsl';

import { SCROLL_SCALE } from '../../constants';
import Brush from '../../brush';
import { generateRectVerticesStrip, rectVerticesStripUV } from '../../primitives';
import { markDirty, registerEventHandler } from '../../events';
import Mesh from '../../mesh';

import { DisplayType, AppState } from '../../appState';
import Slate from '../../slate';

const eventState = {
    mouseButtonsDown: [],
    lastMousePosition: vec3.create(),
    lastPointerPosition: vec3.create(),
    pan: false,
    lastPanPosition: vec3.create(),
    lastPressure: 0,
    pointerDown: false, // TODO: distinguish pointers
    altKey: false,
};

const brushSize = 40.0;
const brushColor = vec3.create();
vec3.set(brushColor, 0, 0, 0);

export default class ImageDisplay {
    position: vec3;

    imagePositionBuffer: WebGLBuffer;
    imageMatrix: mat4;
    meshMatrix: mat4;

    imageShader: Shader;
    imageUVBuffer: WebGLBuffer; // TODO: share this with all rectangles?
    brush: Brush;

    appState: AppState;

    mesh: Mesh;

    slate: Slate;

    // texture:
    constructor(width: number, height: number, appState: AppState) {
        const gl = getWindowManager().gl;

        this.position = vec3.create();

        this.imagePositionBuffer = gl.createBuffer();

        this.imageMatrix = mat4.create();
        this.meshMatrix = mat4.create();

        this.imageShader = loadShaderProgram(
            gl,
            vertImageShader,
            fragImageShader
        );

        // TODO create texture for each layer (probably split layer into a class)

        this.imageUVBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.imageUVBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(rectVerticesStripUV),
            gl.STATIC_DRAW
        );

        this.slate = new Slate(width, height);
        this.brush = new Brush(brushSize, brushColor, 0.4, this.slate);

        this.mesh = null;

        this.appState = appState;


        registerEventHandler('keyup', (e: KeyboardEvent) =>
            this.handleKeyup(e)
        ); // TODO: figure out if we really want events here
        registerEventHandler('keydown', (e: KeyboardEvent) =>
            this.handleKeydown(e)
        );
    }

    isVisible() {
        return true;
    }

    getWidgetWidth() {
        return getWindowManager().canvas.width;
    }

    getWidgetHeight() {
        return getWindowManager().canvas.height;
    }

    drawTexture() {
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
            gl.bindBuffer(gl.ARRAY_BUFFER, this.imageUVBuffer);
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
        gl.bindTexture(gl.TEXTURE_2D, this.slate.texture);
        gl.uniform1i(this.imageShader.uniforms.uSampler, 0);

        {
            const offset = 0;
            const count = 4;
            gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
        }
    }

    drawMesh() {
        const gl = getWindowManager().gl;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        if (this.mesh) {
            this.mesh.draw(this.meshMatrix);
        }

        gl.disable(gl.DEPTH_TEST);
    }

    draw() {
        this.slate.uploadTexture();

        switch (this.appState.displayType) {
            case DisplayType.Texture:
                this.drawTexture();
                break;
            case DisplayType.Mesh:
                this.drawMesh();
                break;
        }
    }

    setMesh(mesh: Mesh) {
        mesh.setTexture(this.slate.texture);
        this.mesh = mesh;
    }

    resetImageTransform() {
        const windowManager = getWindowManager();
        const canvas = windowManager.canvas;
        const gl = windowManager.gl;

        //// initialize 2d image ////
        mat4.identity(this.imageMatrix);
        mat4.translate(this.imageMatrix, this.imageMatrix, [
            canvas.width / 2 - this.slate.width / 2,
            canvas.height / 2 - this.slate.height / 2,
            0,
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.imagePositionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(
                generateRectVerticesStrip(0, 0, this.slate.width, this.slate.height)
            ),
            gl.STATIC_DRAW
        );

        //// initialize mesh transform ////

        mat4.identity(this.meshMatrix);
        mat4.translate(this.meshMatrix, this.meshMatrix, [0.0, 0.0, -6.0]);
    }

    uiToImageCoordinates(uiCoord: vec3) {
        const imageCoord = vec3.create();
        const invImageMatrix = mat4.create();
        mat4.invert(invImageMatrix, this.imageMatrix);
        vec3.transformMat4(imageCoord, uiCoord, invImageMatrix);
        return imageCoord;
    }

    uiToMeshCoordinates(uiCoord) {
        // TODO: figure out wtf I'm trying to do
        const wm = getWindowManager();
        const canvas = wm.canvas;
        const clipCoords = vec3.create(); // TODO: optimization: minimize allocations
        vec3.set(
            clipCoords,
            uiCoord[0] / canvas.clientWidth,
            uiCoord[0] / canvas.clientHeight,
            0.0
        );

        const invProjectionMatrix = mat4.create();
        mat4.invert(invProjectionMatrix, wm.projectionMatrix);

        vec3.transformMat4(clipCoords, clipCoords, invProjectionMatrix);
        return clipCoords;
    }

    // event handlers
    handleWheel(deltaY: number) {
        if (deltaY != 0) {
            let scaleFactor = 1;

            if (deltaY < 0) {
                scaleFactor /= -deltaY * SCROLL_SCALE;
            } else {
                scaleFactor *= deltaY * SCROLL_SCALE;
            }

            switch (this.appState.displayType) {
                case DisplayType.Texture:
                    // Scale with mouse as origin
                    const imageMousePos = this.uiToImageCoordinates(
                        eventState.lastMousePosition
                    );
                    mat4.translate(
                        this.imageMatrix,
                        this.imageMatrix,
                        imageMousePos
                    );
                    mat4.scale(this.imageMatrix, this.imageMatrix, [
                        scaleFactor,
                        scaleFactor,
                        1,
                    ]);

                    vec3.negate(imageMousePos, imageMousePos);
                    mat4.translate(
                        this.imageMatrix,
                        this.imageMatrix,
                        imageMousePos
                    );
                    break;
                case DisplayType.Mesh: // TODO: scale from center of window
                    const meshMiddlePos = this.uiToMeshCoordinates([0, 0, 0]);
                    mat4.translate(
                        this.meshMatrix,
                        this.meshMatrix,
                        meshMiddlePos
                    );
                    // console.log(this.meshMatrix);

                    mat4.scale(this.meshMatrix, this.meshMatrix, [
                        scaleFactor,
                        scaleFactor,
                        scaleFactor,
                    ]);

                    vec3.negate(meshMiddlePos, meshMiddlePos);
                    mat4.translate(
                        this.meshMatrix,
                        this.meshMatrix,
                        meshMiddlePos
                    );
                    break;
            }
        }
    }

    handlePanStart(position: vec3) {
        eventState.pan = true;
        vec3.copy(eventState.lastPanPosition, position);
        document.body.style.cursor = 'grab';
    }

    handlePanStop() {
        eventState.pan = false;
        document.body.style.cursor = 'auto';
    }

    handlePanMove(position: vec3) {
        const delta = vec3.create();
        vec3.sub(delta, position, eventState.lastPanPosition);

        switch (this.appState.displayType) {
            case DisplayType.Texture:
                let deltaMouse = this.uiToImageCoordinates(position);
                let lastImageMousePos = this.uiToImageCoordinates(
                    eventState.lastMousePosition
                );
                vec3.sub(deltaMouse, deltaMouse, lastImageMousePos);
                mat4.translate(this.imageMatrix, this.imageMatrix, deltaMouse);
                break;
            case DisplayType.Mesh:
                const translation = vec3.create();
                vec3.scale(translation, delta, 0.005);
                translation[1] = translation[1] * -1;
                mat4.translate(this.meshMatrix, this.meshMatrix, translation);
                break;
        }

        vec3.copy(eventState.lastPanPosition, position);
    }

    handleMouseDown(e: MouseEvent, pos: vec3) {
        eventState.mouseButtonsDown[e.button] = true;

        if (
            e.button === 1 ||
            (eventState.mouseButtonsDown[0] && eventState.altKey)
        ) {
            // MMB
            this.handlePanStart(pos);
        }

        if (e.button === 0) {
            const imageCoord = this.uiToImageCoordinates(
                eventState.lastMousePosition
            );
            this.brush.startStroke(imageCoord, 1.0);
        }
    }

    handleMouseUp(e: MouseEvent) {
        eventState.mouseButtonsDown[e.button] = false;

        if (
            e.button === 1 ||
            (eventState.mouseButtonsDown[0] && eventState.altKey)
        ) {
            // MMB
            this.handlePanStop();
        } else if (e.button === 0) {
            const imageCoord = this.uiToImageCoordinates(
                eventState.lastMousePosition
            );
            this.brush.finishStroke(imageCoord, 1.0);
        }
    }

    handleMouseMove(e: MouseEvent, currentMousePosition: vec3) {
        const delta = vec3.create();
        vec3.sub(delta, currentMousePosition, eventState.lastMousePosition);

        // console.log(
        //     currentMousePosition,
        //     this.uiToMeshCoordinates(currentMousePosition)
        // );

        if (
            eventState.mouseButtonsDown[1] ||
            (eventState.mouseButtonsDown[0] && eventState.altKey)
        ) {
            // if MMB is down (pan)
            this.handlePanMove(currentMousePosition);
        } else if (eventState.mouseButtonsDown[0]) {
            // if LMB is down (draw)
            const imageCoord = this.uiToImageCoordinates(currentMousePosition);
            this.brush.continueStroke(imageCoord, 1.0);
        }

        eventState.lastMousePosition = currentMousePosition;
    }

    handlePointerDown(e: PointerEvent) {
        const imageCoord = this.uiToImageCoordinates(
            eventState.lastPointerPosition
        );
        this.brush.startStroke(imageCoord, e.pressure);
        eventState.pointerDown = true;
        eventState.lastPressure = e.pressure;
    }

    handlePointerUp(e: PointerEvent) {
        const imageCoord = this.uiToImageCoordinates(
            eventState.lastPointerPosition
        );
        this.brush.finishStroke(imageCoord, eventState.lastPressure);
        eventState.pointerDown = false;
    }

    handlePointerMove(e: PointerEvent, currentPointerPosition: vec3) {
        if (eventState.pointerDown) {
            const imageCoord = this.uiToImageCoordinates(
                currentPointerPosition
            );
            this.brush.continueStroke(imageCoord, e.pressure);
        }

        eventState.lastPointerPosition = currentPointerPosition;
        eventState.lastPressure = e.pressure;
    }

    handleAltDown() {
        eventState.altKey = true;
    }

    handleAltUp() {
        eventState.altKey = false;
    }

    handleKeyup(e: KeyboardEvent) {
        if (e.isComposing || e.keyCode === 229) {
            return;
        }

        if (e.keyCode === 79) {
            const fileSelector = <HTMLInputElement>(
                document.getElementById('file-selector')
            );
            fileSelector.click();

            const imageDisplay = this;

            fileSelector.addEventListener('change', function () {
                const file = this.files[0];
                const reader = new FileReader();

                if (file.type.startsWith('image')) {
                    reader.onload = (e: ProgressEvent<FileReader>) => {
                        imageDisplay.slate.load(<string>e.target.result);
                        imageDisplay.resetImageTransform();
                    };
                    reader.readAsDataURL(file);
                } else if (file.name.endsWith('.obj')) {
                    reader.onload = (e: ProgressEvent<FileReader>) => {
                        const meshes = Mesh.fromWaveformObj(
                            <string>e.target.result
                        );
                        console.log(meshes[0]);
                        imageDisplay.setMesh(meshes[0]);
                    };
                    reader.readAsBinaryString(file);
                } else {
                    throw new Error('unsupported file format');
                }
            });
        }

        if (e.key === 'Alt') {
            this.handleAltUp();
        }
    }

    handleKeydown(e: KeyboardEvent) {
        if (e.isComposing || e.keyCode === 229) {
            return;
        }

        // Z
        if (e.keyCode === 90 && e.ctrlKey) {
            if (e.shiftKey) {
                this.slate.redo();
            } else {
                this.slate.undo();
            }
        }

        // R
        if (e.keyCode === 82 && e.ctrlKey) {
            this.slate.redo();
        }

        if (e.key === 'Alt') {
            this.handleAltDown();
        }
    }
}
