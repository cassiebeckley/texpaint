const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

export const normalizeWheelEvent = (e: WheelEvent) => {
    let amount = e.deltaY;

    switch (e.deltaMode) {
        case DOM_DELTA_PIXEL:
            amount /= 100;
            break;
        case DOM_DELTA_LINE:
            amount /= 3;
            break;
        case DOM_DELTA_PAGE:
            amount *= document.body.clientHeight;
            amount /= 100;
            break;
    }

    return amount;
};

export function cacheByContext<T>(fn: (gl: WebGLRenderingContext) => T) {
    const cache: WeakMap<WebGLRenderingContext, T> = new WeakMap();

    return (gl: WebGLRenderingContext) => {
        if (cache.has(gl)) {
            return cache.get(gl);
        }

        const value = fn(gl);
        cache.set(gl, value);
        return value;
    };
}
