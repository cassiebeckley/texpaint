import * as React from 'react';
import { useContext } from 'react';
import { WindowContext } from '../Widget';

export default function ViewSceneItems() {
    const windowManager = useContext(WindowContext);

    let materials = [];

    for (let [key, _] of windowManager.scene.materials) {
        materials.push(<li key={key}>{key}</li>);
    }

    return (
        <div>
            <h2>Materials:</h2>
            <ul>{materials}</ul>
        </div>
    );
}
