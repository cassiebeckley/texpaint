type ParseResult<T> = [T, number];

type Chromaticity = { hue: number, colorfulness: number };

enum RadianceHDRFormat {
    RGBE,
    XYZE
}

type RadianceHDR = {
    format: RadianceHDRFormat,
    software?: string,
    pixaspect?: number,
    primaries?: { red: Chromaticity, green: Chromaticity, blue: Chromaticity, white: Chromaticity },
    exposure?: number,
    gamma?: number,
    width: number,
    height: number,
    pixels: Float32Array,
};

const readLine = async (data: Uint8Array, index: number): Promise<ParseResult<string>> => {
    const line = [];

    let done = false;
    while (!done && index < data.length) {
        const c = data[index++];
        if (c === 10) { // newline
            done = true;
        } else {
            line.push(String.fromCharCode(c));
        }
    }

    return [
        line.join(''),
        index
    ];
};

const getPixel = (r: number, g: number, b: number, e: number): [number, number, number] => {
    const signed_exponent = e - 128;

    let multiplier: number;

    if (signed_exponent > 0) {
        multiplier = 1 << signed_exponent; // Faster version of Math.pow(2, e)
    } else {
        multiplier = Math.pow(2, signed_exponent);
    }

    multiplier /= 255;

    return [r * multiplier, g * multiplier, b * multiplier];
};

// maybe make this a streaming parser at some point
export async function parseRadianceHDR(buffer: ArrayBuffer): Promise<RadianceHDR> {
    const data = new Uint8Array(buffer);
    const hdr: RadianceHDR = {
        format: RadianceHDRFormat.RGBE,
        width: 0,
        height: 0,
        pixels: null,
    };

    let [firstLine, index] = await readLine(data, 0);
    if (firstLine !== '#?RADIANCE') {
        throw new Error('Not a valid Radiance HDR file');
    }

    // parse header
    let inHeader = true;
    let formatSet = false;
    while (inHeader && index < data.length) {
        let line: string;
        [line, index] = await readLine(data, index);

        const [key, value] = line.split('=');

        switch(key) {
            case 'FORMAT':
                switch (value) {
                    case '32-bit_rle_rgbe':
                        hdr.format = RadianceHDRFormat.RGBE;
                        formatSet = true;
                        break;
                    case '32-bit_rle_xyze':
                        hdr.format = RadianceHDRFormat.XYZE;
                        formatSet = true;
                        break;
                    default:
                        throw new Error(`Invalid HDR format "${value}"`);
                }
                break;
            case 'SOFTWARE':
                hdr.software = value;
                break;
            case 'PIXASPECT':
                hdr.pixaspect = Number.parseFloat(value);
                break;
            case 'PRIMARIES':
                const values = value.split(' ').map(v => Number.parseFloat(v));
                hdr.primaries = {
                    red: { hue: values[0], colorfulness: values[1], },
                    green: { hue: values[2], colorfulness: values[3], },
                    blue: { hue: values[4], colorfulness: values[5], },
                    white: { hue: values[6], colorfulness: values[7], },
                }
                break;
            case 'EXPOSURE':
                hdr.exposure = Number.parseFloat(value);
                break;
            case 'GAMMA':
                hdr.gamma = Number.parseFloat(value);
                break;
            case '':
                inHeader = false;
                break;
        }
    }

    if (!formatSet) {
        throw new Error('no format specified');
    }

    let resolutionString: string;
    [resolutionString, index] = await readLine(data, index);
    const [a, h, c, w] = resolutionString.split(' ');

    if (a !== '-Y' || c !== '+X') {
        throw new Error('scanline ordering not supported yet');
    }

    const width = hdr.width = Number.parseInt(w);
    const height = hdr.height = Number.parseInt(h);

    hdr.pixels = new Float32Array(width * height * 3);
    let pixelsCount = 0;
    let previous = [0, 0, 0];

    if (data[index] === 2 && data[index + 1] === 2) {
        // new run-length encoding
        console.log('new run-length encoding');

        while (index < data.length) {
            if (data[index] !== 2 && data[index + 1] !== 2) {
                throw new Error('scanline too short');
            }

            index += 2;

            const scanlineLength = data[index] << 8 | data[index + 1];
            index += 2;

            // console.log('scanline length:', scanlineLength);

            const componentArrays = [null, null, null, null].map(v => new Uint8Array(scanlineLength));

            for (let i = 0; i < 4; i++) {
                // console.log('component:', i);
                for (let j = 0; j < scanlineLength;) {
                    let count = data[index++];
                    const run = count > 128;

                    if (run) {
                        count &= 127; // subtract 128
                        // console.log('run length:', count);

                        const runValue = data[index++];

                        if (j + count > scanlineLength) {
                            throw new Error(`overrun - at index ${j}`);
                        }

                        while (count--) {
                            componentArrays[i][j++] = runValue;
                        }
                    } else {
                        // console.log('non-run length:', count);

                        while (count--) {
                            componentArrays[i][j++] = data[index++];
                        }
                    }
                }
            }

            for (let i = 0; i < scanlineLength; i++) {
                const [r, g, b, e] = [componentArrays[0][i], componentArrays[1][i], componentArrays[2][i], componentArrays[3][i]];

                const pixel = getPixel(r, g, b, e);

                hdr.pixels[pixelsCount++] = pixel[0];
                hdr.pixels[pixelsCount++] = pixel[1];
                hdr.pixels[pixelsCount++] = pixel[2];
            }
        }
    } else {
        console.log('old run-length encoding');

        for (; index < data.length; index += 4) {
            const [r, g, b, e] = data.slice(index, index + 4);

            if (r === g && g === b && b === 1) { // old RLE
                for (let j = 0; j < e; j++) {
                    hdr.pixels[pixelsCount++] = (previous[0]);
                    hdr.pixels[pixelsCount++] = (previous[1]);
                    hdr.pixels[pixelsCount++] = (previous[2]);
                }
            } else {
                previous = getPixel(r, g, b, e);

                hdr.pixels[pixelsCount++] = (previous[0]);
                hdr.pixels[pixelsCount++] = (previous[1]);
                hdr.pixels[pixelsCount++] = (previous[2]);
            }
        }
    }

    if (pixelsCount !== hdr.pixels.length) {
        throw new Error(`missing pixel data: read ${pixelsCount} pixels but expecting ${width} * ${height} * 3 = ${hdr.pixels.length}}`);
    }

    console.log(hdr);

    return hdr;
}