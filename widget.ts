import { vec3 } from 'gl-matrix';

export interface Widget {
    position: vec3;
    width: number;
    height: number;

    draw(): void;
}

export const inBounds = (w: Widget, point: vec3) => {
    return (
        point[0] > w.position[0] &&
        point[0] < w.position[0] + w.width &&
        point[1] > w.position[1] &&
        point[1] < w.position[0] + w.height
    );
};
