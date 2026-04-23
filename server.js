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

// 🔥 ЛОГ ВСЕХ ЗАПРОСОВ (очень важно)
app.use((req, res, next) => {
    console.log(">>> REQUEST:", req.method, req.url);
    next();
});

// 🔥 ВАЖНЫЕ middleware (фикс 404)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// multer ПОСЛЕ middleware
const upload = multer({ storage: multer.memoryStorage() });

// 🔥 фикс Telegram 409
const bot = new TelegramBot(TG_TOKEN);
bot.deleteWebHook().catch(() => {});
bot.stopPolling().catch(() => {});
setTimeout(() => {
    bot.startPolling();
}, 1000);

console.log("=== HF VISION SERVER START ===");

// кнопка
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


// 🧠 HF анализ картинки
async function analyzeImage(buffer) {
    console.log(">>> HF анализ...");

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

    return res.data[0].generated_text;
}


// 📸 API
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("\n=== /api/analyze HIT ===");

    try {
        if (!req.file) {
            console.log("❌ ФАЙЛ НЕ ПРИШЕЛ");
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
        console.error("!!! ОШИБКА:", error.response?.data || error.message);

        res.status(500).json({
            success: false,
            error: error.response?.data?.error || error.message,
            stack: error.stack
        });
    }
});


// ❤️ тестовый маршрут (чтобы убедиться что API жив)
app.get('/test', (req, res) => {
    res.send('TEST OK');
});

// корень
app.get('/', (req, res) => res.send('Server alive 🚀'));


// ❤️ пинг каждые 14 минут
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
