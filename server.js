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

// Список моделей для перебора (от самой легкой к самой мощной)
const VISION_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];

// Анти-сон
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        https.get(APP_URL, (res) => {}).on('error', (e) => console.error('Ping error'));
    }
}, 14 * 60 * 1000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер калорий готов!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: GITHUB_WEB_APP_URL } }]]
        }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("--- НОВЫЙ ЗАПРОС ---");
    
    if (!req.file) return res.status(400).json({ success: false, error: 'Нет файла' });

    const { dishName, weight, sauces, extraInfo } = req.body;
    const prompt = `Ты диетолог. Оцени еду на фото. Данные: ${dishName}, ${weight}г, соус: ${sauces}, доп: ${extraInfo}. Выдай КБЖУ и состав.`;
    
    const imagePart = {
        inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype || "image/jpeg"
        }
    };

    // Перебор моделей
    let lastError = null;
    for (const modelName of VISION_MODELS) {
        try {
            console.log(`Пробую модель: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            console.log(`Успех с моделью ${modelName}!`);
            return res.json({ success: true, result: text });
        } catch (error) {
            console.error(`Ошибка с ${modelName}:`, error.message);
            lastError = error;
            // Если ошибка связана с ключом или регионом, пробуем следующую
            continue; 
        }
    }

    // Если ни одна модель не сработала
    console.error("!!! ВСЕ МОДЕЛИ ОТКАЗАЛИ !!!");
    console.error("Детальная ошибка:", lastError);

    let finalMsg = lastError.message;
    if (finalMsg.includes("location is not supported")) {
        finalMsg = "Google блокирует доступ из региона, где находится сервер Render. Попробуй сменить регион сервера на US в настройках Render.";
    }

    res.status(500).json({ 
        success: false, 
        error: `Ошибка API: ${finalMsg}` 
    });
});

app.get('/', (req, res) => res.send('Server Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
