import puppeteer from 'puppeteer';

export async function scrapeFootballMatches() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath();
  console.log('Using browser executable:', executablePath);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--single-process"
    ],
    executablePath,
    timeout: 30000
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  try {
    await page.goto('https://www.fotmob.com/?show=ongoing', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const hasMatchSelector = await page.$('.css-1ajdexg-MatchWrapper');

    if (!hasMatchSelector) {
      console.log('No ongoing football matches found.');
      return [];
    }

    const matchCards = await page.$$('.css-1ajdexg-MatchWrapper');
    if (matchCards.length === 0) {
      return [];
    }
    const matches = await page.evaluate(() => {
      const matchCards = Array.from(document.querySelectorAll('.css-1ajdexg-MatchWrapper'));

      return matchCards.map(card => {
        try {
          return {
            homeTeam: card.querySelector('.css-9871a0-StatusAndHomeTeamWrapper .css-1o142s8-TeamName')?.textContent.trim(),
            awayTeam: card.querySelector('.css-gn249o-AwayTeamAndFollowWrapper .css-1o142s8-TeamName')?.textContent.trim(),
            score: card.querySelector('.css-baclne-LSMatchStatusScore')?.textContent.trim(),
            minute: card.querySelector('.css-1s1h719-LSMatchStatusLive')?.textContent.trim(),
            matchUrl: card.getAttribute('href') ? `https://www.fotmob.com${card.getAttribute('href')}` : null,
            hasLiveCommentary: !!card.querySelector('.css-sp7qfq-TVIconWrapper svg.audio-icon'),
          };
        } catch (e) {
          console.error('Error parsing match card:', e);
          return null;
        }
      }).filter(match => match !== null);
    });

    return matches;

  } catch (error) {
    console.error('Football scraping failed:', error);
    return [];
  } finally {
    await browser.close();
  }
}
