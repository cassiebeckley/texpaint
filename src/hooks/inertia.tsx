import { useEffect, useRef, useState } from 'react';

const SLOWDOWN = 0.8;

export default function useInertia(update: (v: number) => {}) {
    const [velocity, setVelocity] = useState(0);

    const ref = useRef({
        timer: null,
        velocity: 0,
        lastUpdate: performance.now(),
    });

    console.log('current velocity:', velocity);

    const handleUpdate = (ts: DOMHighResTimeStamp) => {
        const deltaTime = ts - ref.current.lastUpdate;
        ref.current.lastUpdate = ts;

        ref.current.velocity *= SLOWDOWN * deltaTime;
        update(ref.current.velocity);

        if (ref.current.velocity > Number.EPSILON) {
            const t = requestAnimationFrame(handleUpdate);
            ref.current.timer = t;
        }
    };

    useEffect(() => {
        cancelAnimationFrame(ref.current.timer);
        ref.current.velocity = velocity;

        handleUpdate(performance.now());
    }, [velocity]);

    return setVelocity;
}
