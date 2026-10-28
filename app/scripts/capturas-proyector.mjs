// Recorre las pantallas del proyector (configuración, resumen, sala, pregunta,
// respuesta, podio y tabla) a varios tamaños de ventana, con Google Chrome sin
// ventana y el transporte local (un proyector y 3 móviles en pestañas). En
// cada pantalla comprueba que no hay scroll de página, que nada queda fuera
// de la ventana ni cortado (salvo dentro de una zona con desplazamiento) y
// que los botones principales se ven enteros. Guarda una captura de cada una.
//
// Uso, con `npm run build && npx vite preview --port 4173 --strictPort` en marcha:
//   node scripts/capturas-proyector.mjs http://localhost:4173/ <carpeta> [1280x720 1920x1080 …]
// Otra ruta de Chrome: variable CHROME.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [raiz, carpeta, ...tamanosPedidos] = process.argv.slice(2);
if (!raiz || !carpeta) { console.error('Uso: node scripts/capturas-proyector.mjs <url> <carpeta> [ANCHOxALTO …]'); process.exit(2); }
mkdirSync(carpeta, { recursive: true });
const TAMANOS = (tamanosPedidos.length ? tamanosPedidos : ['1280x720', '1366x768', '1440x900', '1470x956', '1920x1080'])
    .map(t => t.split('x').map(Number));
const base = `${raiz.replace(/\/$/, '')}/?transporte=local`;
// MAZO: otro mazo para la partida (p. ej. uno con textos muy largos).
const MAZO = process.env.MAZO ?? resolve(dirname(fileURLToPath(import.meta.url)), 'datos/mazo-verificacion.json');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTO = 9335;
const espera = ms => new Promise(r => setTimeout(r, ms));
const fallos = [];
const comprobar = (ok, texto) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${texto}`); if (!ok) fallos.push(texto); };

const perfil = mkdtempSync(join(tmpdir(), 'aq-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--no-first-run',
    '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
let version;
for (let i = 0; i < 40 && !version; i++) {
    await espera(250);
    try { version = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json(); } catch { /* arrancando */ }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let n = 0;
const pendientes = new Map();
const oyentes = new Map();
ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
    if (m.sessionId && oyentes.has(m.sessionId)) oyentes.get(m.sessionId)(m);
});
const cmd = (method, params = {}, sessionId) => new Promise((r, no) => {
    const id = ++n;
    pendientes.set(id, m => (m.error ? no(new Error(`${method}: ${m.error.message}`)) : r(m.result)));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
});

async function abrir(contexto, nombre, ancho, alto, movil) {
    const { targetId } = await cmd('Target.createTarget', { url: 'about:blank', browserContextId: contexto });
    const { sessionId } = await cmd('Target.attachToTarget', { targetId, flatten: true });
    const errores = [];
    oyentes.set(sessionId, m => {
        if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
        if (m.method === 'Page.javascriptDialogOpening') void cmd('Page.handleJavaScriptDialog', { accept: true }, sessionId);
    });
    const c = (metodo, params) => cmd(metodo, params, sessionId);
    await c('Runtime.enable');
    await c('Page.enable');
    await c('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
    await c('Emulation.setFocusEmulationEnabled', { enabled: true });
    const evalua = async expr => {
        const r = await c('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(`${nombre}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result?.value;
    };
    const p = {
        nombre, errores, c, evalua,
        async ir(url) { await c('Page.navigate', { url }); await espera(800); await evalua('document.fonts.ready.then(() => true)'); },
        texto: () => evalua('document.body.innerText'),
        async esperaTexto(t, ms = 8000) {
            const fin = Date.now() + ms;
            while (Date.now() < fin) { if ((await p.texto()).includes(t)) return; await espera(100); }
            throw new Error(`${nombre}: no aparece «${t}»`);
        },
        async pulsa(t, exacto = false) {
            const ok = await evalua(`(() => { const b = [...document.querySelectorAll('button')].find(b => { const x = b.textContent.trim(); return ${exacto} ? x === ${JSON.stringify(t)} : x.startsWith(${JSON.stringify(t)}); }); if (!b || b.disabled) return false; b.click(); return true; })()`);
            if (!ok) throw new Error(`${nombre}: no se pudo pulsar «${t}»`);
            await espera(300);
        },
        async pulsaEn(grupo, t) {
            const ok = await evalua(`(() => { const g = [...document.querySelectorAll('[role=group]')].find(g => g.querySelector('h3')?.textContent.startsWith(${JSON.stringify(grupo)})); const b = g && [...g.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(t)})); if (!b || b.disabled) return false; b.click(); return true; })()`);
            if (!ok) throw new Error(`${nombre}: no se pudo pulsar «${t}» en «${grupo}»`);
            await espera(300);
        },
        async captura(archivo) {
            const r = await c('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(carpeta, archivo), Buffer.from(r.data, 'base64'));
        },
    };
    return p;
}

/** Medidas de la pantalla: scroll de página, elementos fuera o cortados, botones principales y zonas con desplazamiento. */
const MEDIR = botones => `(() => {
    const dentroDeScroll = e => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true; } return false; };
    const visibles = [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
    const fuera = visibles.filter(e => { const r = e.getBoundingClientRect(); return (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) && !dentroDeScroll(e); });
    // Texto cortado: un elemento con texto propio que no cabe en su caja y no se puede desplazar.
    const cortados = visibles.filter(e => { const s = getComputedStyle(e); const recorta = s.overflow === 'hidden' || s.overflowY === 'hidden' || s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none';
        return recorta && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) && e.textContent.trim().length > 0 && !e.matches('.sr-only, [data-recorte-permitido], [data-recorte-permitido] *'); });
    const describir = e => (e.tagName.toLowerCase() + ' «' + e.textContent.trim().slice(0, 40) + '»');
    const botones = ${JSON.stringify(botones)}.map(t => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(t)); if (!b) return [t, 'no está']; const r = b.getBoundingClientRect();
        const enteros = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [t, enteros && b.contains(arriba) ? 'ok' : 'tapado o fuera']; });
    const zonas = [...document.querySelectorAll('main *')].filter(e => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1; })
        .map(e => { const antes = e.scrollTop; e.scrollTop = e.scrollHeight; const movio = e.scrollTop > antes; e.scrollTop = antes; return { zona: describir(e), alto: e.clientHeight, contenido: e.scrollHeight, desplaza: movio }; });
    return { scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], fuera: fuera.slice(0, 5).map(describir), nFuera: fuera.length,
        cortados: cortados.slice(0, 5).map(describir), nCortados: cortados.length, botones, zonas };
})()`;

async function revisar(p, tam, pantalla, botones) {
    const [ancho, alto] = tam;
    const m = await p.evalua(MEDIR(botones));
    const sinScroll = m.scroll[0] <= ancho && m.scroll[1] <= alto;
    const botonesOk = m.botones.every(([, e]) => e === 'ok');
    const zonasOk = m.zonas.every(z => z.desplaza && z.alto >= 120);
    comprobar(sinScroll && m.nFuera === 0 && m.nCortados === 0 && botonesOk && zonasOk,
        `${ancho}×${alto} ${pantalla}: scroll de página ${m.scroll.join('×')}; fuera ${m.nFuera}${m.nFuera ? ' ' + JSON.stringify(m.fuera) : ''}; `
        + `cortados ${m.nCortados}${m.nCortados ? ' ' + JSON.stringify(m.cortados) : ''}; botones ${JSON.stringify(m.botones)}`
        + (m.zonas.length ? `; zonas con desplazamiento ${JSON.stringify(m.zonas)}` : ''));
    await p.captura(`${ancho}x${alto}-${pantalla}.png`);
}

const LETRA = ['A', 'B', 'C', 'D'];
const correcta = async p => { const e = JSON.parse(await p.evalua(`localStorage.getItem('aula-quiz:partida')`)); return e.partida.preguntas[e.indice].correcta; };
const responde = (m, i) => m.evalua(`[...document.querySelectorAll('button[aria-pressed]')][${i}]?.click()`);

try {
    for (const tam of TAMANOS) {
        const [ancho, alto] = tam;
        const { browserContextId: ctx } = await cmd('Target.createBrowserContext');
        const pr = await abrir(ctx, 'proyector', ancho, alto, false);
        await pr.ir(base);

        // Configuración, con el aviso de ajuste (lo más alto que puede ponerse).
        await revisar(pr, tam, '1-configuracion', ['Crear partida', 'Importar mazo']);
        await pr.pulsa('Industria 4.0');
        await pr.pulsaEn('Número de preguntas', '30');
        for (const nombre of await pr.evalua(`[...document.querySelectorAll('[aria-pressed=true]')].map(b => b.textContent.trim()).filter(t => /^✓/.test(t)).slice(0, 4).map(t => t.replace(/^✓/, '').replace(/\\d+$/, ''))`)) {
            await pr.pulsa('✓' + nombre);
        }
        await revisar(pr, tam, '2-configuracion-aviso', ['Crear partida']);

        // Resumen con muchas preguntas (CDI T1, todas: 240).
        await pr.pulsa('Tema 1');
        await pr.pulsaEn('Número de preguntas', 'Todas');
        await pr.pulsa('Crear partida');
        await pr.esperaTexto('Abrir sala');
        await revisar(pr, tam, '3-resumen', ['Abrir sala', 'Volver a configurar', 'Elegir otras preguntas']);

        // Partida con las preguntas más largas: mazo de verificación, 5 preguntas de 10 s.
        await pr.pulsa('Volver a configurar');
        const { root } = await pr.c('DOM.getDocument');
        const { nodeId } = await pr.c('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
        await pr.c('DOM.setFileInputFiles', { nodeId, files: [MAZO] });
        await pr.esperaTexto('Verificación (preguntas largas)');
        await pr.pulsa('Verificación (preguntas largas)');
        await pr.pulsaEn('Número de preguntas', '5');
        await pr.pulsaEn('Segundos', '30');
        await pr.pulsa('Crear partida');
        await pr.esperaTexto('Abrir sala');
        await pr.pulsa('Abrir sala');
        await pr.esperaTexto('PIN de la sala');
        const pin = JSON.parse(await pr.evalua(`localStorage.getItem('aula-quiz:partida')`)).pin;

        const moviles = [];
        for (const nombre of ['Alejandra', 'Bartolomé', 'Concepción']) {
            const m = await abrir(ctx, nombre, 390, 844, true);
            await m.ir(`${base}#/jugar/${pin}`);
            await m.evalua(`document.querySelector('input[autocomplete=given-name]').focus()`);
            await m.c('Input.insertText', { text: nombre });
            await m.pulsa('Entrar', true);
            moviles.push(m);
        }
        await pr.esperaTexto('3 jugadores');
        await revisar(pr, tam, '4-sala', ['Empezar', 'Cancelar partida']);

        await pr.pulsa('Empezar', true);
        await pr.esperaTexto('0 de 3 han respondido');
        await moviles[0].esperaTexto('Pregunta 1 de 5');
        await revisar(pr, tam, '5-pregunta', ['Saltar pregunta', 'Terminar']);
        const c = await correcta(pr);
        await responde(moviles[0], c);
        await responde(moviles[1], (c + 1) % 4);
        await responde(moviles[2], c);
        await pr.esperaTexto('Siguiente');
        await revisar(pr, tam, '6-respuesta', ['Siguiente', 'Terminar']);
        console.log(`      (la correcta era la ${LETRA[c]})`);

        await pr.pulsa('Terminar', true);
        await pr.esperaTexto('Aciertos de la clase');
        await revisar(pr, tam, '7-podio', ['Ver resultados de todos', 'Nueva partida']);
        await pr.pulsa('Ver resultados de todos');
        await pr.esperaTexto('Resultados de todos');
        await revisar(pr, tam, '8-tabla', ['Descargar CSV', 'Volver al podio', 'Nueva partida']);

        for (const p of [pr, ...moviles]) comprobar(p.errores.length === 0, `${ancho}×${alto} ${p.nombre}: sin errores en la consola ${p.errores.length ? JSON.stringify(p.errores) : ''}`);
        await cmd('Target.disposeBrowserContext', { browserContextId: ctx });
    }
} catch (error) {
    fallos.push(String(error));
    console.error(error);
} finally {
    ws.close();
    chrome.kill();
    await espera(300);
    rmSync(perfil, { recursive: true, force: true });
}
console.log(fallos.length ? `\n${fallos.length} fallos` : '\nTodo correcto');
process.exit(fallos.length ? 1 : 0);
