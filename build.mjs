import { build, context } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const pluginConfig = {
  entryPoints: ['src/plugin/controller.ts'],
  bundle: true,
  outfile: 'code.js',
  target: 'es2017',
  format: 'iife',
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await context(pluginConfig);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(pluginConfig);
  console.log('Build complete.');
}
