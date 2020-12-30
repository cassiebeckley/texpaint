export function lerp(a, b, t) {
    return (1 - t) * a + t * b;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
    let t = (x - edge0) / (edge1 - edge0);

    if (t < 0.0) {
        t = 0.0;
    } else if (t > 1.0) {
        t = 1.0;
    }

    return t * t * (3.0 - 2.0 * t);
}
