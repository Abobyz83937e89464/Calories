const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const cors = require('cors');
const https = require('https');

// === КОНФИГУРАЦИЯ ===
const TELEGRAM_TOKEN = '8404227234:AAFMLGVkxz6Qf3J7m61KR8BNni4kDP1B9t8';
const GEMINI_API_KEY = 'AIzaSyBsIAOJDcCzclqDMjUwtpKeLWePjRYa6gc';
const GITHUB_WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

// Авто-определение своего URL для пинга на Render
const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;

// Инициализация AI и Бота
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// === СИСТЕМА АНТИ-СОН (КАЖДЫЕ 14 МИНУТ) ===
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        https.get(APP_URL, (res) => {
            console.log(`Self-ping: ${res.statusCode} - Keep alive`);
        }).on('error', (e) => console.error('Ping error:', e.message));
    }
}, 14 * 60 * 1000);

// === ЛОГИКА ТЕЛЕГРАМ БОТА ===
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет! Нажми кнопку ниже, чтобы открыть сканер калорий 🍏', {
        reply_markup: {
            inline_keyboard: [[
                { text: '📸 Считать калории', web_app: { url: GITHUB_WEB_APP_URL } }
            ]]
        }
    });
});

// === API ДЛЯ АНАЛИЗА ФОТО ЧЕРЕЗ GEMINI 1.5 FLASH ===
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'Нет фото' });

        const { dishName, weight, sauces, extraInfo } = req.body;
        
        // Выбираем модель Gemini 1.5 Flash
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
        Ты - крутой диетолог-нутрициолог. Твоя задача: проанализировать еду на фото.
        Общайся дружелюбно, каждый раз меняй стиль ответа (используй разные фразы, шутки или факты).
        
        Данные от пользователя:
        - Что это: ${dishName || 'Не указано'}
        - Вес: ${weight || 'Неизвестен'}
        - Соусы: ${sauces || 'Нет'}
        - Доп. инфо: ${extraInfo || 'Нет'}

        Выдай ответ строго по пунктам:
        1. КБЖУ (Ккал, Белки, Жиры, Углеводы) — оцени максимально точно.
        2. Из чего состоит блюдо (список ингредиентов, которые видишь).
        3. Маленький совет по этому приему пищи.
        `;

        // Превращаем буфер фото в формат, который понимает Gemini
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        res.json({ success: true, result: text });

    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ success: false, error: 'Ошибка нейросети. Попробуй еще раз.' });
    }
});

app.get('/', (req, res) => res.send('Server is active!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
