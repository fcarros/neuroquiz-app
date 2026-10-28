// Comprueba la pantalla de configuración (fase 2) con Google Chrome sin
// ventana, vía protocolo DevTools (sin dependencias: usa el WebSocket de Node).
// Uso, con `npm run build && npx vite preview --port 4173` en marcha:
//   node scripts/captura-configuracion.mjs http://localhost:4173/ <carpeta-capturas>
// Otra ruta de Chrome: variable CHROME.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, carpeta] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTO = 9333;
const espera = ms => new Promise(r => setTimeout(r, ms));

const perfil = mkdtempSync(join(tmpdir(), 'aq-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
    '--window-size=1920,1080', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });

let objetivo;
for (let i = 0; i < 40 && !objetivo; i++) {
    await espera(250);
    try { objetivo = (await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()).find(t => t.type === 'page'); } catch { /* aún arrancando */ }
}
const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const pendientes = new Map();
const errores = [];
ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
});
const cmd = (method, params = {}) => new Promise(r => { const n = ++id; pendientes.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evalua = async expr => (await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const captura = async nombre => {
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(carpeta, nombre), Buffer.from(r.result.data, 'base64'));
    console.log('captura:', join(carpeta, nombre));
};
const pulsa = async texto => {
    const ok = await evalua(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(texto)})); if (!b || b.disabled) return false; b.click(); return true; })()`);
    if (!ok) throw new Error(`No se pudo pulsar «${texto}»`);
    await espera(300);
};
const pulsaEn = async (grupo, texto) => {
    const ok = await evalua(`(() => { const g = [...document.querySelectorAll('[role=group]')].find(g => g.querySelector('h3')?.textContent === ${JSON.stringify(grupo)}); const b = g && [...g.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(texto)})); if (!b || b.disabled) return false; b.click(); return true; })()`);
    if (!ok) throw new Error(`No se pudo pulsar «${texto}» en «${grupo}»`);
    await espera(300);
};
const botonCrear = () => evalua(`(() => { const z = [...document.querySelectorAll('section .overflow-y-auto.pr-2')].pop(); const desborda = z ? z.scrollHeight - z.clientHeight : null; const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Crear partida'); if (!b) return null; const r = b.getBoundingClientRect(), s = b.closest('section').getBoundingClientRect(); return { abajo: Math.round(r.bottom), seccionAbajo: Math.round(s.bottom), dentro: r.bottom <= s.bottom && r.bottom <= innerHeight, desbordeConfig: desborda }; })()`);
const medidas = () => evalua(`({ ancho: innerWidth, alto: innerHeight, scrollAlto: document.documentElement.scrollHeight, scrollAncho: document.documentElement.scrollWidth, lang: document.documentElement.lang, titulo: document.title, fuentes: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) })`);

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await cmd('Page.navigate', { url });
await espera(1500);
await evalua('document.fonts.ready.then(() => true)');

console.log('medidas:', JSON.stringify(await medidas()));
console.log('desactivados:', JSON.stringify(await evalua(`[...document.querySelectorAll('button:disabled')].map(b => b.textContent.trim())`)));
console.log('boton crear:', JSON.stringify(await botonCrear()));
await captura('1-configuracion.png');

// Ajuste automático: quitar categorías hasta que 30 no quepa en Industria 4.0.
await pulsa('Industria 4.0');
await pulsaEn('Número de preguntas', '30');
for (const nombre of await evalua(`[...document.querySelectorAll('[aria-pressed=true]')].map(b => b.textContent.trim()).filter(t => /^✓/.test(t)).slice(0, 4).map(t => t.replace(/^✓/, '').replace(/\\d+$/, ''))`)) {
    await pulsa('✓' + nombre);
}
console.log('aviso de ajuste:', JSON.stringify(await evalua(`document.querySelector('[role=status]')?.textContent ?? null`)));
console.log('desactivados (Industria, 2 categorías):', JSON.stringify(await evalua(`[...document.querySelectorAll('button:disabled')].map(b => b.textContent.trim())`)));
console.log('boton crear:', JSON.stringify(await botonCrear()));
await captura('2-ajuste-industria.png');

// Vuelta a CDI T1: 15 difíciles, 30 s, y crear partida.
await pulsa('Tema 1');
await pulsaEn('Número de preguntas', '15');
await pulsaEn('Dificultad', 'Difícil');
await pulsaEn('Segundos por pregunta', '30');
console.log('explicación tras volver a Tema 1:', JSON.stringify(await evalua(`[...document.querySelectorAll('[role=group]')].find(g => g.querySelector('h3')?.textContent.startsWith('Explicación'))?.querySelector('[aria-pressed=true]')?.textContent`)));
console.log('boton crear:', JSON.stringify(await botonCrear()));
await captura('3-configuracion-tema1.png');
await pulsa('Crear partida');
console.log('medidas resumen:', JSON.stringify(await medidas()));
console.log('resumen:', JSON.stringify(await evalua(`({ preguntas: document.querySelectorAll('ol li').length, datos: [...document.querySelectorAll('dl > div')].map(d => d.textContent) })`)));
await captura('4-resumen.png');

console.log('errores de consola:', JSON.stringify(errores));
ws.close();
chrome.kill();
await espera(300);
rmSync(perfil, { recursive: true, force: true });
process.exit(errores.length ? 1 : 0);
