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

export function cacheByContext<T>(fn: (gl: WebGL2RenderingContext) => T) {
    const cache: WeakMap<WebGL2RenderingContext, T> = new WeakMap();

    return (gl: WebGL2RenderingContext) => {
        if (cache.has(gl)) {
            return cache.get(gl);
        }

        const value = fn(gl);
        cache.set(gl, value);
        return value;
    };
}

export function camelCaseToSentence(camelCase: string) {
    let s = camelCase.replace(/([^A-Z])([A-Z])/, '$1 $2');
    return s[0].toUpperCase() + s.slice(1);
}
