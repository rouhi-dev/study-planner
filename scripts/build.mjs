// Build script: bundles the app with esbuild, compiles Tailwind CSS v4 through
// its programmatic API, and writes a single self-contained dist/index.html.
//
//   node scripts/build.mjs          production build
//   node scripts/build.mjs --dev    watch + local server on http://localhost:5173
import * as esbuild from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dev = process.argv.includes('--dev');
const outDir = path.join(root, 'dist');
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|html)$/.test(e.name) ? [p] : [];
  });
}

/** Extract every token that could be a Tailwind class from the sources. */
function scanCandidates() {
  const set = new Set();
  for (const file of [...walk(path.join(root, 'src')), path.join(root, 'index.html')]) {
    const text = fs.readFileSync(file, 'utf8');
    for (const t of text.split(/[\s"'`]+/)) {
      if (t) set.add(t);
      for (const u of t.split(/[{}()<>;,]+/)) if (u) set.add(u);
    }
  }
  return [...set];
}

async function buildCss() {
  const input = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const compiler = await compile(input, {
    base: path.join(root, 'src'),
    loadStylesheet: async (id, base) => {
      const file =
        id === 'tailwindcss'
          ? path.join(twDir, 'index.css')
          : id.startsWith('tailwindcss/')
            ? path.join(twDir, id.slice('tailwindcss/'.length) + (id.endsWith('.css') ? '' : '.css'))
            : path.resolve(base, id);
      return { content: fs.readFileSync(file, 'utf8'), base: path.dirname(file), path: file };
    },
  });
  const css = compiler.build(scanCandidates());
  const min = await esbuild.transform(css, { loader: 'css', minify: !dev });
  return min.code;
}

function writeHtml(js, css) {
  const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = template
    .replace('<!--APP_CSS-->', () => `<style>${css}</style>`)
    .replace('<!--APP_JS-->', () => `<script>${safeJs}</script>`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  return html.length;
}

const esbuildOptions = {
  entryPoints: [path.join(root, 'src/main.tsx')],
  outfile: path.join(outDir, 'app.js'),
  bundle: true,
  write: false,
  format: 'iife',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
    // Public by design (the anon key is protected by row-level security). Never put a service-role key here.
    __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL ?? ''),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
  },
  logLevel: 'warning',
};

if (dev) {
  const ctx = await esbuild.context({
    ...esbuildOptions,
    plugins: [
      {
        name: 'html',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length) return;
            const js = result.outputFiles?.[0]?.text ?? '';
            writeHtml(js, await buildCss());
            console.log(`[dev] rebuilt ${new Date().toLocaleTimeString()}`);
          });
        },
      },
    ],
  });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outDir, port: 5173 });
  console.log(`[dev] http://localhost:${port}`);
} else {
  const t0 = Date.now();
  const result = await esbuild.build(esbuildOptions);
  const js = result.outputFiles[0].text;
  const css = await buildCss();
  const size = writeHtml(js, css);
  console.log(
    `built dist/index.html  ${(size / 1024).toFixed(0)} KiB  (js ${(js.length / 1024).toFixed(0)} KiB, css ${(css.length / 1024).toFixed(0)} KiB) in ${Date.now() - t0} ms`,
  );
}
