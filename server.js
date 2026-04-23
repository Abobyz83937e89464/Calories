const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const multer = require('multer');
const cors = require('cors');

// 🔐 Лучше вынести в ENV
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

// 📲 Telegram кнопка
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


// 🔥 СПИСОК МОДЕЛЕЙ (fallback)
const MODELS = [
    "llava-v1.5-7b-4096-preview",
    "llava-v1.5-13b-4096-preview",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview"
];

async function tryModels(messages) {
    for (const model of MODELS) {
        try {
            console.log(`>>> Пробуем модель: ${model}`);

            const res = await groq.chat.completions.create({
                model,
                messages,
                temperature: 0.4,
                max_tokens: 800
            });

            console.log(`✅ УСПЕХ: ${model}`);

            return {
                modelUsed: model,
                text: res.choices[0].message.content
            };

        } catch (err) {
            console.log(`❌ ${model} умерла: ${err.message}`);
        }
    }

    throw new Error("Нет доступных vision моделей");
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log(">>> [1] Запрос получен");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Фото не пришло'
            });
        }

        const base64 = req.file.buffer.toString('base64');
        const mime = req.file.mimetype;

        const { dishName, weight } = req.body;

        const prompt = `Ты диетолог. Оцени еду.

Название: ${dishName || 'неизвестно'}
Вес: ${weight || 'неизвестен'}

Ответ:

Название:
Калории:
Белки:
Жиры:
Углеводы:
Описание:`;

        const messages = [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mime};base64,${base64}`
                        }
                    }
                ]
            }
        ];

        const result = await tryModels(messages);

        res.json({
            success: true,
            result: result.text,
            model: result.modelUsed
        });

    } catch (error) {
        console.error("!!! КРИТИЧЕСКАЯ ОШИБКА:", error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/', (req, res) => res.send('Server alive 🚀'));

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН ${PORT} ===`);
});
