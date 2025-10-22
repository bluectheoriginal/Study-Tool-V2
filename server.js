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
const db = new sqlite3.Database('./teachers.db', (err) => {
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

// Test route
app.get('/api/test', (req, res) => {
    console.log('✅ Test route hit');
    res.json({ 
        message: 'API is working!', 
        timestamp: new Date() 
    });
});

// Get all teachers with their reviews
app.get('/api/teachers', (req, res) => {
    console.log('📝 Fetching teachers...');
    
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
            console.error('❌ Database error:', err);
            res.status(500).json({ error: err.message });
            return;
        }

        console.log(`✅ Found ${rows.length} teachers`);

        const teachers = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            avgRating: parseFloat(row.avgRating) || 0,
            reviews: row.reviews ? JSON.parse(`[${row.reviews}]`) : [],
            reviewCount: row.reviewCount
        }));

        res.json(teachers);
    });
});

// Add a new teacher
app.post('/api/teachers', (req, res) => {
    console.log('➕ Adding new teacher:', req.body.name);
    
    const { name, description, rating, reason } = req.body;

    // Check if teacher already exists
    db.get('SELECT * FROM teachers WHERE LOWER(name) = LOWER(?)', [name], (err, existingTeacher) => {
        if (err) {
            console.error('❌ Database error:', err);
            res.status(500).json({ error: err.message });
            return;
        }

        if (existingTeacher) {
            console.log('⚠️ Teacher already exists:', name);
            res.status(400).json({ error: 'Teacher already exists', teacherId: existingTeacher.id });
            return;
        }

        // Insert new teacher
        db.run('INSERT INTO teachers (name, description, avgRating) VALUES (?, ?, ?)', 
            [name, description, rating], function(err) {
            if (err) {
                console.error('❌ Database error:', err);
                res.status(500).json({ error: err.message });
                return;
            }

            const teacherId = this.lastID;
            console.log('✅ Teacher added with ID:', teacherId);

            // Add first review
            db.run('INSERT INTO reviews (teacherId, rating, reason, date) VALUES (?, ?, ?, ?)',
                [teacherId, rating, reason, new Date().toLocaleDateString()], (err) => {
                if (err) {
                    console.error('❌ Database error:', err);
                    res.status(500).json({ error: err.message });
                    return;
                }

                console.log('✅ Review added for teacher:', teacherId);
                
                res.json({ 
                    id: teacherId, 
                    name, 
                    description, 
                    avgRating: parseFloat(rating),
                    reviews: [{ rating: parseInt(rating), reason, date: new Date().toLocaleDateString() }]
                });
            });
        });
    });
});

// Add review to existing teacher
app.post('/api/teachers/:id/reviews', (req, res) => {
    const teacherId = req.params.id;
    const { rating, reason } = req.body;
    
    console.log('📝 Adding review for teacher:', teacherId);

    // Add review
    db.run('INSERT INTO reviews (teacherId, rating, reason, date) VALUES (?, ?, ?, ?)',
        [teacherId, rating, reason, new Date().toLocaleDateString()], function(err) {
        if (err) {
            console.error('❌ Database error:', err);
            res.status(500).json({ error: err.message });
            return;
        }

        console.log('✅ Review added, recalculating average...');

        // Recalculate average rating
        db.get('SELECT AVG(rating) as newAvg FROM reviews WHERE teacherId = ?', [teacherId], (err, result) => {
            if (err) {
                console.error('❌ Database error:', err);
                res.status(500).json({ error: err.message });
                return;
            }

            // Update teacher's average rating
            db.run('UPDATE teachers SET avgRating = ? WHERE id = ?', [result.newAvg, teacherId], (err) => {
                if (err) {
                    console.error('❌ Database error:', err);
                    res.status(500).json({ error: err.message });
                    return;
                }

                console.log('✅ Average rating updated:', result.newAvg);
                res.json({ success: true, newAvg: result.newAvg });
            });
        });
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server started successfully!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📌 API Routes:`);
    console.log(`   GET  /api/teachers`);
    console.log(`   POST /api/teachers`);
    console.log(`   POST /api/teachers/:id/reviews`);
    console.log(`   GET  /api/test`);
});
