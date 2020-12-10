precision mediump float;

float log10(float n) {
    return log(n) / log(10.0);
}

#pragma glslify: export(log10)