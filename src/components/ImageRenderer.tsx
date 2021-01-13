import * as React from 'react';
import Widget from './Widget';

import Image from '../loader/image';
import ImageWidget from '../widgets/imageWidget';

export default function ImageRenderer({
    image,
    width,
    height,
}: {
    image: Image;
    width?: number;
    height?: number;
}) {
    const aspect = image.width / image.height;
    if (width || height) {
        if (!width) {
            width = height * aspect;
        } else if (!height) {
            height = width / aspect;
        }
    } else {
        width = image.width;
        height = image.height;
    }
    return (
        <Widget
            constructor={ImageWidget}
            widgetProps={{ image }}
            style={{ display: 'inline-block', width, height }}
        ></Widget>
    );
}
