import { mat4, vec3 } from 'gl-matrix';

import vertImageShader from './shaders/imageShader/vert.glsl';
import fragImageShader from './shaders/imageShader/frag.glsl';

// editor parameters, probably should be customizable
const SCROLL_SCALE_CONSTANT = 0.25;

// uninitialized global variables because we have fun here
let canvas = null;
let gl = null;
let shaders = {};
let imagePositionBuffer = null;
const uiProjectionMatrix = mat4.create();
const imageMatrix = mat4.create();

const eventState = {
    mouseButtonsDown: [],
    lastMousePosition: { x: 0, y: 0 }
};

const currentImage = {
    width: 640,
    height: 480,
    buffer: new Uint32Array(640 * 480)
};

const imageVertexPositions = [
    0, 0,
    0, currentImage.height,
    currentImage.width, 0,
    currentImage.width, currentImage.height
];

const draw = (ts) => {
    gl.clearColor(0.23, 0.23, 0.23, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // draw 2d image view
    gl.useProgram(shaders.imageShader.program);

    // set projection and model*view matrices;
    gl.uniformMatrix4fv(shaders.imageShader.uniforms.uProjectionMatrix, false, uiProjectionMatrix);
    gl.uniformMatrix4fv(shaders.imageShader.uniforms.uModelViewMatrix, false, imageMatrix);

    gl.enableVertexAttribArray(imagePositionBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);

    const size = 2;
    const type = gl.FLOAT; // 32 bit floats
    const normalize = false;
    const stride = 0;
    let offset = 0;
    gl.vertexAttribPointer(shaders.imageShader.attributes.aVertexPosition, size, type, normalize, stride, offset);

    offset = 0;
    const count = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);

};

const onAnimationFrame = (ts) => {
    draw(ts);
    requestAnimationFrame(onAnimationFrame);
};

const calculateImagePosFromUI = (uiCoord) => {
    const coord = vec3.create();
    const invImageMatrix = mat4.create()
    mat4.invert(invImageMatrix, imageMatrix);
    vec3.set(coord, uiCoord.x, uiCoord.y, 0);
    vec3.transformMat4(coord, coord, invImageMatrix);
    return { x: coord[0], y: coord[1] };
};

const handleResize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    mat4.ortho(uiProjectionMatrix, 0, canvas.width, canvas.height, 0, -1, 1);

    gl.viewport(0, 0, canvas.width, canvas.height);
};

const handleWheel = (e) => {
    if (e.deltaY != 0) {
        let scaleFactor = 1;

        if (e.deltaY < 0) {
            scaleFactor /= -e.deltaY * SCROLL_SCALE_CONSTANT;
        } else {
            scaleFactor *= e.deltaY * SCROLL_SCALE_CONSTANT;
        }

        // Scale with mouse as origin
        const imageMousePos = calculateImagePosFromUI(eventState.lastMousePosition);
        mat4.translate(imageMatrix, imageMatrix, [imageMousePos.x, imageMousePos.y, 0]);
        mat4.scale(imageMatrix, imageMatrix, [scaleFactor, scaleFactor, 1]);
        mat4.translate(imageMatrix, imageMatrix, [-imageMousePos.x, -imageMousePos.y, 0]);
    }
};

const handleMouseDown = (e) => {
    eventState.mouseButtonsDown[e.button] = true;
};

const handleMouseUp = (e) => {
    eventState.mouseButtonsDown[e.button] = false;
}

const handleMouseMove = (e) => {
    const deltaX = e.clientX - eventState.lastMousePosition.x;
    const deltaY = e.clientY - eventState.lastMousePosition.y;

    // if MMB is down
    if (eventState.mouseButtonsDown[1]) {
        mat4.translate(imageMatrix, imageMatrix, [deltaX, deltaY, 0]);
    }

    eventState.lastMousePosition.x = e.clientX;
    eventState.lastMousePosition.y = e.clientY;
};

const loadShader = (type, source) => {
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

const loadShaderProgram = (vsSource, fsSource) => {
    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(shaderProgram);
        gl.deleteProgram(shaderProgram);
        throw new Error(`Unable to initialize the shader program: ${info}`);
    }

    const numAttributes = gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES);
    const attributes = {};

    const numUniforms = gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS);
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
        uniforms
    };
};

const startRunning = () => {
    canvas = document.getElementById('application');
    gl = canvas.getContext('webgl');

    if (!gl) {
        throw new Error("WebGL is not supported");
    }

    // TODO: enable CULL_FACE

    //// load and compile shaders ////
    // 2d image view shader
    shaders.imageShader = loadShaderProgram(vertImageShader, fragImageShader);

    //// initialize buffers ////
    imagePositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(imageVertexPositions), gl.STATIC_DRAW);

    //// add event listeners ////
    window.addEventListener('resize', handleResize);
    handleResize();

    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);

    //// initialize 2d image ////
    mat4.translate(imageMatrix, imageMatrix, [canvas.width / 2 - currentImage.width / 2, canvas.height / 2 - currentImage.height / 2, 0]);

    //// start draw loop ////
    onAnimationFrame();
}

const startRunningAndHandleErrors = () => {
    try {
        startRunning();
    } catch(e) {
        const pre = document.createElement('pre');
        pre.textContent = e.message;
        document.body.innerHTML = '';
        document.body.appendChild(pre);
    }
}

// start application
window.addEventListener('load', startRunningAndHandleErrors);