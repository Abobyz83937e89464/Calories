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

// Список моделей для перебора. В начале — самые стабильные и доступные.
const VISION_MODELS = [
    "gemini-1.5-flash", 
    "gemini-1.5-flash-latest", 
    "gemini-1.5-pro",
    "gemini-pro-vision" // Старая, но надежная модель
];

// Анти-сон
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        https.get(APP_URL, (res) => {}).on('error', (e) => {});
    }
}, 14 * 60 * 1000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер калорий готов к работе!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: GITHUB_WEB_APP_URL } }]]
        }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("--- НОВЫЙ ЗАПРОС НА АНАЛИЗ ---");
    
    if (!req.file) return res.status(400).json({ success: false, error: 'Файл не получен' });

    const { dishName, weight, sauces, extraInfo } = req.body;
    const prompt = `Ты диетолог. Оцени еду на фото. 
    Блюдо: ${dishName || 'не указано'}, 
    Вес: ${weight || 'не указан'}, 
    Соус: ${sauces || 'нет'}, 
    Доп: ${extraInfo || 'нет'}. 
    Выдай КБЖУ и краткий состав. Отвечай дружелюбно.`;
    
    const imagePart = {
        inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype || "image/jpeg"
        }
    };

    let lastError = null;

    // Пытаемся найти работающую модель
    for (const modelName of VISION_MODELS) {
        try {
            console.log(`Пробую запустить: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            console.log(`УСПЕХ: Модель ${modelName} сработала!`);
            return res.json({ success: true, result: text });
            
        } catch (error) {
            console.error(`Модель ${modelName} выдала ошибку:`, error.message);
            lastError = error;
            // Если ошибка 404 или 403, идем к следующей модели в списке
        }
    }

    // Если все модели "упали"
    console.error("!!! КРИТИЧЕСКАЯ ОШИБКА: НИ ОДНА МОДЕЛЬ НЕ ОТВЕТИЛА !!!");
    
    let userFriendlyError = "Все модели заняты или недоступны.";
    
    // Если ошибка региональная
    if (lastError.message.toLowerCase().includes("location") || lastError.message.includes("not supported")) {
        userFriendlyError = "Google блокирует запросы с твоего сервера. В настройках Render измени регион (Region) на US (Oregon или Ohio).";
    } else if (lastError.message.includes("404")) {
        userFriendlyError = "Ошибка 404: Модель не найдена в твоем регионе. Попробуй сменить регион сервера на USA в панели Render.";
    }

    res.status(500).json({ 
        success: false, 
        error: userFriendlyError,
        debug: lastError.message 
    });
});

app.get('/', (req, res) => res.send('Server status: OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`--- СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT} ---`));
