const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🔐 ключи
const TG_TOKEN = process.env.TG_TOKEN || '8404227234:AAEspH56VB5-zKWUW68twg1qMwcEedmCmwI';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBsIAOJDcCzclqDMjUwtpKeLWePjRYa6gc';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const bot = new TelegramBot(TG_TOKEN, { polling: true });

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

console.log("=== ИНИЦИАЛИЗАЦИЯ СЕРВЕРА (GEMINI) ===");

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


// 🔥 модели (по приоритету)
const MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro"
];

async function tryModels(prompt, imagePart) {
    for (const modelName of MODELS) {
        try {
            console.log(`>>> Пробуем модель: ${modelName}`);

            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent([
                prompt,
                imagePart
            ]);

            const text = result.response.text();

            console.log(`✅ Используется модель: ${modelName}`);

            return {
                modelUsed: modelName,
                text
            };

        } catch (err) {
            console.log(`❌ ${modelName} не работает: ${err.message}`);
        }
    }

    throw new Error("Нет доступных Gemini vision моделей");
}


// 📸 API (твоя логика ошибок НЕ ТРОНУТА)
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log(">>> [1] Получен запрос на /api/analyze");

    try {
        if (!req.file) {
            console.error("!!! Ошибка: Файл не найден");
            return res.status(400).json({ success: false, error: 'Фото не дошло до сервера' });
        }

        console.log(`>>> [2] Фото получено: ${req.file.size} байт`);

        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        const { dishName, weight } = req.body;

        const prompt = `Ты диетолог. Оцени еду на фото.

Название: ${dishName || 'неизвестно'}
Вес: ${weight || 'неизвестен'}

Выдай КБЖУ и краткий состав на русском языке.`;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        };

        console.log(">>> [3] Отправка в Gemini...");

        const result = await tryModels(prompt, imagePart);

        console.log(">>> [4] Ответ получен");

        res.json({
            success: true,
            result: result.text,
            model: result.modelUsed
        });

    } catch (error) {
        console.error("!!! [КРИТИЧЕСКАЯ ОШИБКА]:", error);

        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('/', (req, res) => res.send('Server is alive! Gemini Mode'));

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН НА ${PORT} ===`);
});
