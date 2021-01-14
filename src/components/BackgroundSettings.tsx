import * as React from 'react';
import { useState } from 'react';
import Widget from './Widget';
import useInertia from '../hooks/inertia';

import EnvironmentBall from '../widgets/environmentBall';
import { ROTATE_SENSITIVITY } from '../constants';

export default function BackgroundSettings({
    rotation,
    backgroundOffset,
    setBackgroundOffset,
}) {
    const [lastPosition, setLastPosition] = useState(0);
    const [rotating, setRotating] = useState(false);

    const stopRotating = (e: React.PointerEvent) => {
        if (rotating) {
            setRotating(false);
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button === 0) {
            setLastPosition(e.clientX);
            setRotating(true);
        }
    };
    const handlePointerUp = (e: React.PointerEvent) => {
        stopRotating(e);
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (rotating) {
            const deltaAngle = (lastPosition - e.clientX) * -ROTATE_SENSITIVITY;

            setBackgroundOffset(backgroundOffset + deltaAngle);
            setLastPosition(e.clientX);
        }
    };
    const handlePointerLeave = (e: React.PointerEvent) => {
        stopRotating(e);
    };

    return (
        <Widget
            constructor={EnvironmentBall}
            widgetProps={{ rotation, backgroundOffset }}
            style={{ width: '150px', height: '150px' }}
            zindex={1}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        />
    );
}
