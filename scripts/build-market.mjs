import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const out = path.resolve(process.env.MANGA_MARKET_OUT || 'market-dist');
await mkdir(out, { recursive: true });
const ui = path.join(root, 'market/ui.tsx');
const aliases = new Map([
  ['next/link', ui], ['next/navigation', ui],
  ['@/components/AuthProvider', path.join(root, 'market/auth.ts')],
  ['@/components/AuthModal', ui], ['@/components/ShareComicModal', ui],
  ['@/components/LanguageSwitcher', path.join(root, 'market/language.tsx')],
]);
const bundled = await build({ entryPoints: ['market/main.tsx'], outfile: 'app.js', write: false, bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2022'], jsx: 'automatic', loader: { '.svg': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'market-services', setup(b) { b.onResolve({ filter: /^(next\/|@\/components\/)/ }, args => { const resolved = aliases.get(args.path); return resolved ? { path: resolved } : null; }); } }] });
const global = (await readFile('src/app/globals.css', 'utf8')).replace(/^@import url[^\n]+\n/, '');
const styles = await postcss([tailwind()]).process(global, { from: path.join(root, 'src/app/globals.css') });
const bundledCss = bundled.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
const css = styles.css + '\n' + await readFile('src/app/app/studio.css', 'utf8') + '\n' + bundledCss + '\n' + await readFile('market/market.css', 'utf8');
const js = bundled.outputFiles.find(file => file.path.endsWith('.js')).text;
const icon = `data:image/x-icon;base64,${(await readFile('src/app/favicon.ico')).toString('base64')}`;
const license = (await readFile('LICENSE', 'utf8')).replace(/--/g, '—');
const html = (await readFile('market/index.html', 'utf8'))
  .replace('<link rel="stylesheet" href="/app.css">', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
  .replace('href="/favicon.ico"', () => `href="${icon}"`)
  .replace('<script type="module" src="/app.js"></script>', () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace('</body>', () => `<!-- Original project license:\n${license}\n--></body>`);
await writeFile(path.join(out, 'index.html'), html);
console.log(`Single-file Market build: ${path.join(out, 'index.html')} (${Buffer.byteLength(html)} bytes)`);
