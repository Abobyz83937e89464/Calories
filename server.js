const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');

// 🔐 ключи
const TG_TOKEN = process.env.TG_TOKEN || '8404227234:AAHNfv3XZji2E8r6EdOquy7SJ3ajPUuI-Ww';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const WEB_APP_URL = 'https://calories-1-pitp.onrender.com/';

const app = express();

// 🔥 фикс Telegram 409
const bot = new TelegramBot(TG_TOKEN);
bot.deleteWebHook();
bot.startPolling();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

console.log("=== OPENROUTER VISION SERVER ===");

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


// 🔥 ТВОЯ РАБОЧАЯ МОДЕЛЬ
const MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

async function analyzeWithVision(prompt, base64, mime) {
    console.log(`>>> Используем модель: ${MODEL}`);

    const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: MODEL,
            messages: [
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
            ]
        },
        {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": WEB_APP_URL,
                "X-Title": "calorie-app",
                "Content-Type": "application/json"
            }
        }
    );

    return res.data.choices[0].message.content;
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("\n=== НОВЫЙ ЗАПРОС ===");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Фото не дошло до сервера'
            });
        }

        console.log(`>>> Фото: ${req.file.size} байт`);

        const base64 = req.file.buffer.toString('base64');
        const mime = req.file.mimetype;

        const { dishName, weight } = req.body;

        const prompt = `Ты диетолог. Оцени еду на фото.

Название: ${dishName || 'неизвестно'}
Вес: ${weight || 'неизвестен'}

Выдай КБЖУ и краткий состав на русском языке.`;

        const resultText = await analyzeWithVision(prompt, base64, mime);

        res.json({
            success: true,
            result: resultText,
            model: MODEL
        });

    } catch (error) {
        console.error("!!! ОШИБКА:", error.response?.data || error.message);

        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});


// ❤️ пинг каждые 14 минут
setInterval(async () => {
    try {
        await axios.get(WEB_APP_URL);
        console.log("🔄 Пинг ок");
    } catch {
        console.log("❌ Пинг ошибка");
    }
}, 14 * 60 * 1000);


app.get('/', (req, res) => res.send('Server alive 🚀'));

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== SERVER STARTED ${PORT} ===`);
});
