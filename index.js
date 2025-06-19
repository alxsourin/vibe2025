const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const TelegramBot = require('node-telegram-bot-api');

// Настройки Telegram-бота
const TELEGRAM_TOKEN = '7613122686:AAHdpQowr1TJYLlGCoKxvniwzS-4nDexsNE'; // Замените на ваш токен
const TELEGRAM_CHAT_ID = '905639492'; // Замените на ваш chat_id
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Настройки подключения к базе данных
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '0000',
    database: 'todolist',
};

// Инициализация сессий
const app = {
    use: (middleware) => {
        app.middleware = middleware;
    },
    middleware: (req, res, next) => next()
};

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));

// Получение всех элементов списка
async function retrieveListItems() {
    try {
        console.log('Attempting to connect to database...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database successfully');
        const query = 'SELECT id, text FROM items';
        const [rows] = await connection.execute(query);
        console.log('Retrieved items:', rows);
        await connection.end();
        console.log('Database connection closed');
        return rows;
    } catch (error) {
        console.error('Error retrieving list items:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Добавление нового элемента
async function addItem(text) {
    try {
        console.log('Adding item:', text);
        const connection = await mysql.createConnection(dbConfig);
        const query = 'INSERT INTO items (text) VALUES (?)';
        await connection.execute(query, [text]);
        console.log('Item added successfully');
        await connection.end();
    } catch (error) {
        console.error('Error adding item:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Редактирование элемента
async function updateItem(id, text) {
    try {
        console.log(`Updating item with id: ${id}, text: ${text}`);
        const connection = await mysql.createConnection(dbConfig);
        const query = 'UPDATE items SET text = ? WHERE id = ?';
        await connection.execute(query, [text, id]);
        console.log('Item updated successfully');
        await connection.end();
    } catch (error) {
        console.error('Error updating item:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Удаление элемента
async function deleteItem(id) {
    try {
        console.log(`Deleting item with id: ${id}`);
        const connection = await mysql.createConnection(dbConfig);
        const query = 'DELETE FROM items WHERE id = ?';
        await connection.execute(query, [id]);
        console.log('Item deleted successfully');
        await connection.end();
    } catch (error) {
        console.error('Error deleting item:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Генерация HTML-строк для таблицы
async function getHtmlRows() {
    try {
        console.log('Generating HTML rows...');
        const todoItems = await retrieveListItems();
        const htmlRows = todoItems.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.text}</td>
                <td>
                    <button class="edit-btn" onclick="editItem(${item.id}, '${item.text.replace(/'/g, "\\'")}')">Edit</button>
                    <button class="delete-btn" onclick="deleteItem(${item.id})">×</button>
                </td>
            </tr>
        `).join('');
        console.log('HTML rows generated successfully');
        return htmlRows;
    } catch (error) {
        console.error('Error generating HTML rows:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Аутентификация пользователя
async function authenticateUser(username, password) {
    try {
        console.log('Authenticating user:', username);
        const connection = await mysql.createConnection(dbConfig);
        const query = 'SELECT * FROM users WHERE username = ?';
        const [rows] = await connection.execute(query, [username]);
        await connection.end();
        if (rows.length === 0) {
            console.log('User not found:', username);
            return false;
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        console.log('Password match:', match);
        return match;
    } catch (error) {
        console.error('Error authenticating user:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Отправка сообщения в Telegram
async function sendTelegramMessage(username) {
    try {
        const message = `Пользователь ${username} вошел в To-Do List в ${new Date().toLocaleString('ru-RU')}`;
        await bot.sendMessage(TELEGRAM_CHAT_ID, message);
        console.log(`Telegram message sent for user: ${username}`);
    } catch (error) {
        console.error('Error sending Telegram message:', error.message);
        console.error(error.stack);
    }
}

// Обработчик запросов
async function handleRequest(req, res) {
    app.middleware(req, res, async () => {
        if (req.url === '/' && req.method === 'GET') {
            if (req.session.user) {
                try {
                    console.log('Handling GET request for /');
                    console.log('Attempting to read index.html...');
                    const html = await fs.promises.readFile(
                        path.join(__dirname, 'index.html'),
                        'utf8'
                    );
                    console.log('index.html read successfully');
                    const processedHtml = html.replace('{{rows}}', await getHtmlRows());
                    console.log('HTML processed successfully');
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(processedHtml);
                } catch (err) {
                    console.error('Failed to load index.html:', err.message);
                    console.error(err.stack);
                    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <title>Ошибка</title>
                            </head>
                            <body>
                                <h2>Ошибка</h2>
                                <p>Ошибка загрузки страницы: ${err.message}</p>
                                <a href="/login">Вернуться к входу</a>
                            </body>
                        </html>
                    `);
                }
            } else {
                res.writeHead(302, { 'Content-Type': 'text/html; charset=utf-8', 'Location': '/login' });
                res.end();
            }
        } else if (req.url === '/login' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Вход</title>
                    </head>
                    <body>
                        <h2>Вход</h2>
                        <form action="/login" method="post">
                            <label for="username">Логин:</label>
                            <input type="text" id="username" name="username"><br>
                            <label for="password">Пароль:</label>
                            <input type="password" id="password" name="password"><br>
                            <input type="submit" value="Войти">
                        </form>
                    </body>
                </html>
            `);
        } else if (req.url === '/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    console.log('Handling POST request for /login with body:', body);
                    const data = new URLSearchParams(body);
                    const username = data.get('username');
                    const password = data.get('password');
                    const authenticated = await authenticateUser(username, password);
                    if (authenticated) {
                        req.session.user = username;
                        await sendTelegramMessage(username); // Отправка сообщения в Telegram
                        res.writeHead(302, { 'Content-Type': 'text/html; charset=utf-8', 'Location': '/' });
                        res.end();
                    } else {
                        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(`
                            <html>
                                <head>
                                    <meta charset="UTF-8">
                                    <title>Ошибка входа</title>
                                </head>
                                <body>
                                    <h2>Ошибка</h2>
                                    <p>Неверный логин или пароль</p>
                                    <a href="/login">Попробовать снова</a>
                                </body>
                            </html>
                        `);
                    }
                } catch (err) {
                    console.error('Error authenticating user:', err.message);
                    console.error(err.stack);
                    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <title>Ошибка</title>
                            </head>
                            <body>
                                <h2>Ошибка</h2>
                                <p>Ошибка аутентификации: ${err.message}</p>
                                <a href="/login">Попробовать снова</a>
                            </body>
                        </html>
                    `);
                }
            });
        } else if (req.url === '/' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    console.log('Handling POST request with body:', body);
                    const data = JSON.parse(body);
                    await addItem(data.text);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    console.error('Error adding item:', err.message);
                    console.error(err.stack);
                    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <title>Ошибка</title>
                            </head>
                            <body>
                                <h2>Ошибка</h2>
                                <p>Ошибка добавления задачи: ${err.message}</p>
                                <a href="/">Вернуться</a>
                            </body>
                        </html>
                    `);
                }
            });
        } else if (req.url === '/' && req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    console.log('Handling PUT request with body:', body);
                    const data = JSON.parse(body);
                    await updateItem(data.id, data.text);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    console.error('Error updating item:', err.message);
                    console.error(err.stack);
                    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <title>Ошибка</title>
                            </head>
                            <body>
                                <h2>Ошибка</h2>
                                <p>Ошибка обновления задачи: ${err.message}</p>
                                <a href="/">Вернуться</a>
                            </body>
                        </html>
                    `);
                }
            });
        } else if (req.url === '/' && req.method === 'DELETE') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    console.log('Handling DELETE request with body:', body);
                    const data = JSON.parse(body);
                    await deleteItem(data.id);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    console.error('Error deleting item:', err.message);
                    console.error(err.stack);
                    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <title>Ошибка</title>
                            </head>
                            <body>
                                <h2>Ошибка</h2>
                                <p>Ошибка удаления задачи: ${err.message}</p>
                                <a href="/">Вернуться</a>
                            </body>
                        </html>
                    `);
                }
            });
        } else {
            console.log(`Route not found: ${req.url} ${req.method}`);
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>404 - Не найдено</title>
                    </head>
                    <body>
                        <h2>404 - Страница не найдена</h2>
                        <p>Маршрут не найден</p>
                        <a href="/login">Вернуться к входу</a>
                    </body>
                </html>
            `);
        }
    });
}

// Создание и запуск сервера
const server = http.createServer(handleRequest);
server.listen(3000, () => console.log(`Server running on port 3000`));