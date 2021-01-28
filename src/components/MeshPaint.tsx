import { mat3, mat4, quat, vec2, vec3, vec4 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useRef, useState } from 'react';
import {
    FAR,
    FIELD_OF_VIEW,
    NEAR,
    ROTATE_SENSITIVITY,
    SCROLL_SCALE,
} from '../constants';
import { normalizeWheelEvent } from '../utils';
import MeshDisplay, { getProjection, getView } from '../widgets/meshDisplay';
import Widget, { WindowContext } from './Widget';
import BackgroundSettings from './BackgroundSettings';

const BINARY_LEFT_MOUSE_BUTTON = 0b1;
const BINARY_MIDDLE_MOUSE_BUTTON = 0b10;
const BINARY_RIGHT_MOUSE_BUTTON = 0b100;

const WORLD_UP = vec3.create();
vec3.set(WORLD_UP, 0, 1, 0);

const WORLD_FORWARD = vec3.create();
vec3.set(WORLD_FORWARD, 0, 0, 1);

const CAMERA_PAN_SENSITIVITY = 0.003;

export default function MeshPaint({}) {
    const [scale, setScale] = useState(1);

    const [rotation, setRotation] = useState(quat.create());
    const [rotating, setRotating] = useState(false);
    const [lastRotatePosition, setLastRotatePosition] = useState(vec3.create());

    const [backgroundOffset, setBackgroundOffset] = useState(0);
    const [rotatingBackground, setRotatingBackground] = useState(false);
    const [lastBackgroundOffset, setLastBackgroundOffset] = useState(0);

    const [preventContext, setPreventContext] = useState(false);

    const [position, setPosition] = useState(vec3.create());
    const [pan, setPan] = useState(false);
    const [lastPanPosition, setLastPanPosition] = useState(vec3.create());

    const [paintPoint, setPaintPoint] = useState(null);
    const [paintNormal, setPaintNormal] = useState(null);
    const [pressure, setPressure] = useState(1.0);

    const div = useRef(null);

    const windowManager = useContext(WindowContext);
    const scene = windowManager.scene;

    const handleWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) {
            return;
        }

        let deltaY = normalizeWheelEvent(e);

        if (deltaY < 0) {
            setScale(scale * (-deltaY * SCROLL_SCALE));
        } else {
            setScale(scale / (deltaY * SCROLL_SCALE));
        }
    };

    const handleRotateStart = (rotatePosition: vec3) => {
        setRotating(true);
        setLastRotatePosition(vec3.clone(rotatePosition));
    };

    const handleRotateStop = () => {
        setRotating(false);
    };

    const handleRotateMove = (rotatePosition: vec3) => {
        let deltaRotation = vec3.create();
        vec3.sub(deltaRotation, lastRotatePosition, rotatePosition);
        vec3.scale(deltaRotation, deltaRotation, -ROTATE_SENSITIVITY);

        const newRotation = quat.create();

        const localX = quat.create();
        const globalY = quat.create();

        const m = mat3.create();
        const mInv = mat3.create();

        mat3.fromQuat(m, rotation);
        mat3.invert(mInv, m);

        const xAxis = vec3.create();
        vec3.set(xAxis, mInv[0], mInv[1], mInv[2]);

        quat.setAxisAngle(localX, xAxis, deltaRotation[1]);
        quat.mul(localX, rotation, localX);

        quat.setAxisAngle(globalY, WORLD_UP, deltaRotation[0]);
        quat.mul(newRotation, localX, globalY);

        setRotation(newRotation);

        setLastRotatePosition(vec3.clone(rotatePosition));
    };

    const handleRotateBackgroundStart = (x: number) => {
        setRotatingBackground(true);
        setLastBackgroundOffset(x);
    };

    const handleRotateBackgroundStop = () => {
        setRotatingBackground(false);
    };

    const handleRotateBackgroundMove = (x: number) => {
        const deltaAngle = (lastBackgroundOffset - x) * -ROTATE_SENSITIVITY;

        setBackgroundOffset(backgroundOffset + deltaAngle);
        setLastBackgroundOffset(x);

        if (!preventContext) {
            setPreventContext(true);
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
        const delta = vec3.create();
        vec3.sub(delta, panPosition, lastPanPosition);
        vec3.scale(delta, delta, CAMERA_PAN_SENSITIVITY);
        vec3.mul(delta, delta, [1, -1, 1]);

        vec3.add(delta, delta, position);
        setPosition(delta);

        setLastPanPosition(vec3.clone(panPosition));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            if (e.shiftKey) {
                handlePanStart(coords);
            } else {
                handleRotateStart(coords);
            }
        } else if (e.button === 0 && paintPoint) {
            windowManager.brushEngine.startStroke3D(
                [coords[0], coords[1]],
                e.pressure
            );
            setPressure(e.pressure);
        } else if (e.button === 2) {
            handleRotateBackgroundStart(e.clientX);
        }
    };

    const getPaintPoint = (coords: vec2) => {
        const widgetBounds = div.current.getBoundingClientRect(); // TODO: see if caching this helps performance

        const view = mat4.create();
        const proj = mat4.create();
        getView(view, position, rotation, scale);
        getProjection(proj, widgetBounds.width, widgetBounds.height);

        const invView = mat4.create();
        mat4.invert(invView, view);

        const invProjView = mat4.create();
        mat4.mul(invProjView, proj, view);
        mat4.invert(invProjView, invProjView);

        const ndcX = ((coords[0] + 0.5) / widgetBounds.width) * 2 - 1;
        const ndcY = -(((coords[1] + 0.5) / widgetBounds.height) * 2 - 1);

        const camOrigin = vec3.create();
        vec3.transformMat4(camOrigin, camOrigin, invView);

        const rayBase = vec4.create();
        vec4.set(
            rayBase,
            ndcX * (FAR - NEAR),
            ndcY * (FAR - NEAR),
            FAR + NEAR,
            FAR - NEAR
        );
        vec4.transformMat4(rayBase, rayBase, invProjView);

        const camDirection = vec3.create();
        vec3.set(camDirection, rayBase[0], rayBase[1], rayBase[2]);
        vec3.normalize(camDirection, camDirection);

        if (scene.meshes.length > 0) {
            let closest = Infinity;
            const point = vec3.create();
            const normal = vec3.create();

            for (let i = 0; i < scene.meshes.length; i++) {
                const currentPoint = vec3.create();
                const currentNormal = vec3.create();

                const intersection = scene.meshes[i].raycast(
                    currentPoint,
                    currentNormal,
                    camOrigin,
                    camDirection
                );
                if (intersection > 0 && intersection < closest) {
                    closest = intersection;
                    vec3.copy(point, currentPoint);
                    vec3.copy(normal, currentNormal);
                }
            }

            if (isFinite(closest)) {
                setPaintPoint(point);
                setPaintNormal(normal);

                return point;
            } else {
                setPaintPoint(null);
                setPaintNormal(null);
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (rotating) {
            handleRotateStop();
        } else if (pan) {
            handlePanStop();
        } else if (e.button === 0) {
            windowManager.brushEngine.finishStroke3D(
                [coords[0], coords[1]],
                e.pressure,
                getPaintPoint
            );
            setPressure(1);
        } else if (rotatingBackground) {
            handleRotateBackgroundStop();
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (e.buttons & BINARY_LEFT_MOUSE_BUTTON) {
            windowManager.brushEngine.continueStroke3D(
                [coords[0], coords[1]],
                e.pressure,
                getPaintPoint
            );
            setPressure(e.pressure);
        } else {
            getPaintPoint([coords[0], coords[1]]);
        }

        if (rotating) {
            handleRotateMove(coords);
        } else if (pan) {
            handlePanMove(coords);
        } else if (rotatingBackground) {
            handleRotateBackgroundMove(e.clientX);
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        handleRotateStop();
        handlePanStop();
        handleRotateBackgroundStop();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (preventContext) {
            e.preventDefault();
            setPreventContext(false);
        }
    };

    let cursor = 'auto';

    if (rotating) {
        cursor = 'move';
    } else if (pan) {
        cursor = 'grabbing';
    }

    const rotationMatrix = mat4.create();
    mat4.fromQuat(rotationMatrix, rotation);

    return (
        <div style={{ flexGrow: 1 }} ref={div}>
            <Widget
                constructor={MeshDisplay}
                widgetProps={{
                    position,
                    rotation,
                    scale,
                    brushCursor: paintPoint,
                    brushNormal: paintNormal,
                    brushRadius: windowManager.brushEngine.getRadiusForStroke({
                        pressure,
                    }),
                    backgroundOffset,
                }}
                style={{ height: '100%', cursor, position: 'relative' }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onContextMenu={handleContextMenu}
            >
                <div
                    style={{
                        position: 'absolute',
                        right: '20px',
                        bottom: '20px',
                        top: '20px',
                        width: '150px',
                    }}
                >
                    <BackgroundSettings
                        rotation={rotationMatrix}
                        backgroundOffset={backgroundOffset}
                        setBackgroundOffset={setBackgroundOffset}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '0px',
                            width: '100%',
                            height: '150px',
                            backgroundColor: 'red',
                        }}
                    ></div>
                </div>
            </Widget>
        </div>
    );
}
