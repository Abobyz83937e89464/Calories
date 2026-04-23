const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const WEB_APP_URL = 'https://calories-1-pitp.onrender.com/';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

console.log("=== OPENROUTER VISION SERVER ===");


// 🧠 Vision через OpenRouter (СТАБИЛЬНО)
async function analyzeImage(base64, mime) {
    console.log(">>> OpenRouter анализ...");

    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: "nvidia/nemotron-nano-12b-v2-vl:free",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Опиши еду на фото и оцени КБЖУ"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mime};base64,${base64}`
                            }
                        }
                    ]
                }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            }
        }
    );

    return res.data.choices[0].message.content;
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("\n=== /api/analyze HIT ===");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Фото не дошло до сервера'
            });
        }

        const base64 = req.file.buffer.toString('base64');
        const mime = req.file.mimetype;

        const resultText = await analyzeImage(base64, mime);

        res.json({
            success: true,
            result: resultText
        });

    } catch (error) {
        console.error("!!! ERROR:", error.response?.data || error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


app.get('/', (req, res) => res.send('Server alive 🚀'));

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== SERVER STARTED ${PORT} ===`);
});
