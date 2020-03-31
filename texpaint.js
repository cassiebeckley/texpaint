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
let imageTextureBuffer = null;
const uiProjectionMatrix = mat4.create();
const imageMatrix = mat4.create();

const eventState = {
    mouseButtonsDown: [],
    lastMousePosition: vec3.create()
};

const createBlankImage = (width, height) => {
    const buffer = new Uint8ClampedArray(width * height * 4);

    buffer.fill(255);

    return {
        width,
        height,
        buffer,
        texture: null
    };
};

const currentImage = createBlankImage(640, 480);

const imageTexturePositions = [
    0.0, 0.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 1.0
];

const draw = (ts) => {
    gl.clearColor(0.23, 0.23, 0.23, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //// draw 2d image view ////
    gl.useProgram(shaders.imageShader.program);

    // set projection and model*view matrices;
    gl.uniformMatrix4fv(shaders.imageShader.uniforms.uProjectionMatrix, false, uiProjectionMatrix);
    gl.uniformMatrix4fv(shaders.imageShader.uniforms.uModelViewMatrix, false, imageMatrix);

    {
        const size = 2;
        const type = gl.FLOAT; // 32 bit floats
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
        gl.vertexAttribPointer(shaders.imageShader.attributes.aVertexPosition, size, type, normalize, stride, offset);
        gl.enableVertexAttribArray(shaders.imageShader.attributes.aVertexPosition);
    }

    {
        const size = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, imageTextureBuffer);
        gl.vertexAttribPointer(shaders.imageShader.attributes.aTextureCoord, size, type, normalize, stride, offset);
        gl.enableVertexAttribArray(shaders.imageShader.attributes.aTextureCoord);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentImage.texture);
    gl.uniform1i(shaders.imageShader.uniforms.uSampler, 0);

    {
        const offset = 0;
        const count = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, count);
    }

};

const onAnimationFrame = (ts) => {
    draw(ts);
    requestAnimationFrame(onAnimationFrame);
};

const calculateImagePosFromUI = (uiCoord) => {
    const imageCoord = vec3.create();
    const invImageMatrix = mat4.create()
    mat4.invert(invImageMatrix, imageMatrix);
    vec3.transformMat4(imageCoord, uiCoord, invImageMatrix);
    return imageCoord;
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
        mat4.translate(imageMatrix, imageMatrix, imageMousePos);
        mat4.scale(imageMatrix, imageMatrix, [scaleFactor, scaleFactor, 1]);

        vec3.negate(imageMousePos, imageMousePos);
        mat4.translate(imageMatrix, imageMatrix, imageMousePos);
    }
};

const handleMouseDown = (e) => {
    eventState.mouseButtonsDown[e.button] = true;

    if (e.button === 1) { // MMV
        document.body.style.cursor = 'grab';
    }
};

const handleMouseUp = (e) => {
    eventState.mouseButtonsDown[e.button] = false;

    if (e.button === 1) { // MMV
        document.body.style.cursor = 'auto';
    }
}

const mouseEventToVec3 = (e) => {
    const coord = vec3.create();
    vec3.set(coord, e.clientX, e.clientY, 0);
    return coord;
}

const handleMouseMove = (e) => {
    const currentMousePosition = mouseEventToVec3(e);
    const delta = vec3.create();
    vec3.sub(delta, currentMousePosition, eventState.lastMousePosition);

    // if MMB is down
    if (eventState.mouseButtonsDown[1]) {
        let deltaMouse = calculateImagePosFromUI(currentMousePosition);
        let lastImageMousePos = calculateImagePosFromUI(eventState.lastMousePosition);
        mat4.sub(deltaMouse, deltaMouse, lastImageMousePos);
        mat4.translate(imageMatrix, imageMatrix, deltaMouse);
    }

    eventState.lastMousePosition = currentMousePosition;
};

const handleKeyup = (e) => {
    if (e.isComposing || e.keyCode === 229) {
        return;
    }

    if (e.keyCode === 79) {
        const fileSelector = document.getElementById('file-selector');
        fileSelector.click();
        fileSelector.addEventListener('change', function () {
            const file = this.files[0];

            if (!file.type.startsWith('image')) {
                throw new Error('file is not an image');
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                tempImageTexture = loadImage(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }
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

const isPowerOf2 = (value) => (value & (value - 1)) == 0;

const randRange = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
};

const generateImageVertices = () => [
    0, 0,
    0, currentImage.height,
    currentImage.width, 0,
    currentImage.width, currentImage.height
];

const swapBuffer = () => {
    // upload texture
    gl.bindTexture(gl.TEXTURE_2D, currentImage.texture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = currentImage.width;
    const height = currentImage.height;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, currentImage.buffer);
};

const loadImage = (url) => {
    // parse image file
    // we have to use Canvas as an intermediary
    const tempImg = document.createElement('img');

    // TODO: probably return Promise

    tempImg.addEventListener('load', () => {
        const tempImageCanvas = document.createElement('canvas');
        tempImageCanvas.width = tempImg.width;
        tempImageCanvas.height = tempImg.height;
        const ctx = tempImageCanvas.getContext('2d');
        ctx.drawImage(tempImg, 0, 0);
        const imageData = ctx.getImageData(0, 0, tempImg.width, tempImg.height);
        currentImage.buffer = imageData.data;
        currentImage.width = imageData.width;
        currentImage.height = imageData.height;

        swapBuffer(currentImage.texture);
        resetImageSize();

        // update vertices in case width/height changed
        gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(generateImageVertices()), gl.STATIC_DRAW);
    });
    tempImg.src = url;
};

const resetImageSize = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(generateImageVertices()), gl.STATIC_DRAW);

    //// initialize 2d image ////
    mat4.identity(imageMatrix);
    mat4.translate(imageMatrix, imageMatrix, [canvas.width / 2 - currentImage.width / 2, canvas.height / 2 - currentImage.height / 2, 0]);
}

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

    imageTextureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, imageTextureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(imageTexturePositions), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    currentImage.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    //// add event listeners ////
    window.addEventListener('resize', handleResize);

    //// reset canvas and image dimensions ////
    swapBuffer();
    handleResize();
    resetImageSize();

    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);

    window.addEventListener('keyup', handleKeyup);

    //// start draw loop ////
    onAnimationFrame();
}

const startRunningAndHandleErrors = () => {
    try {
        startRunning();
    } catch (e) {
        const pre = document.createElement('pre');
        pre.textContent = e.message;
        document.body.innerHTML = '';
        document.body.appendChild(pre);
    }
}

// start application
window.addEventListener('load', startRunningAndHandleErrors);