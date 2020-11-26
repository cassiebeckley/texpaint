import { vec3 } from 'gl-matrix';

export interface Widget {
    position: vec3;
    
    isVisible(): boolean;
    
    getWidgetWidth(): number;
    getWidgetHeight(): number;

    draw(): void;

    handleWheel(amount: number): void;
    
    handleMouseDown(e: MouseEvent): void;
    handleMouseMove(e: MouseEvent): void;
    handleMouseUp(e: MouseEvent): void;
    
    handlePointerDown(e: PointerEvent): void;
    handlePointerMove(e: PointerEvent): void;
    handlePointerUp(e: PointerEvent): void;
}

export const inBounds = (w: Widget, point: vec3) => {
    return (
        point[0] > w.position[0] &&
        point[0] < w.position[0] + w.getWidgetWidth() &&
        point[1] > w.position[1] &&
        point[1] < w.position[0] + w.getWidgetHeight()
    );
};
