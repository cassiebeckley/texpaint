import { mat3, mat4, quat, vec3, vec4 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useRef, useState } from 'react';
import { FAR, FIELD_OF_VIEW, NEAR, ROTATE_SENSITIVITY, SCROLL_SCALE } from '../constants';
import { normalizeWheelEvent } from '../utils';
import { getProjection, getView } from '../widgets/meshDisplay';
import Widget, { WindowContext } from './Widget';

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

    const [position, setPosition] = useState(vec3.create());
    const [pan, setPan] = useState(false);
    const [lastPanPosition, setLastPanPosition] = useState(vec3.create());

    const [paintPoint, setPaintPoint] = useState(null);
    // console.log('paintPoint:', paintPoint);

    const div = useRef(null);

    const windowManager = useContext(WindowContext);

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

        // get the ray from the camera for the current pixel
        const widgetBounds = div.current.getBoundingClientRect();

        const view = mat4.create();
        const proj = mat4.create();
        const invProjView = mat4.create();
        getView(view, position, rotation, scale);
        getProjection(proj, widgetBounds.width, widgetBounds.height);
        mat4.mul(invProjView, proj, view);
        mat4.invert(invProjView, invProjView);

        const ndcX = ((coords[0] + 0.5) / widgetBounds.width) * 2 - 1;
        const ndcY = -(((coords[1] + 0.5) / widgetBounds.height) * 2 - 1);
        
        const camOrigin = vec3.create();
        vec3.set(camOrigin, ndcX, ndcY, -1);
        vec3.scale(camOrigin, camOrigin, NEAR);
        vec3.transformMat4(camOrigin, camOrigin, invProjView);

        const rayBase = vec4.create();
        vec4.set(rayBase, ndcX * (FAR - NEAR), ndcY * (FAR - NEAR), FAR + NEAR, FAR - NEAR);
        vec4.transformMat4(rayBase, rayBase, invProjView);

        const camDirection = vec3.create();
        vec3.set(camDirection, rayBase[0], rayBase[1], rayBase[2]);
        vec3.normalize(camDirection, camDirection);
        // console.log(camDirection);

        if (windowManager.mesh) {
            const point = vec3.create();
            if (windowManager.mesh.raycast(point, camOrigin, camDirection)) {
                // console.log('raycast:', camOrigin, camDirection, point);
                setPaintPoint(point);
            } else {
                // setPaintPoint(null);
            }
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
        <div style={{ flexGrow: 1 }} ref={div}>
            <Widget
                type="MeshDisplay"
                widgetProps={{ position, rotation, scale, brushCursor: paintPoint }}
                style={{ height: '100%', cursor }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
            ></Widget>
        </div>
    );
}
