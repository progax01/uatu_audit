const fs = require('fs');
const path = require('path');
(async () => {
  try {
    const sandbox = '/tmp/uatu-docker-install-test';
    if (!fs.existsSync(sandbox)) fs.mkdirSync(sandbox, { recursive: true });

    const pkg = {
      name: 'uatu-docker-install-test',
      version: '0.0.1',
      devDependencies: {
        hardhat: '^2.17.0'
      }
    };

    fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify(pkg, null, 2));

    // Require compiled dockerSandbox
    const dockerSandbox = require('../dist/services/dockerSandbox.js');
    console.log('Calling executeNodeInDocker(install,', sandbox, ')');
    const res = await dockerSandbox.executeNodeInDocker('install', sandbox);
    console.log('--- STDOUT ---\n', res.stdout);
    console.log('--- STDERR ---\n', res.stderr);
    console.log('Exit code:', res.exitCode);
  } catch (e) {
    console.error('Error during docker install test:', e);
    process.exit(1);
  }
})();
