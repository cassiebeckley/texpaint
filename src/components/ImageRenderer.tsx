import * as React from 'react';
import Widget from './Widget';

import Image from '../loader/image';

export default function ImageRenderer({ image, width, height, odt }: { image: Image, width?: number, height?: number, odt?: boolean }) {
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
            type="ImageWidget"
            widgetProps={{ image, odt }}
            style={{ display: 'inline-block', width, height }}
        >
        </Widget>
    );
}
