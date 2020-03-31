import { vec3 } from 'gl-matrix';

import registerEventHandlers from './events';
import ImageDisplay from './imageDisplay';
import getWindowManager from './windowManager';

// uninitialized global variables because we have fun here
let imageDisplay = null;

const draw = (ts) => {
    const windowManager = getWindowManager();
    const gl = windowManager.gl;

    gl.clearColor(0.23, 0.23, 0.23, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    imageDisplay.draw();
};

const onAnimationFrame = (ts) => {
    draw(ts);
    requestAnimationFrame(onAnimationFrame);
};

const startRunning = () => {
    const windowManager = getWindowManager();
    windowManager.initGL();

    imageDisplay = new ImageDisplay(640, 480);

    //// add event listeners ////
    registerEventHandlers(imageDisplay);

    //// reset canvas and image dimensions ////
    imageDisplay.swapBuffer();
    windowManager.viewportToWindow();
    imageDisplay.resetImageTransform();

    //// start draw loop ////
    onAnimationFrame();
};

const startRunningAndHandleErrors = () => {
    try {
        startRunning();
    } catch (e) {
        const pre = document.createElement('pre');
        pre.textContent = e.message + '\n\n' + e.stack;
        document.body.innerHTML = '';
        document.body.appendChild(pre);
    }
};

// start application
window.addEventListener('load', startRunningAndHandleErrors);
