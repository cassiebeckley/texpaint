import { mat4, vec3 } from 'gl-matrix';

import getWindowManager from './windowManager';

let _dirty = false;

let imageDisplay = null;

const handleResize = () => {
    getWindowManager().viewportToWindow();
};

const handleWheel = (e) => {
    imageDisplay.handleWheel(e.deltaY);
};

const handleMouseDown = (e) => {
    imageDisplay.handleMouseDown(e.button);
};

const handleMouseUp = (e) => {
    imageDisplay.handleMouseUp(e.button);
};

const handleMouseMove = (e) => {
    const currentMousePosition = mouseEventToVec3(e);
    imageDisplay.handleMouseMove(currentMousePosition);
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

const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    imageDisplay.handlePointerDown(e);
};

const handlePointerUp = (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    imageDisplay.handlePointerUp(e);
};

const handlePointerMove = (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    imageDisplay.handlePointerMove(currentPointerPosition, e);
};

const mouseEventToVec3 = (e) => {
    const coord = vec3.create();
    vec3.set(coord, e.clientX, e.clientY, 0);
    return coord;
};

const registerEventHandler = (msg, fn) => {
    window.addEventListener(msg, (e) => {
        _dirty = true;
        fn(e);
    });
};

export default function registerEventHandlers(imgDsp) {
    imageDisplay = imgDsp;

    registerEventHandler('resize', handleResize);

    registerEventHandler('wheel', handleWheel);
    registerEventHandler('mousedown', handleMouseDown);
    registerEventHandler('mouseup', handleMouseUp);
    registerEventHandler('mousemove', handleMouseMove);

    registerEventHandler('keyup', handleKeyup);

    registerEventHandler('pointerdown', handlePointerDown);
    registerEventHandler('pointerup', handlePointerUp);
    registerEventHandler('pointermove', handlePointerMove);
}

export function dirty() {
    // TODO: probably something more like React, only updating if state has changed
    if (_dirty) {
        _dirty = false;
        return true;
    }

    return false;
}
