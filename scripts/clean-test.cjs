const fs = require('node:fs');
fs.rmSync('.test-dist', { recursive: true, force: true });
