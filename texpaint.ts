import registerEventHandlers, { dirty } from './events';
import ImageDisplay from './imageDisplay';
import ColorSelect from './colorSelect';
import getWindowManager from './windowManager';

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
    getWindowManager().drawOnNextTick();
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
