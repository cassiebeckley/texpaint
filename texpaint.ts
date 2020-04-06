import { vec3 } from 'gl-matrix';

import registerEventHandlers, { dirty } from './events';
import ImageDisplay from './imageDisplay';
import ColorSelect from './colorSelect';
import getWindowManager from './windowManager';

let lastTS = 0;
let samples = 0;
let sampleCount = 0;
let nextCollect = 60000;
let redraws = 0;
const draw = (ts) => {
    //// FPS count ////
    let deltaTime = ts - lastTS;
    lastTS = ts;

    samples += deltaTime;
    sampleCount++;

    if (ts > nextCollect) {
        nextCollect += 60000;

        const avgDelta = samples / sampleCount;
        console.log(
            `Average draw time: ${avgDelta} - FPS: ${
                (1 / avgDelta) * 1000
            } - redraws last minute: ${redraws}`
        );

        samples = sampleCount = redraws = 0;
    }

    if (!dirty()) {
        // don't redraw if nothing's changed
        return;
    }

    redraws++;

    //// clear screen ////

    getWindowManager().draw();
};

const onAnimationFrame = (ts) => {
    draw(ts);
    requestAnimationFrame(onAnimationFrame);
};

const startRunning = () => {
    const windowManager = getWindowManager();
    windowManager.initGL();

    const imageDisplay = new ImageDisplay(1024, 576);
    const colorSelect = new ColorSelect(imageDisplay.brush);

    colorSelect.setHsvColor([0, 0, 0]);

    windowManager.widgets.push(imageDisplay);
    windowManager.widgets.push(colorSelect);

    //// add event listeners ////
    registerEventHandlers(imageDisplay, colorSelect);

    //// reset canvas and image dimensions ////
    imageDisplay.markUpdate();
    windowManager.viewportToWindow();
    imageDisplay.resetImageTransform();

    //// start draw loop ////
    onAnimationFrame(0.0);
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
