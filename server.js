const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Test route - FIRST, before any other routes
app.get('/api/test', (req, res) => {
    console.log('✅ /api/test route called');
    res.json({ 
        status: 'success', 
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

// Serve HTML for root route
app.get('/', (req, res) => {
    console.log('📄 Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server started on port:', PORT);
    console.log('✅ Static files serving from:', __dirname);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
