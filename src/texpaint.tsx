import { vec3 } from 'gl-matrix';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import ColorSelect from './widgets/colorSelect';
import { WindowContext } from './components/Widget';
import WindowManager from './windowManager';
import TextureDisplay, { Channel } from './widgets/textureDisplay';
import MenuBar from './components/menu/MenuBar';
import TexturePaint from './components/TexturePaint';
import MeshPaint from './components/MeshPaint';
import MeshDisplay from './widgets/meshDisplay';
import Widget from './widget';
import ImageWidget from './widgets/imageWidget';
import ViewAssetCache from './components/debug/ViewAssetCache';
import ViewShaderCache from './components/debug/ViewShaderCache';
import Modal from './components/Modal';

const Renderer = ({
    children,
}: {
    widgets: (new () => Widget)[];
    children: any;
}) => {
    const [error, setError] = useState(null);
    const canvas = useRef(null);
    const [windowManager, setWindowManager] = useState(null);

    useEffect(() => {
        if (windowManager === null) {
            setWindowManager(new WindowManager(canvas.current));
        } else {
            windowManager.draw();
        }
    });

    if (error) {
        return (
            <div
                style={{
                    backgroundColor: 'white',
                    margin: '5px',
                    border: '2px solid red',
                    padding: '20px',
                }}
            >
                Error during rendering:
                <pre>
                    {error.name}: {error.message + '\n' + error.stack}
                </pre>
            </div>
        );
    }

    return (
        <>
            <WindowContext.Provider value={windowManager}>
                {windowManager ? children : 'GL not yet started'}
            </WindowContext.Provider>
            <canvas id="application" ref={canvas} />
        </>
    );
};

// TODO: switch to using CSS (maybe modules)

const App = () => {
    const [showTexture, setShowTexture] = useState(false);
    const [showMesh, setShowMesh] = useState(true);
    const [showShaders, setShowShaders] = useState(false);

    const [channel, setChannel] = useState(Channel.Material);
    const [materials, setMaterials] = useState([]); // TODO: probably use a reducer to keep track of this

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === '`' && e.ctrlKey) {
            setShowShaders(!showShaders);
        }

        if (e.key === 'c') {
            let nextChannel = channel + 1;

            if (Channel[nextChannel] === undefined) {
                nextChannel = 0;
            }

            setChannel(nextChannel);
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeydown);

        return () => window.removeEventListener('keydown', handleKeydown);
    });

    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <Renderer
                widgets={[
                    ColorSelect,
                    TextureDisplay,
                    MeshDisplay,
                    ImageWidget,
                ]}
            >
                <div
                    style={{
                        flexGrow: 1,
                        display: 'flex',
                        position: 'relative',
                    }}
                >
                    {showTexture && (
                        <TexturePaint channel={channel} materials={materials} />
                    )}
                    {showTexture && showMesh && <div className="divider" />}
                    {showMesh && <MeshPaint />}
                    {showShaders && (
                        <Modal
                            style={{ width: '1000px' }}
                            onClose={() => setShowShaders(false)}
                        >
                            <ViewShaderCache />
                        </Modal>
                    )}
                </div>
                <MenuBar
                    on2d={() => setShowTexture(!showTexture)}
                    on3d={() => setShowMesh(!showMesh)}
                    setMaterials={setMaterials}
                />
            </Renderer>
        </div>
    );
};

window.addEventListener('load', () => {
    ReactDOM.render(<App />, document.getElementById('container'));
});

window.addEventListener('error', (e) => {
    // TODO: better error handling
    // at least make it compatible with React :P
    document.body.innerHTML = `<div style="background-color: white; font-size: 20px;">ERROR: <pre>${e.error}</pre></div>`;
});
