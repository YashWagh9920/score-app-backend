import puppeteer from 'puppeteer-core';
import chromium from 'chromium';

export async function scrapeKabaddiMatches() {
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
    
    try {
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto('https://www.prokabaddi.com/schedule-fixtures-results', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForSelector('.fixtures-listing', { timeout: 15000 });

        const matchesData = await page.evaluate(() => {
            const data = {
                live: [],
                recent: [],
                scrapedAt: new Date().toISOString()
            };

            function extractMatchInfo(fixtureElement) {
                try {
                    const matchNumber = fixtureElement.querySelector('.element1 .match-count')?.textContent?.trim() || 'N/A';
                    
                    const teamAElement = fixtureElement.querySelector('.team.team-a');
                    const teamAName = teamAElement?.querySelector('.team-name')?.textContent?.trim() || 'N/A';
                    const teamAScore = teamAElement?.querySelector('.team-score .score')?.textContent?.trim() || 'N/A';
                    const teamAWon = teamAElement?.querySelector('.team-score.won') !== null;
                    
                    const teamBElement = fixtureElement.querySelector('.team.team-b');
                    const teamBName = teamBElement?.querySelector('.team-name')?.textContent?.trim() || 'N/A';
                    const teamBScore = teamBElement?.querySelector('.team-score .score')?.textContent?.trim() || 'N/A';
                    const teamBWon = teamBElement?.querySelector('.team-score.won') !== null;
                    
                    const matchStatus = fixtureElement.querySelector('.match-status')?.textContent?.trim() || 'N/A';
                    const venue = fixtureElement.querySelector('.element3 .match-place')?.textContent?.trim() || 'N/A';
                    
                    const matchLink = fixtureElement.querySelector('.element2 a')?.getAttribute('href') || 'N/A';
                    const fullMatchLink = matchLink !== 'N/A' ? `https://www.prokabaddi.com${matchLink}` : 'N/A';

                    return {
                        matchNumber,
                        teamA: {
                            name: teamAName,
                            score: teamAScore,
                            won: teamAWon
                        },
                        teamB: {
                            name: teamBName,
                            score: teamBScore,
                            won: teamBWon
                        },
                        status: matchStatus,
                        venue: venue,
                        matchLink: fullMatchLink
                    };
                } catch (error) {
                    return null;
                }
            }

            const fixturesListings = document.querySelectorAll('.fixtures-listing');
            
            if (fixturesListings.length >= 2) {
                const liveSection = fixturesListings[0];
                const liveMatches = liveSection.querySelectorAll('.fixtures-group');
                
                liveMatches.forEach(match => {
                    const matchInfo = extractMatchInfo(match);
                    if (matchInfo) {
                        data.live.push(matchInfo);
                    }
                });

                const recentSection = fixturesListings[1];
                const recentMatches = recentSection.querySelectorAll('.fixtures-group');
                
                recentMatches.forEach(match => {
                    const matchInfo = extractMatchInfo(match);
                    if (matchInfo) {
                        data.recent.push(matchInfo);
                    }
                });
            } else if (fixturesListings.length === 1) {
                const section = fixturesListings[0];
                const matches = section.querySelectorAll('.fixtures-group');
                
                let hasLiveMatches = false;
                matches.forEach(match => {
                    const status = match.querySelector('.match-status')?.textContent?.trim();
                    if (status && (status === 'LIVE' || status.includes('Live'))) {
                        hasLiveMatches = true;
                    }
                });

                matches.forEach(match => {
                    const matchInfo = extractMatchInfo(match);
                    if (matchInfo) {
                        if (hasLiveMatches && (matchInfo.status === 'LIVE' || matchInfo.status.includes('Live'))) {
                            data.live.push(matchInfo);
                        } else {
                            data.recent.push(matchInfo);
                        }
                    }
                });
            }

            return data;
        });

        return {
            success: true,
            data: matchesData,
            message: `Found ${matchesData.live.length} live matches and ${matchesData.recent.length} recent matches`
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: { live: [], recent: [] }
        };
    } finally {
        await browser.close();
    }
}