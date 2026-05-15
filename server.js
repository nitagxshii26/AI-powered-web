import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/generate.js';
import dotenv from 'dotenv';

// Load environment variables from .env.local or .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse JSON bodies (as Vercel would)
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Route the API path to the serverless function handler
app.post('/api/generate', (req, res) => {
    handler(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Local development server running!`);
    console.log(`👉 Open http://localhost:${PORT} in your browser`);
    console.log(`======================================================\n`);
});
