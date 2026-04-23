const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');

// 🔐 ключи
const TG_TOKEN = process.env.TG_TOKEN || '8404227234:AAH_f7x5t_vP6-k_KNx3oQVY07jDZ2MNV2Y';
const HF_TOKEN = process.env.HF_TOKEN || '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';
const WEB_APP_URL = 'https://calories-1-pitp.onrender.com/';

const app = express();

// 🔥 фикс Telegram 409
const bot = new TelegramBot(TG_TOKEN);
bot.deleteWebHook();
bot.startPolling();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

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
    console.log("\n=== НОВЫЙ ЗАПРОС ===");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Фото не дошло до сервера'
            });
        }

        console.log(`>>> Фото: ${req.file.size} байт`);

        const description = await analyzeImage(req.file.buffer);

        console.log(">>> Описание:", description);

        // 🔥 простой расчет (чтобы не городить второй AI)
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
