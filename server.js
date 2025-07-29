const Telegraf = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Инициализация бота
const bot = new Telegraf('8323784135:AAHm9HFtlRmxXUNkySfGYj9StIFIyA1yg3M');

// Хост для вашего сервера
const express = require('express');
const app = express();
const port = 3000;

// Папка для хранения изображений
const imagesDir = './images';
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

// Массив для хранения последних новостей
let latestNews = [];

// Функция для скачивания изображения
async function downloadImage(url, filename) {
    const response = await axios.get(url, { responseType: 'stream' });
    const filePath = path.join(imagesDir, filename);
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filePath));
        response.data.on('error', reject);
        response.data.on('finish', () => resolve(filePath));
    });
}

// Функция для получения последних сообщений из канала
async function fetchLatestNewsFromChannel() {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${bot.token}/getUpdates`);
        const messages = response.data.result;
        
        // Фильтруем только последние несколько сообщений
        latestNews = messages.slice(-5).map(message => {
            const text = message.message.text || '';
            let photoUrl = null;
            let title = '';

            // Если в сообщении есть фото, получаем URL
            if (message.message.photo && message.message.photo.length > 0) {
                // Выбираем самое большое изображение
                const largestPhoto = message.message.photo.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
                photoUrl = largestPhoto.file_id;
            }

            // Разделяем заголовок и текст новости
            const lines = text.split('\n');
            if (lines.length > 0) {
                title = lines[0]; // Первый параграф как заголовок
                text = lines.slice(1).join('\n'); // Остальные строки как текст
            }

            return { title, text, photoUrl };
        });

        // Скачиваем изображения
        for (const newsItem of latestNews) {
            if (newsItem.photoUrl) {
                const fileResponse = await axios.get(`https://api.telegram.org/bot${bot.token}/getFile?file_id=${newsItem.photoUrl}`);
                const filePath = fileResponse.data.result.file_path;
                const imageUrl = `https://api.telegram.org/file/bot${bot.token}/${filePath}`;
                const filename = filePath.split('/').pop();

                // Скачиваем изображение на сервер
                newsItem.photoPath = await downloadImage(imageUrl, filename);
            }
        }
    } catch (error) {
        console.error('Ошибка при получении сообщений:', error);
    }
}

// API для получения новостей
app.get('/api/news', (req, res) => {
    res.json(latestNews);
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});