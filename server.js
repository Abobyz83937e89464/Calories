const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const cors = require('cors');

// Данные
const TG_TOKEN = '8404227234:AAFMLGVkxz6Qf3J7m61KR8BNni4kDP1B9t8';
const GEMINI_KEY = 'AIzaSyBsIAOJDcCzclqDMjUwtpKeLWePjRYa6gc';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const bot = new TelegramBot(TG_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Настройка CORS (чтобы связь не рвалась)
app.use(cors({ origin: '*' }));
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Бот
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Жми кнопку для запуска сканера! 🍏', {
        reply_markup: { inline_keyboard: [[{ text: '📸 Сканировать', web_app: { url: WEB_APP_URL } }]] }
    });
});

// Анализ фото
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) throw new Error('Фото не получено');

        const { dishName, weight } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Ты диетолог. Проанализируй фото еды. Название: ${dishName}, Вес: ${weight}. Выдай КБЖУ и состав на русском языке. Будь краток.`;

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype || "image/jpeg"
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();

        res.json({ success: true, result: text });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/', (req, res) => res.send('Server live!'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
