import puppeteer from 'puppeteer-core';
import chromium from 'chromium';

export async function scrapeCricketMatches() {
  const executablePath = chromium.path;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
    executablePath,
    timeout: 60000
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  try {
    await page.goto('https://www.cricbuzz.com/cricket-match/live-scores', { 
      waitUntil: 'networkidle2', 
      timeout: 60000
    });

    // Wait for the page to load completely
    await page.waitForSelector('a[href^="/live-cricket-scores/"]', { timeout: 15000 });

    const matches = await page.evaluate(() => {
      // Get all elements that might contain match data
      const allMatchElements = Array.from(document.querySelectorAll('a[href^="/live-cricket-scores/"]'));
      
      const validMatches = [];

      allMatchElements.forEach(matchEl => {
        try {
          const title = matchEl.getAttribute('title') || matchEl.textContent || '';
          
          // Skip invalid entries
          if (!title || 
              title === 'Live Score' || 
              title.length < 10 || 
              title.includes('Scorecard') ||
              title.includes('Full Commentary') ||
              title.includes('News')) {
            return;
          }

          // Extract match info
          const matchInfoElement = matchEl.querySelector('.flex.justify-between.items-center span.text-xs');
          const matchInfo = matchInfoElement?.textContent?.trim() || '';
          
          // Extract teams - look for team containers specifically
          const teamContainers = Array.from(matchEl.querySelectorAll('.flex.items-center.gap-2'));
          const teams = [];
          
          teamContainers.forEach(container => {
            // Get team name from the span after the flag
            const teamNameSpan = container.querySelector('span:last-child');
            const teamName = teamNameSpan?.textContent?.trim();
            
            if (teamName && teamName.length > 0) {
              // Find the score in the next sibling element
              let score = 'N/A';
              const parentRow = container.closest('.flex.items-center.gap-4');
              if (parentRow) {
                const scoreElement = parentRow.querySelector('.font-medium, .wb\\:font-semibold, [class*="w-1/2"]');
                const scoreText = scoreElement?.textContent?.trim();
                if (scoreText && scoreText.length > 0 && scoreText.length < 30) {
                  score = scoreText;
                }
              }
              
              teams.push({
                name: teamName,
                score: score
              });
            }
          });

          // Extract status from the last span
          const statusElement = matchEl.querySelector('span:last-child');
          let status = statusElement?.textContent?.trim() || '';
          const statusText = status.toLowerCase();
          
          // Clean and categorize status
          if (statusText.includes('match starts at')) {
            status = 'Upcoming';
          } else if (statusText.includes('won by')) {
            status = 'Completed';
          } else if (statusText.includes('won')) {
            status = 'Completed';
          } else if (statusText.includes('opt')) {
            status = 'Toss';
          } else if (statusText.includes('preview')) {
            status = 'Preview';
          } else if (statusText.includes('delay')) {
            status = 'Delayed';
          } else if (statusText.includes('live')) {
            status = 'Live';
          } else if (statusText.includes('complete')) {
            status = 'Completed';
          }

          // Extract venue
          let venue = '';
          if (matchInfo.includes('•')) {
            const parts = matchInfo.split('•');
            if (parts.length > 1) {
              venue = parts.slice(1).join(' ').trim();
            }
          }

          // Extract match number
          let matchNumber = '';
          if (matchInfo.includes('Match') || matchInfo.includes('T20I') || matchInfo.includes('ODI') || matchInfo.includes('Test')) {
            matchNumber = matchInfo.split('•')[0]?.trim() || '';
          }

          // Only include matches that have at least one team
          if (teams.length >= 1) {
            validMatches.push({
              title: title.replace(/ - [^-]*$/, '').trim(), // Remove trailing status from title
              matchNumber: matchNumber,
              date: '', // Will need separate extraction for date/time
              time: '',
              venue: venue,
              teams: teams,
              status: status
            });
          }
        } catch (error) {
          console.error('Error processing match element:', error);
        }
      });

      // Remove duplicates based on title
      const uniqueMatches = [];
      const seenTitles = new Set();
      
      validMatches.forEach(match => {
        const simpleTitle = match.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (!seenTitles.has(simpleTitle)) {
          seenTitles.add(simpleTitle);
          uniqueMatches.push(match);
        }
      });

      return uniqueMatches;
    });

    return matches;
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}