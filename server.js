const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const multer = require('multer');
const cors = require('cors');

// Данные (лучше потом вынеси в env)
const TG_TOKEN = process.env.TG_TOKEN || '8404227234:AAEspH56VB5-zKWUW68twg1qMwcEedmCmwI';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const groq = new Groq({ apiKey: GROQ_API_KEY });
const bot = new TelegramBot(TG_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

console.log("=== ИНИЦИАЛИЗАЦИЯ СЕРВЕРА ===");

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер готов! Открывай камеру.', {
        reply_markup: {
            inline_keyboard: [[{
                text: 'Открыть камеру',
                web_app: { url: WEB_APP_URL }
            }]]
        }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log(">>> [1] Получен запрос");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Фото не пришло'
            });
        }

        const base64Image = req.file.buffer.toString('base64');
        const { dishName, weight } = req.body;

        const prompt = `Ты профессиональный диетолог.
Определи блюдо на фото и оцени его.

Название: ${dishName || 'неизвестно'}
Вес: ${weight || 'неизвестен'}

Ответ выдай строго в формате:

Название блюда:
Калории:
Белки:
Жиры:
Углеводы:
Описание:`;

        // 🔥 НОВАЯ МОДЕЛЬ
        const modelName = "llama-3.2-90b-vision-preview";

        console.log(">>> [2] Запрос в Groq...");

        const chatCompletion = await groq.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.4,
            max_tokens: 800
        });

        const resultText = chatCompletion.choices[0].message.content;

        console.log(">>> [3] УСПЕХ");

        res.json({
            success: true,
            result: resultText
        });

    } catch (error) {
        console.error("!!! ERROR:", error);

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
