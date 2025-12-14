require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function log(msg) {
    console.log(msg);
    try {
        fs.appendFileSync('check_log.txt', msg + '\n');
    } catch (e) { console.error("Log file error:", e); }
}

async function testModel(modelName) {
    await log(`\nProbando conexión con '${modelName}'...`);
    try {
        // Remove specific config for simple test usually, or keep it if model supports it
        // gemini-pro doesn't like responseMimeType: json usually?
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Test");
        const response = await result.response;
        await log(`✅ MODELO VALIDO: ${modelName}`);
        await log("Respuesta: " + response.text());
        return true;
    } catch (error) {
        await log(`❌ FALLO ${modelName}: ` + error.toString());
        // if (error.toString().includes("404")) await log("Status: 404 Not Found");
        return false;
    }
}

async function run() {
    fs.writeFileSync('check_log.txt', '--- START LOG ---\n');
    await testModel("gemini-pro");
    await testModel("gemini-1.5-flash");
    await testModel("gemini-1.5-flash-latest");
    await testModel("gemini-1.5-flash-001");
}

run();
