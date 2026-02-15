
const { spawn } = require('child_process');
const fs = require('fs');

const logStream = fs.createWriteStream('build_full.log');

const build = spawn('npx.cmd', ['vite', 'build', '--debug'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
});

build.stdout.pipe(logStream);
build.stderr.pipe(logStream);

build.on('close', (code) => {
    console.log(`Build process exited with code ${code}`);
    logStream.end();
});
