import * as React from 'react';
import { useContext, useState } from 'react';
import { WindowContext } from '../Widget';

import { loadAssetFromBlob } from '../../loader';
import { AssetType } from '../../loader/asset';
import BrushMaterial from './BrushMaterial';
import BrushSettings from './BrushSettings';

enum SettingsTab {
    None,
    Material,
    Settings,
}

export default function MenuBar({ on2d, on3d, setMaterials }) {
    const windowManager = useContext(WindowContext);

    const [openTab, setOpenTab] = useState(SettingsTab.None);

    const toggleTab = (tab: SettingsTab) => {
        if (openTab === tab) {
            setOpenTab(SettingsTab.None);
        } else {
            setOpenTab(tab);
        }
    };

    const handleOpen = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.click();

        input.addEventListener('change', function () {
            const file = this.files[0];

            (async () => {
                const asset = await loadAssetFromBlob(file.name, file);
                console.log('loaded asset:', asset);
                switch (asset.type) {
                    case AssetType.Image:
                        // windowManager.slate.loadAlbedo(asset.image);
                        // TODO: probably try to match this up by name
                        break;
                    case AssetType.Mesh:
                        windowManager.scene.setMeshes(asset.meshes);
                        setMaterials(windowManager.scene.getMaterialList());
                        break;
                }
                windowManager.drawOnNextFrame();
            })();
        });
    };

    return (
        <div className="menu-bar">
            <BrushMaterial
                visible={openTab == SettingsTab.Material}
                onClick={() => toggleTab(SettingsTab.Material)}
            />
            <BrushSettings
                visible={openTab == SettingsTab.Settings}
                onClick={() => toggleTab(SettingsTab.Settings)}
            />
            <div className="spacer" />
            <button onClick={handleOpen}>📁</button>
            <button onClick={on2d}>2D</button>
            <button onClick={on3d}>3D</button>
        </div>
    );
}
