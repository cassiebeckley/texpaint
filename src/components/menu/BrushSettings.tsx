import * as React from 'react';
import { useContext, useState } from 'react';
import TabPanel from './TabPanel';
import { WindowContext } from '../Widget';

export default function BrushMaterial({ visible, onClick }) {
    const windowManager = useContext(WindowContext);

    const [soft, setSoft] = useState(false);
    const [radius, setRadius] = useState(
        () => windowManager.brushEngine.radius
    ); // TODO: brush radius should percentage of max dimensions of texture/mesh
    const [spacing, setSpacing] = useState(
        () => windowManager.brushEngine.spacing
    );

    return (
        <TabPanel label="🖌" background showPanel={visible} onClick={onClick}>
            <div>TODO: show brush preview</div>
            <div>TODO: show brush tip</div>
            <label>
                Size
                {/* TODO: size slider on right side of screen */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={radius}
                    onChange={(e) => {
                        const r = e.target.valueAsNumber;
                        setRadius(r);
                        windowManager.brushEngine.radius = r;
                    }}
                />
            </label>
            <label>
                Spacing
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={spacing}
                    onChange={(e) => {
                        const s = e.target.valueAsNumber;
                        setSpacing(s);
                        windowManager.brushEngine.spacing = s;
                    }}
                />
            </label>
            <label style={{ display: 'block' }}>
                Soft
                <input
                    type="checkbox"
                    checked={soft}
                    onChange={(e) => {
                        const s = e.target.checked;
                        setSoft(s);
                        windowManager.brushEngine.soft = s;
                    }}
                />
            </label>
            TODO: multiple preset brushes, with options to save new presets and
            to reset to defaults
        </TabPanel>
    );
}
