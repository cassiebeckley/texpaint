import { vec3 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useState } from 'react';
import { HALF_COLOR } from '../../constants';
import ColorWheel from '../ColorWheel';
import TabPanel from './TabPanel';
import { WindowContext } from '../Widget';

export default function BrushMaterial({ visible, onClick }) {
    const windowManager = useContext(WindowContext);

    const [brushColor, setBrushColor] = useState(vec3.create());
    const [roughness, setRoughness] = useState(0.5);
    const [metallic, setMetallic] = useState(0);

    const color = vec3.create();
    vec3.mul(color, brushColor, [255, 255, 255]);
    vec3.round(color, color);

    // TODO: use http://danielstern.ca/range.css/ to style the range inputs

    return (
        <TabPanel
            buttonClass="brush-color"
            buttonStyle={{ backgroundColor: `rgb(${color})` }}
            showPanel={visible}
            onClick={onClick}
        >
            <div className="border-top" />
            <ColorWheel
                brushColor={brushColor}
                setBrushColor={(c: vec3) => {
                    setBrushColor(c);
                    windowManager.slate.brushColor = c;
                }}
            />
            <div
                style={{
                    backgroundColor: HALF_COLOR,
                    padding: '22px',
                }}
            >
                <label>
                    Roughness
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={roughness}
                        onChange={(e) => {
                            const r = e.target.valueAsNumber;
                            setRoughness(r);
                            windowManager.slate.brushRoughness = r;
                        }}
                    />
                </label>
                <label>
                    Metallic
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={metallic}
                        onChange={(e) => {
                            const m = e.target.valueAsNumber;
                            setMetallic(e.target.valueAsNumber);
                            windowManager.slate.brushMetallic = m;
                        }}
                    />
                </label>
            </div>
        </TabPanel>
    );
}
