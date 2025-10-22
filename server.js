const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Initialize SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        avgRating REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacherId INTEGER,
        rating INTEGER NOT NULL,
        reason TEXT NOT NULL,
        date TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(teacherId) REFERENCES teachers(id)
    )`);
}

// API Routes (same as before)
app.get('/api/teachers', (req, res) => {
    const query = `
        SELECT t.*, 
               COUNT(r.id) as reviewCount,
               GROUP_CONCAT(json_object('rating', r.rating, 'reason', r.reason, 'date', r.date)) as reviews
        FROM teachers t
        LEFT JOIN reviews r ON t.id = r.teacherId
        GROUP BY t.id
        ORDER BY t.avgRating DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const teachers = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            avgRating: parseFloat(row.avgRating),
            reviews: row.reviews ? JSON.parse(`[${row.reviews}]`) : [],
            reviewCount: row.reviewCount
        }));

        res.json(teachers);
    });
});

// Add other routes here...

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
