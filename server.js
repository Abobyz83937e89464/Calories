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

console.log("=== DEBUG OPENROUTER SERVER ===");

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


// 🔥 МОДЕЛИ (несколько сразу)
const MODELS = [
    "nvidia/nemotron-nano-12b-vl:free",
    "qwen/qwen2.5-vl-7b-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free"
];

async function tryModels(prompt, base64, mime) {
    for (const model of MODELS) {
        try {
            console.log(`\n>>> Пробуем модель: ${model}`);

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

            console.log(`✅ УСПЕХ: ${model}`);

            return {
                modelUsed: model,
                text: res.data.choices[0].message.content
            };

        } catch (err) {
            console.log(`❌ ОШИБКА МОДЕЛИ: ${model}`);

            if (err.response) {
                console.log("STATUS:", err.response.status);
                console.log("DATA:", JSON.stringify(err.response.data, null, 2));
            } else {
                console.log("ERROR:", err.message);
            }
        }
    }

    throw new Error("Все модели отвалились (смотри логи)");
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("\n=== НОВЫЙ ЗАПРОС ===");

    try {
        if (!req.file) {
            console.error("!!! Нет файла");
            return res.status(400).json({
                success: false,
                error: 'Фото не дошло до сервера'
            });
        }

        console.log(`>>> Фото: ${req.file.size} байт, ${req.file.mimetype}`);

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


// ❤️ ПИНГ (14 минут)
setInterval(async () => {
    try {
        await axios.get("https://calories-1-pitp.onrender.com/");
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
