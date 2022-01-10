interface Attributes {
    [key: string]: number;
}

interface Uniforms {
    [key: string]: WebGLUniformLocation;
}

export interface Shader {
    source: ShaderSource;
    program: WebGLShader;
    attributes: Attributes;
    uniforms: Uniforms;
}

const loadShader = (
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
    shaderName: string
): WebGLShader => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`An error occurred compiling ${shaderName}: ${info}`);
    }

    return shader;
};

const loadShaderProgram = (
    gl: WebGL2RenderingContext,
    source: ShaderSource
): Shader => {
    const vertexShader = loadShader(
        gl,
        gl.VERTEX_SHADER,
        source.vertex,
        source.name
    );
    const fragmentShader = loadShader(
        gl,
        gl.FRAGMENT_SHADER,
        source.fragment,
        source.name
    );

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(shaderProgram);
        gl.deleteProgram(shaderProgram);
        throw new Error(`Unable to initialize the shader program: ${info}`);
    }

    const numAttributes = gl.getProgramParameter(
        shaderProgram,
        gl.ACTIVE_ATTRIBUTES
    );
    const attributes = {};

    const numUniforms = gl.getProgramParameter(
        shaderProgram,
        gl.ACTIVE_UNIFORMS
    );
    const uniforms = {};

    for (let i = 0; i < numAttributes; i++) {
        const info = gl.getActiveAttrib(shaderProgram, i);
        attributes[info.name] = i;
    }

    for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(shaderProgram, i);
        uniforms[info.name] = gl.getUniformLocation(shaderProgram, info.name);
    }

    return {
        source,
        program: shaderProgram,
        attributes,
        uniforms,
    };
};

const cache: WeakMap<
    WebGL2RenderingContext,
    Map<string, Shader>
> = new WeakMap();

export default class ShaderSource {
    name: string;
    vertex: string;
    fragment: string;
    constructor(name: string, vertexSource: string, fragmentSource: string) {
        this.name = name;
        this.vertex = vertexSource;
        this.fragment = fragmentSource;
    }

    load(gl: WebGL2RenderingContext) {
        if (!cache.has(gl)) {
            cache.set(gl, new Map());
        }

        const glCache = cache.get(gl);

        if (glCache.has(this.name)) {
            return glCache.get(this.name);
        }

        const shader = loadShaderProgram(gl, this);
        glCache.set(this.name, shader);
        return shader;
    }
}

export function getCache(gl: WebGL2RenderingContext) {
    return cache.get(gl);
}
