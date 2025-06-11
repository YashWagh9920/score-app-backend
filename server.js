import express from 'express';
import { scrapeCricketMatches } from './scraperone.js';
import { scrapeFootballMatches } from './scrapertwo.js';
import dotenv from 'dotenv';
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

app.get('/cricket', async (req, res) => {
  try {
    const matches = await scrapeCricketMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cricket matches.' });
  }
});

app.get('/football', async (req, res) => {
  try {
    const matches = await scrapeFootballMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch football matches.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
