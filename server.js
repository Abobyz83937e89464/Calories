const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const https = require('https');

// Твои конфиги
const TELEGRAM_TOKEN = '8404227234:AAFMLGVkxz6Qf3J7m61KR8BNni4kDP1B9t8';
const GROQ_API_KEY = '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';

// Ссылка на твой сервер на Render (замени после создания веб-сервиса)
const APP_URL = 'https://твой-проект.onrender.com'; 

// Инициализация
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: GROQ_API_KEY });
const app = express();

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// === СИСТЕМА АНТИ-СОН (SELF-PING) ===
// Пингует сервер каждые 14 минут, чтобы Render не усыплял процесс
setInterval(() => {
    https.get(APP_URL, (res) => {
        console.log(`Self-ping status: ${res.statusCode} (Keeping the engine warm...)`);
    }).on('error', (err) => {
        console.error('Self-ping error:', err.message);
    });
}, 14 * 60 * 1000); // 14 минут в миллисекундах


// === TELEGRAM BOT LOGIC ===
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, 'Привет! Нажми кнопку ниже, чтобы начать считать калории 🍏', {
        reply_markup: {
            inline_keyboard: [[
                { text: '📸 Открыть сканер еды', web_app: { url: APP_URL } }
            ]]
        }
    });
});

// === API ДЛЯ РАБОТЫ С GROQ (VISION) ===
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    try {
        const { dishName, weight, sauces, extraInfo } = req.body;
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');

        // Креативный промпт, чтобы ответы не повторялись для разных юзеров
        const promptText = `
Ты опытный диетолог с чувством юмора. Твоя цель: максимально точно разобрать еду по фото.
ВАЖНО: Каждый раз пиши ответ в новом стиле (можешь менять тон от дружеского до строго-научного), чтобы пользователи не видели одинаковых шаблонов.

Данные от пользователя:
- Название: ${dishName || 'Неизвестно'}
- Вес: ${weight || 'На глаз'}
- Соусы: ${sauces || 'Без соусов'}
- Контекст: ${extraInfo || 'Нет уточнений'}

Выдай результат по пунктам:
1. Оценка КБЖУ (Каллории, Белки, Жиры, Углеводы) — старайся быть максимально точным.
2. Состав (что ты видишь на тарелке).
3. Краткий совет (например, "добавь овощей" или "отличный выбор для завтрака").
        `;

        const response = await groq.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ],
            temperature: 0.8, // Чуть выше для разнообразия ответов
            max_tokens: 1024,
        });

        res.json({ success: true, result: response.choices[0].message.content });
    } catch (error) {
        console.error("Ошибка Groq:", error);
        res.status(500).json({ success: false, error: 'Ошибка анализа. Проверь освещение на фото.' });
    }
});

// Роут для проверки работоспособности (на него и будет стучать пингер)
app.get('/', (req, res) => {
    res.send('Server is alive and kicking!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}. Anti-sleep active.`);
});
