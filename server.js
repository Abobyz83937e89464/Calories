const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');

// 🔐 ключи
const TG_TOKEN = process.env.TG_TOKEN || '8404227234:AAEe634ABLyQ4o1NPtoZwiynXMhA2zPXMA0';
const HF_TOKEN = process.env.HF_TOKEN || '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';
const WEB_APP_URL = 'https://calories-1-pitp.onrender.com/';

const app = express();

// 🔥 лог всех запросов
app.use((req, res, next) => {
    console.log(">>> REQUEST:", req.method, req.url);
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// 🔥 фикс Telegram (чтоб не спамил)
const bot = new TelegramBot(TG_TOKEN, { polling: false });
bot.deleteWebHook().catch(() => {});
bot.startPolling();

console.log("=== HF VISION SERVER START ===");

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


// 🧠 HF с ретраем
async function analyzeImage(buffer) {
    console.log(">>> HF анализ...");

    for (let i = 0; i < 3; i++) {
        try {
            const res = await axios.post(
                "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
                buffer,
                {
                    headers: {
                        Authorization: `Bearer ${HF_TOKEN}`,
                        "Content-Type": "application/octet-stream"
                    },
                    timeout: 60000
                }
            );

            console.log("HF RESPONSE:", res.data);

            if (res.data?.error) {
                throw new Error(res.data.error);
            }

            return res.data[0]?.generated_text || "Не удалось распознать";

        } catch (err) {
            console.error(`HF ERROR [${i+1}]:`, err.response?.data || err.message);

            // если модель грузится — подождём и повторим
            if (i < 2) {
                console.log("⏳ Повтор через 3 сек...");
                await new Promise(r => setTimeout(r, 3000));
            } else {
                throw new Error("HuggingFace не отвечает");
            }
        }
    }
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("\n=== /api/analyze HIT ===");

    try {
        if (!req.file) {
            console.log("❌ Нет файла");
            return res.status(400).json({
                success: false,
                error: 'Фото не дошло до сервера'
            });
        }

        console.log(`>>> Фото: ${req.file.size} байт`);

        const description = await analyzeImage(req.file.buffer);

        console.log(">>> Описание:", description);

        const weight = req.body.weight || 150;

        const result = `
📊 АНАЛИЗ

🍽 Блюдо: ${description}

⚖️ Вес: ${weight} г

🔥 Калории: ~${Math.round(weight * 2)} ккал
🥩 Белки: ~${Math.round(weight * 0.1)} г
🧈 Жиры: ~${Math.round(weight * 0.08)} г
🍞 Углеводы: ~${Math.round(weight * 0.2)} г
`;

        res.json({
            success: true,
            result
        });

    } catch (error) {
        console.error("!!! SERVER ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// тест
app.get('/test', (req, res) => {
    res.send('TEST OK');
});

app.get('/', (req, res) => res.send('Server alive 🚀'));


// ❤️ пинг
setInterval(async () => {
    try {
        await axios.get(WEB_APP_URL);
        console.log("🔄 Пинг ок");
    } catch {
        console.log("❌ Пинг ошибка");
    }
}, 14 * 60 * 1000);


const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== SERVER STARTED ${PORT} ===`);
});
