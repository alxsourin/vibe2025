const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

// Настройки подключения к базе данных
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '0000',
    database: 'todolist',
};

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

// Обработчик запросов
async function handleRequest(req, res) {
    if (req.url === '/' && req.method === 'GET') {
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
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(processedHtml);
        } catch (err) {
            console.error('Failed to load index.html:', err.message);
            console.error(err.stack);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error loading index.html: ${err.message}`);
        }
    } else if (req.url === '/' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                console.log('Handling POST request with body:', body);
                const data = JSON.parse(body);
                await addItem(data.text);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('Error adding item:', err.message);
                console.error(err.stack);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Error adding item: ${err.message}`);
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
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('Error updating item:', err.message);
                console.error(err.stack);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Error updating item: ${err.message}`);
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
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('Error deleting item:', err.message);
                console.error(err.stack);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Error deleting item: ${err.message}`);
            }
        });
    } else {
        console.log(`Route not found: ${req.url} ${req.method}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

// Создание и запуск сервера
const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));