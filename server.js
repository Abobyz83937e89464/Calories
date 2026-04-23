const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const cors = require('cors');

// Данные (уже вшиты)
const TG_TOKEN = '8404227234:AAHAVFS9mH4obEgkoPjIT5l9hD9WVAeJPIc';
const GEMINI_KEY = 'AIzaSyBsIAOJDcCzclqDMjUwtpKeLWePjRYa6gc';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Настройка бота с защитой от вылета
const bot = new TelegramBot(TG_TOKEN, { polling: true });
bot.on('polling_error', (error) => console.log('Ошибка бота (игнорим):', error.code));

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Команда старт
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер готов! Жми кнопку:', {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: WEB_APP_URL } }]] }
    });
});

// Главный обработчик
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("Запрос получен, начинаю перебор моделей...");
    
    if (!req.file) return res.status(400).json({ success: false, error: 'Нет фото' });

    // Список моделей, которые мы будем пробовать по очереди
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];
    
    for (const modelName of modelsToTry) {
        try {
            console.log(`Пробую: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const prompt = "Ты диетолог. Оцени еду на фото. Выдай КБЖУ и состав на русском.";
            const imagePart = {
                inlineData: {
                    data: req.file.buffer.toString("base64"),
                    mimeType: req.file.mimetype || "image/jpeg"
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            console.log(`УСПЕХ с ${modelName}`);
            return res.json({ success: true, result: text });

        } catch (err) {
            console.error(`Ошибка с ${modelName}:`, err.message);
            // Если это была последняя модель и она не сработала — идем в финал
            if (modelName === modelsToTry[modelsToTry.length - 1]) {
                return res.status(500).json({ success: false, error: "Google API недоступен в этом регионе. Проверь настройки Render (Oregon)." });
            }
        }
    }
});

app.get('/', (req, res) => res.send('Server is alive!'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT} ===`);
});
