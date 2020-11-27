import { vec3 } from 'gl-matrix';

import getWindowManager from './windowManager';
import type { Widget } from './widget';
import { DisplayType, AppState } from './appState';

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

const handleMouseDown = (
    widget: Widget,
    e: MouseEvent,
    relativePosition: vec3
) => {
    widget.handleMouseDown(e, relativePosition);
};

const handleMouseUp = (
    widget: Widget,
    e: MouseEvent,
    relativePosition: vec3
) => {
    widget.handleMouseUp(e, relativePosition);
};

const handleMouseMove = (
    widget: Widget,
    e: MouseEvent,
    relativePosition: vec3
) => {
    widget.handleMouseMove(e, relativePosition);
};

const handlePointerDown = (
    widget: Widget,
    e: PointerEvent,
    relativePosition: vec3
) => {
    if (e.pointerType === 'mouse') return; // TODO: use polyfill of some type so we can use these without mouse handlers
    e.preventDefault();
    widget.handlePointerDown(e, relativePosition);
};

const handlePointerUp = (
    widget: Widget,
    e: PointerEvent,
    relativePosition: vec3
) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    widget.handlePointerUp(e, relativePosition);
};

const handlePointerMove = (
    widget: Widget,
    e: PointerEvent,
    relativePosition: vec3
) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    widget.handlePointerMove(e, relativePosition);
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

const registerMouseRelativeHandler = (
    msg: string,
    fn: (w: Widget, e: Event, relativePosition: vec3) => void
) => {
    registerEventHandler(msg, (e: MouseEvent) => {
        const currentMousePosition = mouseEventToVec3(e);
        const widget = getWindowManager().getWidgetAtPosition(
            currentMousePosition
        );
        if (widget) {
            const relativePosition = vec3.create();
            vec3.sub(relativePosition, currentMousePosition, widget.position);
            fn(widget, e, relativePosition);
        }
    });
};

const mouseEventToVec3 = (e: MouseEvent) => {
    const coord = vec3.create();
    vec3.set(coord, e.clientX, e.clientY, 0);
    return coord;
}

export default function registerEventHandlers(appState: AppState) {
    registerEventHandler('resize', handleResize);
    registerEventHandler('orientationchange', handleResize);

    registerEventHandler('wheel', handleWheel);
    registerMouseRelativeHandler('mousedown', handleMouseDown);
    registerMouseRelativeHandler('mouseup', handleMouseUp);
    registerMouseRelativeHandler('mousemove', handleMouseMove);

    // handles Wacom tablet

    registerMouseRelativeHandler('pointerdown', handlePointerDown);
    registerMouseRelativeHandler('pointerup', handlePointerUp);
    registerMouseRelativeHandler('pointermove', handlePointerMove);

    // iOS events

    registerEventHandler('ontouchdown', handleTouchDown);
    registerEventHandler('ontouchup', handleTouchUp);
    registerEventHandler('ontouchmove', handleTouchMove);

    // top bar UI
    registerEventHandler(
        'click',
        () => (appState.showColorWheel = !appState.showColorWheel),
        document.getElementsByClassName('brush-color')[0]
    );

    registerEventHandler(
        'click',
        () => (appState.displayType = DisplayType.Texture),
        document.getElementById('2d-button')
    );

    registerEventHandler(
        'click',
        () => (appState.displayType = DisplayType.Mesh),
        document.getElementById('3d-button')
    );
}

export function registerEventHandler(
    msg: string,
    fn: EventListener,
    element: EventTarget = window
) {
    element.addEventListener(
        msg,
        (e: Event) => {
            fn(e);
            markDirty();
        },
        { passive: false }
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
