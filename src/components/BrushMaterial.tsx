import { vec3 } from 'gl-matrix';
import * as React from 'react';
import { useContext, useState } from 'react';
import { HALF_COLOR } from '../constants';
import ColorWheel from './ColorWheel';
import { WindowContext } from './Widget';

export default function BrushMaterial() {
    const windowManager = useContext(WindowContext);

    const [brushColor, setBrushColor] = useState(vec3.create());
    const [roughness, setRoughness] = useState(0.5);
    const [metallic, setMetallic] = useState(0);
    const [showMaterialSelector, setShowColorSelector] = useState(false);

    const color = vec3.create();
    vec3.mul(color, brushColor, [255, 255, 255]);
    vec3.round(color, color);

    // TODO: use http://danielstern.ca/range.css/ to style the range inputs

    return (
        <div
            className="color-select"
            style={{ backgroundColor: showMaterialSelector && HALF_COLOR }}
        >
            <button
                className="brush-color"
                style={{ backgroundColor: `rgb(${color})` }}
                onClick={() => setShowColorSelector(!showMaterialSelector)}
            />

            {showMaterialSelector && (
                <div
                    style={{
                        position: 'absolute',
                        display: 'block',
                        right: 0,
                        top: '50px',
                        textAlign: 'left',
                    }}
                >
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
                            borderRadius: '0 0 10px 10px',
                        }}
                    >
                        <label htmlFor="roughness">Roughness</label>
                        <div>
                            <input
                                id="roughness"
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
                        </div>
                        <label htmlFor="metallic">Metallic</label>
                        <div>
                            <input
                                id="metallic"
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
