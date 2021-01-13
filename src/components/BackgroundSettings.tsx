import * as React from 'react';
import Widget from './Widget';

import EnvironmentBall from '../widgets/environmentBall';

export default function BackgroundSettings({ rotation, backgroundOffset }) {
    return (
        <Widget constructor={EnvironmentBall} widgetProps={{ rotation, backgroundOffset }} style={{width: '150px', height: '150px'}} zindex={1} />
    );
}
