import * as React from 'react';
import Asset, { AssetType } from '../loader/asset';
import ImageRenderer from './ImageRenderer';

export default function AssetRenderer({ asset, width, height }: { asset: Asset, width?: number, height?: number }) {
    if (asset.type != AssetType.Image) {
        return <div>AssetRenderer can't render this asset type yet</div>;
    }

    return (
        <ImageRenderer image={asset.image} width={width} height={height} />
    );
}
