interface Attributes {
    [key: string]: number;
}

interface Uniforms {
    [key: string]: WebGLUniformLocation;
}

export interface Shader {
    program: WebGLShader;
    attributes: Attributes;
    uniforms: Uniforms;
}

const loadShader = (
    gl: WebGLRenderingContext,
    type: number,
    source: string
): WebGLShader => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`An error occurred compiling the shaders: ${info}`);
    }

    return shader;
};

const loadShaderProgram = (
    gl: WebGLRenderingContext,
    vsSource: string,
    fsSource: string
): Shader => {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

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
        program: shaderProgram,
        attributes,
        uniforms,
    };
};

export default loadShaderProgram;
