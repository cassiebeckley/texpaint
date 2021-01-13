import { mat4, vec2, vec3 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useRef, useState } from 'react';
import { SCROLL_SCALE } from '../constants';
import { normalizeWheelEvent } from '../utils';
import TextureDisplay, { getModelMatrix } from '../widgets/textureDisplay';
import Widget, { WindowContext } from './Widget';

const BINARY_LEFT_MOUSE_BUTTON = 0b1;
const BINARY_MIDDLE_MOUSE_BUTTON = 0b10;
const BINARY_RIGHT_MOUSE_BUTTON = 0b100;

export default function TexturePaint() {
    const windowManager = useContext(WindowContext);

    const [view, setView] = useState(() => {
        const viewMatrix = mat4.create();
        mat4.identity(viewMatrix);
        return viewMatrix;
    });

    const [pan, setPan] = useState(false);
    const [lastPanPosition, setLastPanPosition] = useState(vec2.create());

    const [cursorPosition, setCursorPosition] = useState(vec2.create());
    const [pressure, setPressure] = useState(1.0);

    const [uv, setUV] = useState(false);

    const div = useRef(null);

    const uiToImageCoordinates = (uiCoord: vec2) => {
        const modelMatrix = getModelMatrix(
            windowManager.slate.width,
            windowManager.slate.height
        );

        const modelViewMatrix = mat4.create();
        mat4.mul(modelViewMatrix, view, modelMatrix);

        const invModelViewMatrix = mat4.create();
        mat4.invert(invModelViewMatrix, modelViewMatrix);

        const imageCoord = vec2.create();
        vec2.transformMat4(imageCoord, uiCoord, invModelViewMatrix);
        vec2.mul(imageCoord, imageCoord, [
            windowManager.slate.width,
            windowManager.slate.height,
        ]);

        return imageCoord;
    };

    const handleWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) {
            return;
        }

        let deltaY = normalizeWheelEvent(e);

        let scale = 1;

        if (deltaY < 0) {
            scale = 1 / (-deltaY * SCROLL_SCALE);
        } else {
            scale = deltaY * SCROLL_SCALE;
        }

        const imageCoords = uiToImageCoordinates(cursorPosition);

        let scaled = mat4.create();
        mat4.translate(scaled, view, [imageCoords[0], imageCoords[1], 0]);
        mat4.scale(scaled, scaled, [scale, scale, scale]);
        mat4.translate(scaled, scaled, [-imageCoords[0], -imageCoords[1], 0]);

        setView(scaled);
    };

    const handlePanStart = (panPosition: vec2) => {
        setPan(true);
        setLastPanPosition(vec2.clone(panPosition));
    };

    const handlePanStop = () => {
        setPan(false);
    };

    const handlePanMove = (panPosition: vec2) => {
        let deltaMouse = uiToImageCoordinates(panPosition);
        let lastImageMousePos = uiToImageCoordinates(lastPanPosition);
        vec2.sub(deltaMouse, deltaMouse, lastImageMousePos);

        const panned = mat4.create();
        mat4.translate(panned, view, [deltaMouse[0], deltaMouse[1], 0]);

        setView(panned);
        setLastPanPosition(vec2.clone(panPosition));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const coords = vec2.create();
        vec2.set(coords, e.clientX, e.clientY);

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            handlePanStart(coords);
        } else if (e.button === 0) {
            const imageCoords = uiToImageCoordinates(coords);
            windowManager.brushEngine.startStroke(imageCoords, e.pressure);
            setPressure(e.pressure);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const coords = vec2.create();
        vec2.set(coords, e.clientX, e.clientY);

        if (pan) {
            handlePanStop();
        } else if (e.button === 0) {
            const imageCoords = uiToImageCoordinates(coords);
            windowManager.brushEngine.finishStroke(imageCoords, e.pressure);
            setPressure(1);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const coords = vec2.create();
        vec2.set(coords, e.clientX, e.clientY);

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
        const p = vec2.create();
        vec2.set(p, -100, -100);
        setCursorPosition(p);
    };

    const scaling = vec3.create();
    mat4.getScaling(scaling, view);
    const scale = scaling[0];

    return (
        <div style={{ flexGrow: 1 }} ref={div}>
            <Widget
                constructor={TextureDisplay}
                widgetProps={{ view, drawUVMap: uv }}
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
