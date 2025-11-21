import { spawn } from 'child_process';
import { createServer } from 'vite';
import electron from 'electron';
import { build } from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

let electronProcess = null;

async function buildElectron() {
  console.log('Building Electron main process...');

  try {
    await build({
      entryPoints: [
        path.join(rootDir, 'src/main/main.ts'),
        path.join(rootDir, 'src/preload/preload.ts')
      ],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outdir: path.join(rootDir, 'dist-electron'),
      external: ['electron', 'better-sqlite3'],
      format: 'esm',
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"development"'
      },
      outExtension: { '.js': '.js' }
    });

    console.log('✓ Electron build complete');
    return true;
  } catch (error) {
    console.error('Electron build failed:', error);
    return false;
  }
}

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
  }

  console.log('Starting Electron...');

  electronProcess = spawn(electron, [path.join(rootDir, 'dist-electron/main.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  electronProcess.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.log(`Electron exited with code ${code}`);
    }
    process.exit(code);
  });
}

async function startDev() {
  // Start Vite dev server
  console.log('Starting Vite dev server...');
  const server = await createServer({
    configFile: path.join(rootDir, 'vite.config.ts'),
    root: rootDir,
    server: {
      port: 5173
    }
  });

  await server.listen();
  console.log('✓ Vite dev server running at http://localhost:5173');

  // Build Electron and start
  const success = await buildElectron();
  if (success) {
    startElectron();
  }

  // Watch for Electron changes
  const { watch } = await import('chokidar');
  const watcher = watch(
    [
      path.join(rootDir, 'src/main/**/*.ts'),
      path.join(rootDir, 'src/preload/**/*.ts')
    ],
    {
      ignored: /(^|[\/\\])\../
    }
  );

  watcher.on('change', async () => {
    console.log('Electron files changed, rebuilding...');
    const success = await buildElectron();
    if (success) {
      startElectron();
    }
  });

  // Handle cleanup
  process.on('SIGINT', () => {
    if (electronProcess) {
      electronProcess.kill();
    }
    watcher.close();
    server.close();
    process.exit(0);
  });
}

startDev().catch(console.error);
