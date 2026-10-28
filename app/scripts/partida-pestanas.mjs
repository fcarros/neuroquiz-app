// Partida completa en Google Chrome sin ventana: un proyector (1920×1080) y
// tres móviles (390×844) en pestañas del mismo navegador, comunicadas por
// BroadcastChannel. Usa el protocolo DevTools con el WebSocket de Node, sin
// dependencias.
//
// Usa el transporte local (?transporte=local). Uso, con
// `npm run build && npx vite preview --port 4173 --strictPort` en marcha:
//   node scripts/partida-pestanas.mjs http://localhost:4173/ <carpeta-capturas>
// Otra ruta de Chrome: variable CHROME.
//
// Guion: importa scripts/datos/mazo-verificacion.json (6 preguntas largas),
// quita una categoría para jugar 5, preguntas de 10 s. Recarga un móvil en la
// 2.ª, recarga el proyector en la 3.ª, deja que la 4.ª se cierre por tiempo y
// descarga el CSV al final. Sale con código 1 si algo no cuadra.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [raiz, carpeta] = process.argv.slice(2);
if (!raiz || !carpeta) { console.error('Uso: node scripts/partida-pestanas.mjs <url> <carpeta>'); process.exit(2); }
mkdirSync(carpeta, { recursive: true });
// Pestañas del mismo navegador: transporte local (la web compilada usa Ably por defecto).
const base = `${raiz.replace(/\/$/, '')}/?transporte=local`;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTO = 9334;
const MAZO = resolve(dirname(fileURLToPath(import.meta.url)), 'datos/mazo-verificacion.json');
const espera = ms => new Promise(r => setTimeout(r, ms));
const fallos = [];
const comprobar = (ok, texto) => { console.log(`${ok ? 'OK   ' : 'FALLO'} ${texto}`); if (!ok) fallos.push(texto); };

// --- Chrome y protocolo ---
const perfil = mkdtempSync(join(tmpdir(), 'aq-chrome-'));
const descargas = join(perfil, 'descargas');
mkdirSync(descargas);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check',
    // Las pestañas en segundo plano no se frenan: todas juegan a la vez.
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    'about:blank'], { stdio: 'ignore' });

let version;
for (let i = 0; i < 40 && !version; i++) {
    await espera(250);
    try { version = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json(); } catch { /* arrancando */ }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let n = 0;
const pendientes = new Map();
const oyentes = new Map(); // sessionId → fn(evento)
ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
    if (m.sessionId && oyentes.has(m.sessionId)) oyentes.get(m.sessionId)(m);
});
const cmd = (method, params = {}, sessionId) => new Promise((r, rechazar) => {
    const id = ++n;
    pendientes.set(id, m => (m.error ? rechazar(new Error(`${method}: ${m.error.message}`)) : r(m.result)));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
});
await cmd('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: descargas });

async function abrir(nombre, { ancho, alto, movil }) {
    const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cmd('Target.attachToTarget', { targetId, flatten: true });
    const errores = [];
    oyentes.set(sessionId, m => {
        if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
        // Las confirmaciones (saltar, expulsar…) se aceptan.
        if (m.method === 'Page.javascriptDialogOpening') void cmd('Page.handleJavaScriptDialog', { accept: true }, sessionId);
    });
    const c = (metodo, params) => cmd(metodo, params, sessionId);
    await c('Runtime.enable');
    await c('Page.enable');
    await c('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
    if (movil) await c('Emulation.setTouchEmulationEnabled', { enabled: true });
    await c('Emulation.setFocusEmulationEnabled', { enabled: true });

    const evalua = async expr => {
        const r = await c('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(`${nombre}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result?.value;
    };
    const pestana = {
        nombre, errores, evalua, c,
        async ir(url) { await c('Page.navigate', { url }); await espera(800); await evalua('document.fonts.ready.then(() => true)'); },
        async recargar() { await c('Page.reload'); await espera(800); await evalua('document.fonts.ready.then(() => true)'); },
        async captura(archivo) {
            const r = await c('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(carpeta, archivo), Buffer.from(r.data, 'base64'));
            console.log(`      captura ${archivo}`);
        },
        texto: () => evalua('document.body.innerText'),
        async pulsa(texto, { exacto = false } = {}) {
            const ok = await evalua(`(() => { const b = [...document.querySelectorAll('button')].find(b => { const t = b.textContent.trim(); return ${exacto} ? t === ${JSON.stringify(texto)} : t.startsWith(${JSON.stringify(texto)}); }); if (!b || b.disabled) return false; b.click(); return true; })()`);
            if (!ok) throw new Error(`${nombre}: no se pudo pulsar «${texto}»`);
            await espera(250);
        },
        async pulsaEn(grupo, texto) {
            const ok = await evalua(`(() => { const g = [...document.querySelectorAll('[role=group]')].find(g => g.querySelector('h3')?.textContent.startsWith(${JSON.stringify(grupo)})); const b = g && [...g.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(texto)})); if (!b || b.disabled) return false; b.click(); return true; })()`);
            if (!ok) throw new Error(`${nombre}: no se pudo pulsar «${texto}» en «${grupo}»`);
            await espera(250);
        },
        async escribe(selector, texto) {
            await evalua(`document.querySelector(${JSON.stringify(selector)}).focus()`);
            await c('Input.insertText', { text: texto });
        },
        /** Espera a que el texto de la página contenga algo. */
        async esperaTexto(texto, ms = 8000) {
            const fin = Date.now() + ms;
            while (Date.now() < fin) {
                if ((await pestana.texto()).includes(texto)) return true;
                await espera(100);
            }
            throw new Error(`${nombre}: no aparece «${texto}». Texto actual: ${(await pestana.texto()).slice(0, 300)}`);
        },
        /** ¿Cabe todo en la pantalla, sin scroll de página? */
        cabe: () => evalua(`({ ancho: innerWidth, alto: innerHeight, scrollAlto: document.documentElement.scrollHeight, scrollAncho: document.documentElement.scrollWidth,
            fuera: [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1) && !e.closest('.overflow-y-auto'); }).length })`),
    };
    return pestana;
}

async function compruebaQueCabe(p, que) {
    const m = await p.cabe();
    comprobar(m.scrollAlto <= m.alto && m.scrollAncho <= m.ancho && m.fuera === 0,
        `${p.nombre}: «${que}» cabe en ${m.ancho}×${m.alto} (scroll ${m.scrollAncho}×${m.scrollAlto}, elementos fuera: ${m.fuera})`);
}

/** Estado guardado por el proyector (solo para que el guion sepa cuál es la correcta). */
const partidaGuardada = async proyector => JSON.parse(await proyector.evalua(`localStorage.getItem('aula-quiz:partida')`));
const correctaActual = async proyector => { const e = await partidaGuardada(proyector); return e.partida.preguntas[e.indice].correcta; };
const LETRA = ['A', 'B', 'C', 'D'];

/** El móvil pulsa la opción `i` (botones con aria-pressed). */
async function responde(movil, i) {
    const ok = await movil.evalua(`(() => { const b = [...document.querySelectorAll('button[aria-pressed]')][${i}]; if (!b || b.disabled) return false; b.click(); return true; })()`);
    if (!ok) throw new Error(`${movil.nombre}: no puede responder ${LETRA[i]}`);
    await espera(200);
}

const puntosDe = async movil => Number((await movil.evalua(`document.querySelector('header span:last-child')?.textContent ?? ''`)).replace(/\D/g, ''));

try {
    // --- Proyector: importar el mazo, configurar y abrir la sala ---
    const proyector = await abrir('proyector', { ancho: 1920, alto: 1080, movil: false });
    await proyector.ir(base);
    const { root } = await proyector.c('DOM.getDocument');
    const { nodeId } = await proyector.c('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
    await proyector.c('DOM.setFileInputFiles', { nodeId, files: [MAZO] });
    await proyector.esperaTexto('Verificación (preguntas largas)');
    await proyector.pulsa('Verificación (preguntas largas)');
    const categoria = JSON.parse(readFileSync(MAZO, 'utf8')).categorias[0].nombre;
    await proyector.pulsa(`✓${categoria}`);
    await proyector.pulsaEn('Segundos', '10');
    await proyector.pulsa('Crear partida');
    await proyector.esperaTexto('Abrir sala');
    const resumen = await proyector.texto();
    comprobar(/\b5\s*preguntas/.test(resumen), 'el resumen tiene 5 preguntas');
    await proyector.pulsa('Abrir sala');
    await proyector.esperaTexto('PIN de la sala');
    const pin = (await partidaGuardada(proyector)).pin;
    const qr = await proyector.evalua(`(() => { const s = document.querySelector('svg[role=img]'); return s && { etiqueta: s.getAttribute('aria-label'), ancho: s.getBoundingClientRect().width, modulos: s.querySelector('path').getAttribute('d').split('M').length - 1 }; })()`);
    comprobar(qr && qr.ancho >= 300 && qr.modulos > 200, `QR dibujado (${JSON.stringify(qr)})`);
    comprobar((await proyector.texto()).includes('Usa tu nombre de pila o un apodo'), 'la sala recomienda nombre de pila o apodo');
    const urlJugar = `${base}#/jugar/${pin}`;
    console.log(`      PIN ${pin}; los móviles abren ${urlJugar}`);
    await compruebaQueCabe(proyector, 'sala vacía');
    await proyector.captura('01-proyector-sala-vacia.png');

    // --- Tres móviles entran ---
    const nombres = ['Ana', 'Bea', 'Ana'];
    const moviles = [];
    for (let i = 0; i < 3; i++) {
        const m = await abrir(`móvil ${i + 1}`, { ancho: 390, alto: 844, movil: true });
        await m.ir(urlJugar);
        const pinEnFormulario = await m.evalua(`document.querySelector('input[inputmode=numeric]').value`);
        comprobar(pinEnFormulario === pin, `${m.nombre}: el PIN llega relleno desde el QR`);
        if (i === 0) {
            await compruebaQueCabe(m, 'unirse');
            await m.captura('02-movil-unirse.png');
        }
        await m.escribe('input[autocomplete=given-name]', nombres[i]);
        await m.pulsa('Entrar', { exacto: true });
        moviles.push(m);
    }
    const [ana, bea, ana2] = moviles;
    await ana.esperaTexto('¡Estás dentro, Ana!');
    await ana2.esperaTexto('¡Estás dentro, Ana 2!');
    comprobar(true, 'el nombre repetido se numera: «Ana 2»');
    await proyector.esperaTexto('3 jugadores');
    await compruebaQueCabe(proyector, 'sala con 3 jugadores');
    await proyector.captura('03-proyector-sala.png');
    await compruebaQueCabe(ana, 'esperando');
    await ana.captura('04-movil-esperando.png');

    // --- Pregunta 1: responden los tres; se cierra al responder todos ---
    await proyector.pulsa('Empezar', { exacto: true });
    await proyector.esperaTexto('0 de 3 han respondido');
    await ana.esperaTexto('Pregunta 1 de 5');
    comprobar(!(await ana.evalua(`document.body.innerHTML`)).includes('correcta'), 'el móvil no recibe la correcta con la pregunta abierta');
    await compruebaQueCabe(proyector, 'pregunta');
    await proyector.captura('05-proyector-pregunta.png');
    await compruebaQueCabe(ana, 'responder');
    await ana.captura('06-movil-responder.png');
    let c = await correctaActual(proyector);
    await responde(ana, c);
    await ana.esperaTexto(`Respuesta ${LETRA[c]} recibida`);
    await proyector.esperaTexto('1 de 3 han respondido');
    await ana.captura('07-movil-respondida.png');
    await responde(bea, (c + 1) % 4);
    await responde(ana2, c);
    await proyector.esperaTexto('Siguiente');
    comprobar((await proyector.texto()).includes('Por qué'), 'la respuesta muestra «Por qué»');
    await compruebaQueCabe(proyector, 'respuesta y top 5');
    await proyector.captura('08-proyector-respuesta.png');
    await ana.esperaTexto('¡Correcto!');
    await bea.esperaTexto('Incorrecto');
    await compruebaQueCabe(ana, 'resultado');
    await ana.captura('09-movil-resultado-correcto.png');
    await bea.captura('10-movil-resultado-incorrecto.png');

    // --- Pregunta 2: «Ana 2» (que ya tiene puntos) recarga antes de responder ---
    await proyector.pulsa('Siguiente', { exacto: true });
    await ana.esperaTexto('Pregunta 2 de 5');
    c = await correctaActual(proyector);
    await responde(ana, c);
    await responde(bea, (c + 2) % 4);
    const puntosAntes = await puntosDe(ana2);
    await ana2.recargar();
    await ana2.esperaTexto('Pregunta 2 de 5');
    comprobar(puntosAntes > 0 && await puntosDe(ana2) === puntosAntes && (await ana2.texto()).includes('Ana 2'),
        `«Ana 2» recarga a mitad de pregunta y vuelve con sus ${puntosAntes} puntos`);
    await ana2.captura('11-movil-tras-recargar.png');
    await responde(ana2, c);
    await proyector.esperaTexto('Siguiente');
    await ana2.esperaTexto('¡Correcto!');
    comprobar((await proyector.evalua(`JSON.parse(localStorage.getItem('aula-quiz:partida')).jugadores.length`)) === 3, 'tras la recarga sigue habiendo 3 jugadores');

    // --- Pregunta 3: el proyector recarga con la pregunta abierta ---
    await proyector.pulsa('Siguiente', { exacto: true });
    await ana.esperaTexto('Pregunta 3 de 5');
    c = await correctaActual(proyector);
    await responde(ana, c);
    await proyector.esperaTexto('1 de 3 han respondido');
    await proyector.recargar();
    await proyector.esperaTexto('Hay una partida sin terminar');
    await compruebaQueCabe(proyector, 'recuperar partida');
    await proyector.captura('12-proyector-recuperar.png');
    await proyector.pulsa('Continuar partida');
    await proyector.esperaTexto('1 de 3 han respondido');
    comprobar(true, 'el proyector recarga y la partida sigue con la respuesta de Ana');
    await responde(bea, c);
    await responde(ana2, c);
    await proyector.esperaTexto('Siguiente');

    // --- Pregunta 4: solo responde Ana; se cierra por tiempo ---
    await proyector.pulsa('Siguiente', { exacto: true });
    await ana.esperaTexto('Pregunta 4 de 5');
    c = await correctaActual(proyector);
    await responde(ana, (c + 1) % 4);
    const inicio = Date.now();
    await proyector.esperaTexto('Siguiente', 13_000);
    comprobar(Date.now() - inicio > 8_000, `la 4.ª se cierra por tiempo (${((Date.now() - inicio) / 1000).toFixed(1)} s tras la respuesta de Ana)`);
    await bea.esperaTexto('Sin respuesta');
    await bea.captura('13-movil-sin-respuesta.png');

    // --- Pregunta 5 y final ---
    await proyector.pulsa('Siguiente', { exacto: true });
    await ana.esperaTexto('Pregunta 5 de 5');
    c = await correctaActual(proyector);
    await responde(bea, c);
    await responde(ana, c);
    await responde(ana2, (c + 3) % 4);
    await proyector.esperaTexto('Ver podio');
    await proyector.captura('14-proyector-ultima-respuesta.png');
    await proyector.pulsa('Ver podio');
    await proyector.esperaTexto('Aciertos de la clase');
    await compruebaQueCabe(proyector, 'podio');
    await proyector.captura('15-proyector-podio.png');
    for (const m of moviles) await m.esperaTexto('has quedado');
    await compruebaQueCabe(ana, 'final');
    await ana.captura('16-movil-final.png');
    await bea.captura('17-movil-final-bea.png');

    await proyector.pulsa('Ver resultados de todos');
    await proyector.esperaTexto('Resultados de todos');
    await compruebaQueCabe(proyector, 'tabla');
    await proyector.captura('18-proyector-tabla.png');
    await proyector.pulsa('Descargar CSV');
    await espera(1500);
    const csv = readdirSync(descargas).filter(f => f.endsWith('.csv'));
    const contenido = csv[0] ? readFileSync(join(descargas, csv[0]), 'utf8') : '';
    console.log(`      CSV ${csv[0]}:\n${contenido.replace(/^/gm, '        ')}`);
    comprobar(contenido.startsWith('﻿Puesto;Nombre;Puntos;Aciertos (de 5);Mejor racha') && contenido.split('\r\n').length === 5,
        'el CSV se descarga con BOM, «;», cabecera y 3 filas');
    writeFileSync(join(carpeta, 'resultados.csv'), contenido);

    // Coherencia: lo que ve cada móvil coincide con la tabla del proyector.
    const filas = contenido.trim().split('\r\n').slice(1).map(l => l.split(';'));
    for (const [m, nombre] of [[ana, 'Ana'], [bea, 'Bea'], [ana2, 'Ana 2']]) {
        const fila = filas.find(f => f[1] === nombre);
        const t = await m.texto();
        comprobar(fila && t.includes(`${fila[0]}.º`) && (await puntosDe(m) === Number(fila[2]) || t.includes(Number(fila[2]).toLocaleString('es-ES'))),
            `${nombre} ve su puesto (${fila?.[0]}.º) y sus puntos (${fila?.[2]}) en el móvil`);
    }

    for (const p of [proyector, ...moviles]) comprobar(p.errores.length === 0, `${p.nombre}: sin errores en la consola ${p.errores.length ? JSON.stringify(p.errores) : ''}`);
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
