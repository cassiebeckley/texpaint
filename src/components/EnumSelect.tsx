import * as React from 'react';
import { camelCaseToSentence } from '../utils';

export default function EnumSelect({ enumType, ...props }) {
    const options = [];

    for (let key of Object.keys(enumType)) {
        if (!isNaN(Number(key))) continue;

        options.push(
            <option key={key} value={enumType[key]}>
                {camelCaseToSentence(key)}
            </option>
        );
    }

    return <select {...props}>{options}</select>;
}
