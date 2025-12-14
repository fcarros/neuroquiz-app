require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.use(express.static('public'));

console.log("-----------------------------------------");
console.log("Server Starting...");
console.log("OPENAI_API_KEY Present:", !!process.env.OPENAI_API_KEY);
if (!process.env.OPENAI_API_KEY) {
    console.error("CRITICAL: NO OPENAI API KEY FOUND IN .ENV");
}
console.log("-----------------------------------------");

// Game State
const games = {};

// AI Setup (OpenAI)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: Generate PIN
function generatePIN() {
    let pin = Math.floor(100000 + Math.random() * 900000).toString();
    while (games[pin]) {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
    }
    return pin;
}

// Helper: Calculate Score
function calculateScore(timeLeft, totalTime = 20) {
    // 1000 points max, drops as time passes
    const percentage = timeLeft / totalTime;
    return Math.floor(1000 * percentage);
}

// Route: Upload PDF & Generate Game
app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF uploaded' });
        }
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'Server missing OpenAI API Key' });
        }

        const dataBuffer = fs.readFileSync(req.file.path);
        const data = await pdfParse(dataBuffer);
        const text = data.text.substring(0, 20000);

        // Get number of questions from request, default to 10 if invalid
        let numQuestions = parseInt(req.body.numQuestions);
        if (isNaN(numQuestions) || numQuestions < 3 || numQuestions > 20) {
            numQuestions = 10;
        }

        const difficulty = req.body.difficulty || "Medium";

        const prompt = `Based on the following text, generate ${numQuestions} multiple-choice quiz questions. 
        Each question MUST have 4 options (A, B, C, D) and one correct answer.
        Difficulty Level: ${difficulty}.
        - If Easy: Use simple vocabulary and direct questions.
        - If Hard: Use complex concepts and require inference.
        
        Output valid JSON with a root key "questions" containing an array.
        Format:
        {
            "questions": [
                {
                    "question": "Question text",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctIndex": 0 // 0 for A, 1 for B, etc.
                }
            ]
        }
        
        Text content:
        ${text}`;

        console.log("Sending request to OpenAI...");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a helpful assistant designed to output valid JSON for a quiz app." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        console.log("OpenAI Response received. Length:", content.length);

        const parsed = JSON.parse(content);
        let questions = parsed.questions;

        if (!questions || !Array.isArray(questions)) {
            throw new Error("Invalid JSON structure from OpenAI: missing 'questions' array");
        }

        // Create Game
        const pin = generatePIN();
        games[pin] = {
            questions: questions,
            players: {},
            hostSocket: null,
            state: 'lobby',
            currentQuestion: -1,
            answers: {} // { questionIndex: { playerId: { answerIndex, score } } }
        };

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ pin, questionsCount: questions.length });

    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ error: error.message || 'Failed to generate quiz' });
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Host Joins
    socket.on('host_join', (pin) => {
        if (games[pin]) {
            games[pin].hostSocket = socket.id;
            socket.join(pin);
            socket.emit('host_success', { pin, players: games[pin].players });
        } else {
            socket.emit('error', 'Game not found');
        }
    });

    // Player Joins
    socket.on('player_join', ({ pin, name }) => {
        if (games[pin] && games[pin].state === 'lobby') {
            games[pin].players[socket.id] = {
                name,
                score: 0,
                id: socket.id
            };
            socket.join(pin);
            // Notify Host
            if (games[pin].hostSocket) {
                io.to(games[pin].hostSocket).emit('player_joined', { name, id: socket.id, count: Object.keys(games[pin].players).length });
            }
            socket.emit('join_success', { name, pin });
        } else {
            socket.emit('error', 'Invalid PIN or Game Started');
        }
    });

    // Start Game
    socket.on('start_game', (pin) => {
        if (games[pin] && games[pin].hostSocket === socket.id) {
            games[pin].state = 'playing';
            games[pin].currentQuestion = 0;
            sendQuestion(pin);
        }
    });

    // Next Question
    socket.on('next_question', (pin) => {
        if (games[pin] && games[pin].hostSocket === socket.id) {
            games[pin].currentQuestion++;
            if (games[pin].currentQuestion < games[pin].questions.length) {
                sendQuestion(pin);
            } else {
                endGame(pin);
            }
        }
    });

    // Player Answers
    socket.on('submit_answer', ({ pin, answerIndex, timeLeft }) => {
        const game = games[pin];
        if (game && game.state === 'question_active') {
            // Record answer
            const qIndex = game.currentQuestion;
            if (!game.answers[qIndex]) game.answers[qIndex] = {};

            // Prevent double answering
            if (game.answers[qIndex][socket.id]) return;

            const correctAnswer = game.questions[qIndex].correctIndex;
            const isCorrect = answerIndex === correctAnswer;
            const points = isCorrect ? calculateScore(timeLeft, game.timeLimit) : 0;

            game.players[socket.id].score += points;
            game.answers[qIndex][socket.id] = { answerIndex, points };

            // Feedback to player
            socket.emit('answer_result', { correct: isCorrect, points });

            // Notify host of progress (optional)
            if (game.hostSocket) {
                io.to(game.hostSocket).emit('update_answers_count', Object.keys(game.answers[qIndex]).length);
            }
        }
    });

    // Host shows results for current question
    socket.on('show_results', (pin) => {
        if (games[pin] && games[pin].hostSocket === socket.id) {
            games[pin].state = 'results';
            const qIndex = games[pin].currentQuestion;
            const correctAnswer = games[pin].questions[qIndex].correctIndex;
            // Send stats to host
            const stats = [0, 0, 0, 0];
            if (games[pin].answers[qIndex]) {
                Object.values(games[pin].answers[qIndex]).forEach(ans => {
                    if (ans.answerIndex >= 0 && ans.answerIndex < 4) stats[ans.answerIndex]++;
                });
            }

            // Send leaderboard
            const leaderboard = Object.values(games[pin].players)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            io.to(pin).emit('question_results', {
                correctAnswer,
                stats,
                leaderboard
            });
        }
    });

    socket.on('disconnect', () => {
        // Handle disconnects? detailed handling skipped for MVP
    });
});

function sendQuestion(pin) {
    const game = games[pin];
    game.state = 'question_active';
    const qIndex = game.currentQuestion;
    const q = game.questions[qIndex];

    // Clear previous feedback for next question
    io.to(pin).emit('new_question', {
        question: q.question,
        options: q.options,
        qIndex: qIndex + 1,
        total: game.questions.length,
        timeLimit: game.timeLimit || 20
    });
}

function endGame(pin) {
    const game = games[pin];
    game.state = 'finished';
    const leaderboard = Object.values(game.players).sort((a, b) => b.score - a.score);
    io.to(pin).emit('game_over', leaderboard);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
