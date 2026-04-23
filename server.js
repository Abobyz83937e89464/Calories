const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');
const multer = require('multer');
const cors = require('cors');
const https = require('https');

// === КОНФИГУРАЦИЯ ===
const TELEGRAM_TOKEN = '8404227234:AAFMLGVkxz6Qf3J7m61KR8BNni4kDP1B9t8';
const GROQ_API_KEY = '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';

// Ссылка на твой фронтенд на GitHub
const GITHUB_WEB_APP_URL = 'https://abobyz83937e89464.github.io/Calories/';

// Авто-определение URL сервера на Render для пинга
const SERVER_SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;

// === ИНИЦИАЛИЗАЦИЯ ===
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const groq = new Groq({ apiKey: GROQ_API_KEY });
const app = express();

app.use(cors());
app.use(express.json());

// Настройка работы с изображениями (в памяти)
const upload = multer({ storage: multer.memoryStorage() });

// === СИСТЕМА АНТИ-СОН (SELF-PING) ===
// Каждые 14 минут стучимся по своему же адресу
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        https.get(SERVER_SELF_URL, (res) => {
            console.log(`Ping sent to ${SERVER_SELF_URL}: Status ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('Self-ping error:', err.message);
        });
    } else {
        console.log("Local mode: Self-ping skipped.");
    }
}, 14 * 60 * 1000); 

// === ЛОГИКА ТЕЛЕГРАМ БОТА ===
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, 'Привет! Готов считать калории? Нажми кнопку ниже, чтобы открыть сканер 🍏', {
        reply_markup: {
            inline_keyboard: [[
                { 
                    text: '📸 Считать калории', 
                    web_app: { url: GITHUB_WEB_APP_URL } 
                }
            ]]
        }
    });
});

// === API ДЛЯ АНАЛИЗА ФОТО (GROQ Llama 3.2 Vision) ===
app.post('/api/analyze', upload.single('photo'), async (req, res) => {
    try {
        const { dishName, weight, sauces, extraInfo } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Файл не получен' });
        }

        const base64Image = req.file.buffer.toString('base64');

        const promptText = `
Ты - профессиональный ИИ-нутрициолог. Проанализируй это фото еды.
Отвечай всегда по-разному, используя живой язык, чтобы общение не было скучным.

Вводные данные:
- Название блюда: ${dishName || 'Не указано'}
- Вес: ${weight || 'Неизвестно'}
- Соусы: ${sauces || 'Нет'}
- Дополнительно: ${extraInfo || 'Информации нет'}

Твой ответ должен содержать:
1. КБЖУ (Ккал, Белки, Жиры, Углеводы) — дай самую точную оценку на основе фото и веса.
2. Подробный состав блюда (что ты видишь).
3. Маленький совет или интересный факт об этой еде.
Пиши кратко, но информативно.
        `;

        const response = await groq.chat.completions.create({
            model: "llama-3.2-11b-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        { 
                            type: "image_url", 
                            image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
                        }
                    ]
                }
            ],
            temperature: 0.8,
            max_tokens: 800,
        });

        res.json({ 
            success: true, 
            result: response.choices[0].message.content 
        });

    } catch (error) {
        console.error("Ошибка Groq:", error);
        res.status(500).json({ 
            success: false, 
            error: 'Не удалось распознать еду. Попробуй другое фото.' 
        });
    }
});

// Роут для проверки (для пингера)
app.get('/', (req, res) => {
    res.send('Calorie Bot Server is Running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- СЕРВЕР ЗАПУЩЕН ---`);
    console.log(`Порт: ${PORT}`);
    console.log(`URL для пинга: ${SERVER_SELF_URL}`);
});
