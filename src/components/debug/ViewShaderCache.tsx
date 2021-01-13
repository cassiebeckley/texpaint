import * as React from 'react';
import { useContext } from 'react';
import { getCache } from '../../shaders';
import { WindowContext } from '../Widget';

export default function ViewShaderCache() {
    const windowManager = useContext(WindowContext);
    const cache = getCache(windowManager.gl);

    let entries = [];

    for (let [key, shader] of cache) {
        entries.push(
            <div key={key}>
                <h2>{shader.source.name}</h2>

                <h3>Vertex shader:</h3>
                <pre>{shader.source.vertex}</pre>

                <h3>Fragment shader:</h3>
                <pre>{shader.source.fragment}</pre>

                <h3>Attributes:</h3>
                <ul>
                    {Object.keys(shader.attributes).map((key) => (
                        <li key={key}>
                            <code>{key}</code>: {shader.attributes[key]}
                        </li>
                    ))}
                </ul>

                <h3>Uniforms:</h3>
                <ul>
                    {Object.keys(shader.uniforms).map((key) => (
                        <li key={key}>
                            <code>{key}</code>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return <div>{entries}</div>;
}
