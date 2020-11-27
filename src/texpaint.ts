import registerEventHandlers, { dirty } from './events';
import ImageDisplay from './widget/imageDisplay';
import ColorSelect from './widget/colorSelect';
import getWindowManager from './windowManager';
import { AppState } from './appState';

const startRunning = () => {
    const windowManager = getWindowManager();
    windowManager.initGL();

    const appState = new AppState();

    const imageDisplay = new ImageDisplay(1024, 576, appState);
    const colorSelect = new ColorSelect(imageDisplay.brush, appState); // TODO: refactor so that brush settings are in AppState

    colorSelect.setHsvColor([0, 0, 0]);

    windowManager.widgets.push(imageDisplay);
    windowManager.widgets.push(colorSelect);

    //// add event listeners ////
    registerEventHandlers(appState);

    //// reset canvas and image dimensions ////
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
