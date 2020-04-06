import { mat4, vec3 } from 'gl-matrix';

import getWindowManager from './windowManager';
import type ImageDisplay from './imageDisplay';
import type ColorSelect from './colorSelect';
import { inBounds } from './widget';
import Mesh from './mesh';

let _dirty = true;

let imageDisplay: ImageDisplay = null;
let colorSelect: ColorSelect = null;

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

const handleResize = () => {
    getWindowManager().viewportToWindow();
};

const handleWheel = (e) => {
    e.preventDefault();
    let amount = e.deltaY;

    switch (e.deltaMode) {
        case DOM_DELTA_PIXEL:
            amount /= 100;
            break;
        case DOM_DELTA_LINE:
            amount /= 3;
            break;
        case DOM_DELTA_PAGE:
            amount *= document.body.clientHeight;
            amount /= 100;
            break;
    }

    imageDisplay.handleWheel(amount);
};

// TODO: abstraction layer that polyfills Pointer API

const handleMouseDown = (e) => {
    const currentMousePosition = mouseEventToVec3(e);
    if (inBounds(colorSelect, currentMousePosition) && colorSelect.display) {
        colorSelect.handleMouseDown(e.button);
    } else {
        imageDisplay.handleMouseDown(e.button, currentMousePosition);
    }
};

const handleMouseUp = (e) => {
    const currentMousePosition = mouseEventToVec3(e);
    if (inBounds(colorSelect, currentMousePosition) && colorSelect.display) {
        colorSelect.handleMouseUp(e.button, currentMousePosition);
    } else {
        imageDisplay.handleMouseUp(e.button);
    }
};

const handleMouseMove = (e) => {
    const currentMousePosition = mouseEventToVec3(e);
    if (inBounds(colorSelect, currentMousePosition) && colorSelect.display) {
        colorSelect.handleMouseMove(currentMousePosition);
    } else {
        imageDisplay.handleMouseMove(currentMousePosition);
    }
};

const handleKeyup = (e) => {
    if (e.isComposing || e.keyCode === 229) {
        return;
    }

    if (e.keyCode === 79) {
        const fileSelector = <HTMLInputElement>(
            document.getElementById('file-selector')
        );
        fileSelector.click();
        fileSelector.addEventListener('change', function () {
            const file = this.files[0];
            const reader = new FileReader();

            if (file.type.startsWith('image')) {
                reader.onload = (e) => {
                    imageDisplay.load(<string>e.target.result);
                };
                reader.readAsDataURL(file);
            } else if (file.name.endsWith('.obj')) {
                reader.onload = (e) => {
                    const mesh = Mesh.fromWaveformObj(<string>e.target.result);
                    console.log(mesh);
                };
                reader.readAsBinaryString(file);
            } else {
                throw new Error('unsupported file format');
            }
        });
    }

    if (e.key === 'Alt') {
        imageDisplay.handleAltUp();
    }
};

const handleKeydown = (e) => {
    if (e.isComposing || e.keyCode === 229) {
        return;
    }

    // Z
    if (e.keyCode === 90 && e.ctrlKey) {
        if (e.shiftKey) {
            imageDisplay.redo();
        } else {
            imageDisplay.undo();
        }
    }

    // R
    if (e.keyCode === 82 && e.ctrlKey) {
        imageDisplay.redo();
    }

    if (e.key === 'Alt') {
        imageDisplay.handleAltDown();
    }
};

const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    if (inBounds(colorSelect, currentPointerPosition) && colorSelect.display) {
        colorSelect.handleMouseDown(e);
    } else {
        imageDisplay.handlePointerDown(e);
    }
};

const handlePointerUp = (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    if (inBounds(colorSelect, currentPointerPosition) && colorSelect.display) {
        colorSelect.handleMouseUp(e, currentPointerPosition);
    } else {
        imageDisplay.handlePointerUp(e);
    }
};

const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    if (inBounds(colorSelect, currentPointerPosition) && colorSelect.display) {
        colorSelect.handleMouseMove(currentPointerPosition);
    } else {
        imageDisplay.handlePointerMove(currentPointerPosition, e);
    }
};

const handleTouchDown = (e) => {
    e.preventDefault();
    imageDisplay.handlePointerDown(e);
};

const handleTouchUp = (e) => {
    e.preventDefault();
    imageDisplay.handlePointerUp(e);
};

const handleTouchMove = (e) => {
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    imageDisplay.handlePointerMove(currentPointerPosition, e);
};

const mouseEventToVec3 = (e) => {
    const coord = vec3.create();
    vec3.set(coord, e.clientX, e.clientY, 0);
    return coord;
};

const registerEventHandler = (msg, fn, element: EventTarget = window) => {
    element.addEventListener(
        msg,
        (e) => {
            fn(e);
            markDirty();
        },
        { passive: false }
    );
};

export default function registerEventHandlers(
    imgDsp: ImageDisplay,
    clrSct: ColorSelect
) {
    imageDisplay = imgDsp;
    colorSelect = clrSct;

    registerEventHandler('resize', handleResize);
    registerEventHandler('orientationchange', handleResize);

    registerEventHandler('wheel', handleWheel);
    registerEventHandler('mousedown', handleMouseDown);
    registerEventHandler('mouseup', handleMouseUp);
    registerEventHandler('mousemove', handleMouseMove);

    registerEventHandler('keyup', handleKeyup);
    registerEventHandler('keydown', handleKeydown);

    // handles Wacom tablet

    registerEventHandler('pointerdown', handlePointerDown);
    registerEventHandler('pointerup', handlePointerUp);
    registerEventHandler('pointermove', handlePointerMove);

    // iOS events

    registerEventHandler('ontouchdown', handleTouchDown);
    registerEventHandler('ontouchup', handleTouchUp);
    registerEventHandler('ontouchmove', handleTouchMove);

    // top bar UI
    registerEventHandler(
        'click',
        () => clrSct.toggle(),
        document.getElementsByClassName('brush-color')[0]
    );
}

export function markDirty() {
    _dirty = true;
    getWindowManager().drawOnNextTick();
}

export function dirty() {
    // TODO: probably something more like React, only updating if state has changed
    if (_dirty) {
        _dirty = false;
        return true;
    }

    return false;
}
