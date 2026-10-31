const fs = require('node:fs');
fs.writeFileSync('.test-dist/package.json', JSON.stringify({ type: 'commonjs' }));
