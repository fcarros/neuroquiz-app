require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const candidates = [
    "gemini-2.0-flash",          // The one we saw in list
    "gemini-1.5-flash",
    "gemini-pro-latest",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-001",
    "gemini-pro"
];

async function log(msg) {
    console.log(msg);
    fs.appendFileSync('fix_log.txt', msg + '\n');
}

async function autoFix() {
    fs.writeFileSync('fix_log.txt', '--- START FIX LOG ---\n');
    await log("🛠️ INICIANDO PROTOCOLO DE REPARACIÓN DE MODELOS...");

    for (const modelName of candidates) {
        await log(`👉 Probando '${modelName}'... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            await model.generateContent("Test");

            await log(`✅ ¡ÉXITO! Funciona.`);

            let serverCode = fs.readFileSync('server.js', 'utf8');
            const regex = /model:\s*"[^"]+"/;
            const newCode = serverCode.replace(regex, `model: "${modelName}"`);
            fs.writeFileSync('server.js', newCode);
            await log(`💾 'server.js' ha sido actualizado con: ${modelName}`);
            process.exit(0);

        } catch (error) {
            await log(`❌ FALLÓ ${modelName}: ${error.message}`);
        }
    }
    await log("💀 FATAL: Ningún modelo funcionó.");
    process.exit(1);
}

autoFix();
