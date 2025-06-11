import puppeteer from 'puppeteer';

export async function scrapeCricketMatches() {
  
   const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  try {
    await page.goto('https://www.cricbuzz.com/cricket-match/live-scores', { waitUntil: 'networkidle2' });

    await page.waitForSelector('.cb-mtch-lst.cb-col.cb-col-100.cb-tms-itm', { timeout: 15000 });

    const matches = await page.evaluate(() => {
      const matchElements = Array.from(document.querySelectorAll('.cb-mtch-lst.cb-col.cb-col-100.cb-tms-itm'));

      return matchElements.map(matchEl => {
        const timestampElement = matchEl.querySelector('[ng-bind*="1745676000000"]');
        const rawTimestamp = timestampElement?.getAttribute('ng-bind')?.match(/\d+/)?.[0] || '';

        return {
          title: matchEl.querySelector('.cb-lv-scr-mtch-hdr a')?.textContent.replace(/,/g, '').trim(),
          matchNumber: matchEl.querySelector('.text-gray')?.textContent.replace('&nbsp;', ' ').trim(),
          date: rawTimestamp ? new Date(parseInt(rawTimestamp)).toLocaleDateString('en-GB') : '',
          time: rawTimestamp ? new Date(parseInt(rawTimestamp)).toLocaleTimeString('en-US', 
            { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
          venue: matchEl.querySelector('.text-gray:last-child')?.textContent
            .replace(/at|Today|•|-/g, '')
            .trim(),
          teams: Array.from(matchEl.querySelectorAll('.cb-hmscg-tm-nm')).map(team => ({
            name: team.textContent.trim(),
            score: team.nextElementSibling?.textContent.trim() || 'N/A'
          })),
          status: matchEl.querySelector('.cb-text-complete, .cb-text-inprogress')?.textContent.trim() || 'Live'
        };
      });
    });

    return matches;
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
