export function lerp(a, b, t) {
    return (1 - t) * a + t * b;
}

// polyfill EPSILON
if (Number.EPSILON === undefined) {
    Number.EPSILON = Math.pow(2, -52);
}
