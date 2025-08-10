import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8081;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the runs directory
app.use(express.static(path.join(__dirname, '../runs')));

// API endpoint to list all runs
app.get('/api/runs', async (req, res) => {
  try {
    const runsDir = path.join(__dirname, '../runs');
    const files = await fs.readdir(runsDir, { withFileTypes: true });
    const runs = files
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        id: dirent.name,
        created_at: new Date().toISOString(),
        // Add more metadata as needed
      }));
    res.json(runs);
  } catch (error) {
    console.error('Error listing runs:', error);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Run data server running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${path.join(__dirname, '../runs')}`);
});
