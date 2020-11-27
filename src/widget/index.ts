import { vec3 } from 'gl-matrix';

export interface Widget {
    position: vec3;

    isVisible(): boolean;

    getWidgetWidth(): number;
    getWidgetHeight(): number;

    draw(): void;

    handleWheel(amount: number): void;

    handleMouseDown(e: MouseEvent, relativePosition: vec3): void;
    handleMouseMove(e: MouseEvent, relativePosition: vec3): void;
    handleMouseUp(e: MouseEvent, relativePosition: vec3): void;

    handlePointerDown(e: PointerEvent, relativePosition: vec3): void;
    handlePointerMove(e: PointerEvent, relativePosition: vec3): void;
    handlePointerUp(e: PointerEvent, relativePosition: vec3): void;
}

export const inBounds = (w: Widget, point: vec3) => {
    return (
        point[0] > w.position[0] &&
        point[0] < w.position[0] + w.getWidgetWidth() &&
        point[1] > w.position[1] &&
        point[1] < w.position[0] + w.getWidgetHeight()
    );
};
