import { mat4, vec3 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useRef, useState } from 'react';
import { SCROLL_SCALE } from '../constants';
import { normalizeWheelEvent } from '../utils';
import { getModelViewMatrix } from '../widgets/textureDisplay';
import Widget, { WindowContext } from './Widget';

const BINARY_LEFT_MOUSE_BUTTON = 0b1;
const BINARY_MIDDLE_MOUSE_BUTTON = 0b10;
const BINARY_RIGHT_MOUSE_BUTTON = 0b100;

export default function TexturePaint() {
    const windowManager = useContext(WindowContext);

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState(vec3.create());
    const [pan, setPan] = useState(false);
    const [lastPanPosition, setLastPanPosition] = useState(vec3.create());

    const [cursorPosition, setCursorPosition] = useState(vec3.create());
    const [pressure, setPressure] = useState(1.0);

    const [uv, setUV] = useState(false);

    const div = useRef(null);

    const uiToImageCoordinates = (uiCoord: vec3) => {
        const widgetBounds = div.current.getBoundingClientRect();

        const modelViewMatrix = getModelViewMatrix(
            windowManager.slate,
            widgetBounds.width,
            widgetBounds.height,
            scale,
            position
        );
        const invModelViewMatrix = mat4.create();
        mat4.invert(invModelViewMatrix, modelViewMatrix);

        const imageCoord = vec3.create();
        vec3.transformMat4(imageCoord, uiCoord, invModelViewMatrix);
        vec3.mul(imageCoord, imageCoord, [
            windowManager.slate.width,
            windowManager.slate.height,
            1,
        ]);

        return imageCoord;
    };

    const handleWheel = (e: WheelEvent) => {
        let deltaY = normalizeWheelEvent(e);

        if (deltaY < 0) {
            setScale(scale / (-deltaY * SCROLL_SCALE));
        } else {
            setScale(scale * (deltaY * SCROLL_SCALE));
        }
    };

    const handlePanStart = (panPosition: vec3) => {
        setPan(true);
        setLastPanPosition(vec3.clone(panPosition));
    };

    const handlePanStop = () => {
        setPan(false);
    };

    const handlePanMove = (panPosition: vec3) => {
        let deltaMouse = uiToImageCoordinates(panPosition);
        let lastImageMousePos = uiToImageCoordinates(lastPanPosition);
        vec3.sub(deltaMouse, deltaMouse, lastImageMousePos);
        vec3.add(deltaMouse, deltaMouse, position);
        setPosition(deltaMouse);

        setLastPanPosition(vec3.clone(panPosition));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            handlePanStart(coords);
        } else if (e.button === 0) {
            const imageCoords = uiToImageCoordinates(coords);
            windowManager.brushEngine.startStroke(imageCoords, e.pressure);
            setPressure(e.pressure);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (pan) {
            handlePanStop();
        } else if (e.button === 0) {
            const imageCoords = uiToImageCoordinates(coords);
            windowManager.brushEngine.finishStroke(imageCoords, e.pressure);
            setPressure(1);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        setCursorPosition(coords);

        if (pan) {
            handlePanMove(coords);
        } else if (e.buttons & BINARY_LEFT_MOUSE_BUTTON) {
            const imageCoords = uiToImageCoordinates(coords);
            windowManager.brushEngine.continueStroke(imageCoords, e.pressure);
            setPressure(e.pressure);
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        handlePanStop();
        const p = vec3.create();
        vec3.set(p, -100, -100, 0);
        setCursorPosition(p);
    };

    return (
        <div style={{ flexGrow: 1 }} ref={div}>
            <Widget
                type="TextureDisplay"
                widgetProps={{ scale, position, drawUVMap: uv }}
                style={{
                    height: '100%',
                    position: 'relative',
                    cursor: pan ? 'grabbing' : 'none',
                }}
                zindex={-1}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
            >
                <div>
                    <input
                        type="checkbox"
                        id="uv"
                        checked={uv}
                        onChange={(e) => setUV(e.target.checked)}
                    />
                    <label htmlFor="uv">Show UV Map</label>
                </div>
                <Cursor
                    position={cursorPosition}
                    radius={
                        windowManager.brushEngine.getRadiusForStroke(
                            windowManager.brushEngine.radius,
                            { pressure }
                        ) * scale
                    }
                />
                {/* TODO: make this come from UI state rather than the brush engine (not watched by React) */}
            </Widget>
        </div>
    );
}

const Cursor = ({ position, radius }) => {
    return (
        <div
            style={{
                position: 'absolute',
                left: position[0] - radius,
                top: position[1] - radius,
                width: radius * 2,
                height: radius * 2,
                border: '1px solid #7f7f7f',
                borderRadius: '50%',
                zIndex: -1,
            }}
        ></div>
    );
};
