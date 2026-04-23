const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const multer = require('multer');
const cors = require('cors');

// Данные
const TG_TOKEN = '8404227234:AAFUZylDqfvBta443_fDYM1rTVz6UlA5Kuk';
const GROQ_API_KEY = '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';
const WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

const app = express();
const groq = new Groq({ apiKey: GROQ_API_KEY });
const bot = new TelegramBot(TG_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Логируем старт
console.log("=== ИНИЦИАЛИЗАЦИЯ СЕРВЕРА ===");

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '📸 Сканер готов! Открывай камеру.', {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть камеру', web_app: { url: WEB_APP_URL } }]] }
    });
});

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    console.log(">>> [1] Получен запрос на /api/analyze");
    
    try {
        if (!req.file) {
            console.error("!!! Ошибка: Файл не найден в запросе");
            return res.status(400).json({ success: false, error: 'Фото не дошло до сервера' });
        }

        console.log(`>>> [2] Фото получено. Размер: ${req.file.size} байт. Тип: ${req.file.mimetype}`);

        const base64Image = req.file.buffer.toString('base64');
        const { dishName, weight } = req.body;

        const prompt = `Ты диетолог. Оцени еду на фото. Название: ${dishName || 'неизвестно'}, Вес: ${weight || 'неизвестен'}. Выдай КБЖУ и краткий состав на русском языке.`;

        // Список моделей для теста (Llama 3.2 Vision - самая стабильная)
        const modelName = "llama-3.2-11b-vision-preview";
        console.log(`>>> [3] Отправка запроса в Groq (модель: ${modelName})...`);

        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": prompt },
                        {
                            "type": "image_url",
                            "image_url": { "url": `data:image/jpeg;base64,${base64Image}` }
                        }
                    ]
                }
            ],
            "model": modelName,
            "temperature": 0.5,
            "max_tokens": 1024
        }).catch(err => {
            // Это поймает ошибку именно от API Groq
            console.error("!!! [GROQ API ERROR]:", err.message);
            throw new Error(`Groq API отказал: ${err.message}`);
        });

        console.log(">>> [4] Ответ от Groq получен успешно.");
        const resultText = chatCompletion.choices[0].message.content;
        
        res.json({ success: true, result: resultText });

    } catch (error) {
        console.error("!!! [КРИТИЧЕСКАЯ ОШИБКА СЕРВЕРА]:", error);
        
        // Отправляем ПРЯМУЮ причину ошибки в браузер
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack // Это выведет в логи, где именно в коде беда
        });
    }
});

app.get('/', (req, res) => res.send('Server is alive! Mode: Groq-Debug'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT} ===`);
});
