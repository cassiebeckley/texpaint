import * as React from 'react';
import { useState } from 'react';
import EnumSelect from '../EnumSelect';
import ViewShaderCache from './ViewShaderCache';
import ViewSceneItems from './ViewSceneItems';

enum DebugPanels {
    ShaderCache,
    SceneItems,
}

export default function Debug() {
    const [panel, setPanel] = useState(DebugPanels.ShaderCache);

    let body: React.ReactNode;

    switch (panel) {
        case DebugPanels.ShaderCache:
            body = <ViewShaderCache />;
            break;
        case DebugPanels.SceneItems:
            body = <ViewSceneItems />;
            break;
    }

    return (
        <div>
            <EnumSelect
                enumType={DebugPanels}
                value={panel}
                onChange={(e) => {
                    setPanel(Number(e.target.value));
                }}
            />
            {body}
        </div>
    );
}
