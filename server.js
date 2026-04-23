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
        https.get(APP_URL, (res) => {
            console.log(`Keep-alive ping: ${res.statusCode}`);
        }).on('error', (e) => console.error('Ping error:', e.message));
    }
}, 14 * 60 * 1000);

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет! Сканер готов к работе 🍏', {
        reply_markup: {
            inline_keyboard: [[{ text: '📸 Считать калории', web_app: { url: GITHUB_WEB_APP_URL } }]]
        }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log("--- ПОЛУЧЕН ЗАПРОС НА АНАЛИЗ ---");
    
    try {
        if (!req.file) {
            console.error("Ошибка: Файл не найден в запросе (multer)");
            return res.status(400).json({ success: false, error: 'Файл фото не дошел до сервера' });
        }

        console.log(`Файл получен: ${req.file.originalname}, размер: ${req.file.size} байт`);

        const { dishName, weight, sauces, extraInfo } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Ты диетолог. Оцени еду на фото. Данные: ${dishName}, ${weight}г, соус: ${sauces}, доп: ${extraInfo}. Выдай КБЖУ и состав.`;

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype || "image/jpeg"
            }
        };

        console.log("Отправка запроса в Google Gemini API...");
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log("--- УСПЕШНЫЙ ОТВЕТ ОТ GEMINI ---");
        res.json({ success: true, result: text });

    } catch (error) {
        // ВОТ ТУТ МАГИЯ ЛОГИРОВАНИЯ
        console.error("!!! ОШИБКА GEMINI API !!!");
        console.error("Сообщение:", error.message);
        
        if (error.response) {
            console.error("Данные ответа от Google:", JSON.stringify(error.response, null, 2));
        }

        // Отправляем конкретную ошибку на фронтенд, чтобы ты видел её в боте
        res.status(500).json({ 
            success: false, 
            error: `Ошибка: ${error.message.substring(0, 100)}...` 
        });
    }
});

app.get('/', (req, res) => res.send('Server is active!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен! Порт: ${PORT}`);
    console.log(`Используемый ключ Gemini: ${GEMINI_API_KEY.substring(0, 5)}...`);
});
