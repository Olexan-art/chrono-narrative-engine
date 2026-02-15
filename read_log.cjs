
const fs = require('fs');
try {
    const data = fs.readFileSync('build_full.log', 'utf8');
    console.log(data);
} catch (err) {
    console.error(err);
}
