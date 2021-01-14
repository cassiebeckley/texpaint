import * as React from 'react';
import { HALF_COLOR } from '../../constants';

export default function BrushMaterial({
    label = null,
    background = false,
    buttonClass = null,
    buttonStyle = null,
    children = null,
    showPanel = false,
    onClick = () => {},
}) {
    return (
        <div
            className="tab-panel"
            style={{ backgroundColor: showPanel && HALF_COLOR }}
        >
            <button
                className={buttonClass}
                style={buttonStyle}
                onClick={onClick}
            >
                {label}
            </button>

            {showPanel && (
                <div
                    className="panel"
                    style={{
                        backgroundColor: background && HALF_COLOR,
                        padding: background && '22px',
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
