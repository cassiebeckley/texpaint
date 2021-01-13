import { vec3 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import ColorSelect from './widgets/colorSelect';
import BrushMaterial from './components/BrushMaterial';
import { WindowContext } from './components/Widget';
import WindowManager from './windowManager';
import TextureDisplay from './widgets/textureDisplay';
import TexturePaint from './components/TexturePaint';
import MeshPaint from './components/MeshPaint';
import MeshDisplay from './widgets/meshDisplay';
import Widget from './widget';
import { loadAssetFromBlob } from './loader';
import { AssetType } from './loader/asset';
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

const TopBar = ({ on2d, on3d }) => {
    const windowManager = useContext(WindowContext);

    const handleOpen = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.click();

        input.addEventListener('change', function () {
            const file = this.files[0];

            (async () => {
                const asset = await loadAssetFromBlob(file.name, file);
                switch (asset.type) {
                    case AssetType.Image:
                        windowManager.slate.loadAlbedo(asset.image);
                        break;
                    case AssetType.Mesh:
                        const mesh = asset.meshes[0];
                        windowManager.setMesh(mesh);
                        break;
                }
                windowManager.drawOnNextFrame();
            })();
        });
    };

    return (
        <div className="top-bar">
            <button onClick={on2d}>2D</button>
            <button onClick={on3d}>3D</button>
            <button onClick={handleOpen}>Open</button>
            <div style={{ flexGrow: 1, textAlign: 'right' }}>
                <BrushMaterial />
            </div>
        </div>
    );
};

// TODO: switch to using CSS (maybe modules)

const App = () => {
    const [showTexture, setShowTexture] = useState(false);
    const [showMesh, setShowMesh] = useState(true);
    const [showShaders, setShowShaders] = useState(false);

    window.addEventListener('keydown', (e) => {
        if (e.key === '`' && e.ctrlKey) {
            setShowShaders(!showShaders);
        }
    });

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
            <Renderer
                widgets={[
                    ColorSelect,
                    TextureDisplay,
                    MeshDisplay,
                    ImageWidget,
                ]}
            >
                <TopBar
                    on2d={() => setShowTexture(!showTexture)}
                    on3d={() => setShowMesh(!showMesh)}
                />
                <div
                    style={{
                        flexGrow: 1,
                        display: 'flex',
                        position: 'relative',
                    }}
                >
                    {showTexture && <TexturePaint />}
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
