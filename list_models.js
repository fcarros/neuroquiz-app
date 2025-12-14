require('dotenv').config();
const fs = require('fs');

async function listModels() {
    try {
        console.log("Listing models via REST API...");
        fs.writeFileSync('list_log.txt', "Listing models...\n");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("Found models:");
            const lines = [];
            data.models.forEach(m => {
                // if (m.supportedGenerationMethods.includes("generateContent")) {
                lines.push(`- ${m.name}`);
                // }
            });
            fs.appendFileSync('list_log.txt', lines.join('\n'));
        } else {
            fs.appendFileSync('list_log.txt', "No models found or error: " + JSON.stringify(data));
        }

    } catch (e) {
        fs.appendFileSync('list_log.txt', "Error listing models: " + e.toString());
    }
}

listModels();
