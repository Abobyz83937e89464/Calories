const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const multer = require('multer');
const cors = require('cors');
const https = require('https');

// === КОНФИГУРАЦИЯ ===
const TG_TOKEN = '8404227234:AAEJDrxC5Kn4tY_ny3lBGrsdRaDpDUUj2YU';
const GROQ_API_KEY = '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';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const groq = new Groq({ apiKey: GROQ_API_KEY });
const bot = new TelegramBot(TG_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Список актуальных Vision-моделей Groq
const VISION_MODELS = [
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview"
];

// Анти-сон для Render
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL;
    if (url) https.get(url, () => {}).on('error', () => {});
}, 14 * 60 * 1000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер калорий на Groq запущен! Жми кнопку:', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: WEB_APP_URL } }]]
        }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("--- ЗАПРОС НА АНАЛИЗ (GROQ) ---");
    
    if (!req.file) return res.status(400).json({ success: false, error: 'Файл не получен' });

    const base64Image = req.file.buffer.toString('base64');
    const { dishName, weight } = req.body;

    const prompt = `Ты диетолог. Оцени еду на фото. 
    Название: ${dishName || 'неизвестно'}, Вес: ${weight || 'неизвестен'}. 
    Выдай КБЖУ и краткий состав на русском языке.`;

    let lastError = null;

    // Перебор моделей
    for (const modelName of VISION_MODELS) {
        try {
            console.log(`Пробую Groq модель: ${modelName}...`);
            
            const chatCompletion = await groq.chat.completions.create({
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            { "type": "text", "text": prompt },
                            {
                                "type": "image_url",
                                "image_url": { "url": `data:image/jpeg;base64,${base64Image}` }
                            }
                        ]
                    }
                ],
                "model": modelName,
                "temperature": 0.5,
                "max_tokens": 1024
            });

            const resultText = chatCompletion.choices[0].message.content;
            console.log(`УСПЕХ: ${modelName} ответила!`);
            return res.json({ success: true, result: resultText });

        } catch (error) {
            console.error(`Ошибка ${modelName}:`, error.message);
            lastError = error;
        }
    }

    res.status(500).json({ 
        success: false, 
        error: "Ошибка анализа фото.",
        debug: lastError ? lastError.message : "Unknown error"
    });
});

app.get('/', (req, res) => res.send('Groq Server: Online'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН (ПОРТ ${PORT}) ===`);
});
