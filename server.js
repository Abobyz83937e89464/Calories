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

const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Анти-сон
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        https.get(APP_URL, (res) => {}).on('error', (e) => {});
    }
}, 14 * 60 * 1000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер калорий в Орегоне запущен!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: GITHUB_WEB_APP_URL } }]]
        }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("--- ЗАПРОС ПОЛУЧЕН ---");
    
    if (!req.file) return res.status(400).json({ success: false, error: 'Нет фото' });

    try {
        // В Орегоне лучше всего использовать конкретную версию 1.5-flash
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Ты диетолог. Оцени еду на фото. Выдай КБЖУ и состав на русском языке.";
        
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype || "image/jpeg"
            }
        };

        console.log("Отправка в Gemini...");
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log("Успешный ответ!");
        res.json({ success: true, result: text });

    } catch (error) {
        console.error("ОШИБКА API:", error.message);
        
        // Если Google капризничает, выдаем детальный ответ
        res.status(500).json({ 
            success: false, 
            error: "Ошибка нейросети",
            debug: error.message 
        });
    }
});

app.get('/', (req, res) => res.send('Oregon Server OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on ${PORT}`));
