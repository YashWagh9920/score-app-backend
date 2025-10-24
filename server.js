import express from 'express';
import { scrapeCricketMatches } from './scraperone.js';
import { scrapeFootballMatches } from './scrapertwo.js';
import { scrapeKabaddiMatches } from "./scrapethree.js";
import dotenv from 'dotenv';
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

app.get('/cricket', async (req, res) => {
  try {
    const matches = await scrapeCricketMatches();
    res.json(matches);
  } catch (error) {
    console.error('Error fetching cricket matches:', error);
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

app.get('/kabaddi', async (req, res) => {
  try {
    const matches = await scrapeKabaddiMatches();
    
    if (matches.success) {
      res.json({
        success: true,
        message: matches.message,
        data: matches.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: matches.error,
        data: matches.data
      });
    }
  } catch (error) {
    console.error('Error fetching kabaddi matches:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch kabaddi matches.' 
    });
  }
});


app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
