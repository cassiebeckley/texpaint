import * as React from 'react';
import { cacheMap } from '../../loader';
import AssetRenderer from '../AssetRenderer';

export default function ViewAssetCache() {
    return (
        <div style={{ display: 'flex' }}>
            {cacheMap((asset, key) => (
                <div key={key}>
                    <h2>{key}</h2>
                    <AssetRenderer asset={asset} />
                </div>
            ))}
        </div>
    );
}
