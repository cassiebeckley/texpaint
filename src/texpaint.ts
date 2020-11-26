import registerEventHandlers, { dirty } from './events';
import ImageDisplay from './widget/imageDisplay';
import ColorSelect from './widget/colorSelect';
import getWindowManager from './windowManager';
import { SlateState } from './slate';

const startRunning = () => {
    const windowManager = getWindowManager();
    windowManager.initGL();

    const slateState = new SlateState();

    const imageDisplay = new ImageDisplay(1024, 576, slateState);
    const colorSelect = new ColorSelect(imageDisplay.brush, slateState); // TODO: refactor so that brush settings are in SlateState

    colorSelect.setHsvColor([0, 0, 0]);

    windowManager.widgets.push(imageDisplay);
    windowManager.widgets.push(colorSelect);

    //// add event listeners ////
    registerEventHandlers(slateState);

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
