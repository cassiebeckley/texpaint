import { vec3 } from 'gl-matrix';

import getWindowManager from './windowManager';
import { DisplayType, SlateState } from './slate';

let _dirty = true;

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

const handleResize = () => {
    getWindowManager().viewportToWindow();
};

const handleWheel = (e: WheelEvent) => {
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

    getWindowManager().getDefaultWidget().handleWheel(amount);
};

// TODO: abstraction layer that polyfills Pointer API

const handleMouseDown = (e: MouseEvent) => {
    const currentMousePosition = mouseEventToVec3(e);
    const widget = getWindowManager().getWidgetAtPosition(currentMousePosition);
    if (widget) {
        widget.handleMouseDown(e);
    }
};

const handleMouseUp = (e: MouseEvent) => {
    const currentMousePosition = mouseEventToVec3(e);
    const widget = getWindowManager().getWidgetAtPosition(currentMousePosition);
    if (widget) {
        widget.handleMouseUp(e);
    }
};

const handleMouseMove = (e: MouseEvent) => {
    const currentMousePosition = mouseEventToVec3(e);
    const widget = getWindowManager().getWidgetAtPosition(currentMousePosition);
    if (widget) {
        widget.handleMouseMove(e);
    }
};

const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return; // TODO: use polyfill of some type so we can use these without mouse handlers
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    const widget = getWindowManager().getWidgetAtPosition(currentPointerPosition);
    if (widget) {
        widget.handlePointerDown(e);
    }
};

const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    const widget = getWindowManager().getWidgetAtPosition(currentPointerPosition);
    if (widget) {
        widget.handlePointerUp(e);
    }
};

const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const currentPointerPosition = mouseEventToVec3(e);
    const widget = getWindowManager().getWidgetAtPosition(currentPointerPosition);
    if (widget) {
        widget.handlePointerMove(e);
    }
};

const handleTouchDown = (e: TouchEvent) => {
    e.preventDefault();
    // imageDisplay.handlePointerDown(e);
    // TODO: fix this
};

const handleTouchUp = (e: TouchEvent) => {
    e.preventDefault();
    // imageDisplay.handlePointerUp(e);
    // TODO: fix this
};

const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    // const currentPointerPosition = mouseEventToVec3(e);
    throw new Error("Woops not sure what's happening here"); // TODO: this is temporary; fix
    // imageDisplay.handlePointerMove(currentPointerPosition, e);
};

export default function registerEventHandlers(
    slateState: SlateState
) {
    registerEventHandler('resize', handleResize);
    registerEventHandler('orientationchange', handleResize);

    registerEventHandler('wheel', handleWheel);
    registerEventHandler('mousedown', handleMouseDown);
    registerEventHandler('mouseup', handleMouseUp);
    registerEventHandler('mousemove', handleMouseMove);

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
        () => slateState.showColorWheel = !slateState.showColorWheel,
        document.getElementsByClassName('brush-color')[0]
    );

    registerEventHandler(
        'click',
        () => slateState.displayType = DisplayType.Texture,
        document.getElementById('2d-button')
    );

    registerEventHandler(
        'click',
        () => slateState.displayType = DisplayType.Mesh,
        document.getElementById('3d-button')
    );
}

export function registerEventHandler(msg: string, fn: EventListener, element: EventTarget = window) {
    element.addEventListener(
        msg,
        (e: Event) => {
            fn(e);
            markDirty();
        },
        { passive: false }
    );
};

export function mouseEventToVec3(e: MouseEvent) {
    const coord = vec3.create();
    vec3.set(coord, e.clientX, e.clientY, 0);
    return coord;
};

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
