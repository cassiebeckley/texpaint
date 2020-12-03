const Bundler = require('parcel-bundler');
const path = require('path');
const fs = require('fs');
const http = require('http');
const sirv = require('sirv');

const entryFile = path.join(__dirname, 'src/index.html');
const outDir = './docs';

const removeOutputDirectory = () => {
    return new Promise((resolve) => fs.rmdir(outDir, { recursive: true }, () => resolve()));
}

(async () => {
    if (process.argv[2] === '--watch') {
        const options = {
            outDir: 'dist',
            watch: true,
            minify: false,
            hmr: true,
        };

        const bundler = new Bundler(entryFile, options);
        await bundler.bundle();

        const listener = sirv('dist', {
            dev: true
        });

        const server = http.createServer(listener);
        server.listen(1234, '0.0.0.0', err => {
            if (err) throw err;
            console.log('Listening at http://127.0.0.1:1234');
        });
    } else {
        await removeOutputDirectory();

        const options = {
            outDir,
            watch: false,
            publicUrl: '/texpaint/',
            minify: true,
        };

        const bundler = new Bundler(entryFile, options);
        const bundle = await bundler.bundle();
    }
})();