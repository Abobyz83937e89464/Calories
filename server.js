const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const cors = require('cors');
const https = require('https');

// === КОНФИГУРАЦИЯ (Твои данные) ===
const TG_TOKEN = '8404227234:AAH4KrNWqrtMmTz9PHd3QJVeLCPWka-JR5E';
const GEMINI_KEY = 'AIzaSyBsIAOJDcCzclqDMjUwtpKeLWePjRYa6gc';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const bot = new TelegramBot(TG_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Переменная, куда бот сохранит найденную модель
let activeModelName = "gemini-1.5-flash"; 

// === ФУНКЦИЯ АВТОПОДБОРА МОДЕЛИ ===
async function findWorkingVisionModel() {
    try {
        console.log("Запрашиваю список доступных моделей у Google...");
        // В некоторых версиях SDK метод называется listModels
        const client = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        // Если listModels не сработает напрямую, мы просто будем пробовать основные
        activeModelName = "gemini-1.5-flash"; 
        console.log("Использую по умолчанию: " + activeModelName);
    } catch (e) {
        console.error("Не удалось получить список моделей, юзаю стандарт.");
    }
}

// Запускаем поиск при старте
findWorkingVisionModel();

// Анти-сон для Render
const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:10000`;
setInterval(() => {
    https.get(APP_URL, (res) => {}).on('error', (e) => {});
}, 14 * 60 * 1000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер готов! Жми кнопку:', {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: WEB_APP_URL } }]] }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("--- ЗАПРОС НА АНАЛИЗ ---");
    
    if (!req.file) return res.status(400).json({ success: false, error: 'Нет фото' });

    // Список названий, которые мы попробуем по очереди, если один упадет
    const fallbackModels = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro-vision", "models/gemini-1.5-flash"];

    for (let modelName of fallbackModels) {
        try {
            console.log(`Попытка анализа моделью: ${modelName}`);
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

            console.log(`УСПЕХ с моделью: ${modelName}`);
            return res.json({ success: true, result: text });

        } catch (error) {
            console.error(`Ошибка модели ${modelName}:`, error.message);
            // Если это была последняя модель в списке и она упала — выходим в catch ниже
            if (modelName === fallbackModels[fallbackModels.length - 1]) {
                throw error;
            }
        }
    }
});

// Роут для проверки, что сервер жив
app.get('/', (req, res) => res.send(`Server Live. Active Model: ${activeModelName}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT} ===`);
});
