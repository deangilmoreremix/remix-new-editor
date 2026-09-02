const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'video-personalization-demo.html' : req.url);

    // Security check to prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Access denied');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Internal server error');
            }
            return;
        }

        // Set content type based on file extension
        const ext = path.extname(filePath);
        let contentType = 'text/plain';

        switch (ext) {
            case '.html':
                contentType = 'text/html';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.json':
                contentType = 'application/json';
                break;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
🎬 VIDEO PERSONALIZATION DEMO SERVER RUNNING
===========================================

✅ Server started successfully on http://localhost:${PORT}

🚀 Demo Features:
   • Interactive video upload simulation
   • CSV contact import with demo data
   • Token management display
   • Bulk video generation with progress
   • Download and sharing simulation

📋 How to test:
   1. Open http://localhost:${PORT} in your browser
   2. Follow the 4-step workflow
   3. Try uploading files or use demo data
   4. Watch the video generation process

🎯 This demonstrates the complete Sendspark-like workflow!

Press Ctrl+C to stop the server.
    `);
});