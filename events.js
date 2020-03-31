import { mat4, vec3 } from 'gl-matrix';

import { SCROLL_SCALE } from './constants';
import getWindowManager from './windowManager';

let imageDisplay = null;
const eventState = {
    mouseButtonsDown: [],
    lastMousePosition: vec3.create(),
};

const handleResize = () => {
    getWindowManager().viewportToWindow();
};

const handleWheel = (e) => {
    if (e.deltaY != 0) {
        let scaleFactor = 1;

        if (e.deltaY < 0) {
            scaleFactor /= -e.deltaY * SCROLL_SCALE;
        } else {
            scaleFactor *= e.deltaY * SCROLL_SCALE;
        }

        // Scale with mouse as origin
        const imageMousePos = imageDisplay.uiToImageCoordinates(
            eventState.lastMousePosition
        );
        mat4.translate(
            imageDisplay.imageMatrix,
            imageDisplay.imageMatrix,
            imageMousePos
        );
        mat4.scale(imageDisplay.imageMatrix, imageDisplay.imageMatrix, [
            scaleFactor,
            scaleFactor,
            1,
        ]);

        vec3.negate(imageMousePos, imageMousePos);
        mat4.translate(
            imageDisplay.imageMatrix,
            imageDisplay.imageMatrix,
            imageMousePos
        );
    }
};

const handleMouseDown = (e) => {
    eventState.mouseButtonsDown[e.button] = true;

    if (e.button === 1) {
        // MMV
        document.body.style.cursor = 'grab';
    }
};

const handleMouseUp = (e) => {
    eventState.mouseButtonsDown[e.button] = false;

    if (e.button === 1) {
        // MMV
        document.body.style.cursor = 'auto';
    }
};

const handleMouseMove = (e) => {
    const currentMousePosition = mouseEventToVec3(e);
    const delta = vec3.create();
    vec3.sub(delta, currentMousePosition, eventState.lastMousePosition);

    // if MMB is down
    if (eventState.mouseButtonsDown[1]) {
        let deltaMouse = imageDisplay.uiToImageCoordinates(
            currentMousePosition
        );
        let lastImageMousePos = imageDisplay.uiToImageCoordinates(
            eventState.lastMousePosition
        );
        mat4.sub(deltaMouse, deltaMouse, lastImageMousePos);
        mat4.translate(
            imageDisplay.imageMatrix,
            imageDisplay.imageMatrix,
            deltaMouse
        );
    }

    eventState.lastMousePosition = currentMousePosition;
};

const handleKeyup = (e) => {
    if (e.isComposing || e.keyCode === 229) {
        return;
    }

    if (e.keyCode === 79) {
        const fileSelector = document.getElementById('file-selector');
        fileSelector.click();
        fileSelector.addEventListener('change', function () {
            const file = this.files[0];

            if (!file.type.startsWith('image')) {
                throw new Error('file is not an image');
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                imageDisplay.load(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }
};

const mouseEventToVec3 = (e) => {
    const coord = vec3.create();
    vec3.set(coord, e.clientX, e.clientY, 0);
    return coord;
};

export default function registerEventHandlers(imgDsp) {
    imageDisplay = imgDsp;

    window.addEventListener('resize', handleResize);

    window.addEventListener('wheel', handleWheel);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    window.addEventListener('keyup', handleKeyup);
}
