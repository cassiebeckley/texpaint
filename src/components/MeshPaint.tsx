import { mat3, quat, vec3 } from 'gl-matrix';
import * as React from 'react';
import { useState } from 'react';
import { ROTATE_SENSITIVITY, SCROLL_SCALE } from '../constants';
import { normalizeWheelEvent } from '../utils';
import Widget from './Widget';

const WORLD_UP = vec3.create();
vec3.set(WORLD_UP, 0, 1, 0);

const CAMERA_PAN_SENSITIVITY = 0.003;

export default function MeshPaint({ mesh }) {
    const [scale, setScale] = useState(1);

    const [rotation, setRotation] = useState(quat.create());
    const [rotating, setRotating] = useState(false);
    const [lastRotatePosition, setLastRotatePosition] = useState(vec3.create());

    const [position, setPosition] = useState(vec3.create());
    const [pan, setPan] = useState(false);
    const [lastPanPosition, setLastPanPosition] = useState(vec3.create());

    const handleWheel = (e: WheelEvent) => {
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
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (rotating) {
            handleRotateStop();
        } else if (pan) {
            handlePanStop();
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const coords = vec3.create();
        vec3.set(coords, e.clientX, e.clientY, 0);

        if (rotating) {
            handleRotateMove(coords);
        } else if (pan) {
            handlePanMove(coords);
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        handleRotateStop();
        handlePanStop();
    };

    let cursor = 'auto';

    if (rotating) {
        cursor = 'move';
    } else if (pan) {
        cursor = 'grabbing';
    }

    return (
        <Widget
            type="MeshDisplay"
            widgetProps={{ mesh, position, rotation, scale }}
            style={{ flexGrow: 1, cursor }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        ></Widget>
    );
}
