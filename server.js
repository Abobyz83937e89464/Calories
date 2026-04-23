const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');

// 🔐 ключи
const TG_TOKEN = process.env.TG_TOKEN || '8404227234:AAFJYdZ20nKar8_UbChC-4MghkEjWKQCmys';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const bot = new TelegramBot(TG_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

console.log("=== ИНИЦИАЛИЗАЦИЯ OPENROUTER СЕРВЕРА ===");

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


// 🔥 модели (начинаем с Nemotron)
const MODELS = [
    "nvidia/nemotron-nano-12b-vl:free"
];

async function tryModels(prompt, base64, mime) {
    for (const model of MODELS) {
        try {
            console.log(`>>> Пробуем модель: ${model}`);

            const res = await axios.post(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    model,
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
                        "Content-Type": "application/json"
                    }
                }
            );

            const text = res.data.choices[0].message.content;

            console.log(`✅ Используется модель: ${model}`);

            return {
                modelUsed: model,
                text
            };

        } catch (err) {
            console.log(`❌ ${model} ошибка:`, err.response?.data || err.message);
        }
    }

    throw new Error("Нет доступных моделей");
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log(">>> [1] Получен запрос");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Фото не дошло до сервера'
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

        const result = await tryModels(prompt, base64, mime);

        res.json({
            success: true,
            result: result.text,
            model: result.modelUsed
        });

    } catch (error) {
        console.error("!!! КРИТИЧЕСКАЯ ОШИБКА:", error);

        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});


// ❤️ ПИНГ КАЖДЫЕ 14 МИНУТ (чтобы Render не засыпал)
setInterval(async () => {
    try {
        await axios.get("https://calories-1-pitp.onrender.com/");
        console.log("🔄 Пинг отправлен");
    } catch (err) {
        console.log("❌ Пинг не прошёл");
    }
}, 14 * 60 * 1000);


app.get('/', (req, res) => res.send('Server alive 🚀'));

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН НА ${PORT} ===`);
});
