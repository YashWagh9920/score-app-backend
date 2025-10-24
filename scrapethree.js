import puppeteer from 'puppeteer';

export async function scrapeKabaddiMatches() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent to avoid blocking
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto('https://www.prokabaddi.com/schedule-fixtures-results', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for the content to load
        await page.waitForSelector('.fixtures-listing', { timeout: 10000 });


        // Extract data from Live and Recent sections
        const matchesData = await page.evaluate(() => {
            const data = {
                live: [],
                recent: [],
                scrapedAt: new Date().toISOString()
            };

            // Function to extract match information from a fixture element
            function extractMatchInfo(fixtureElement) {
                try {
                    const matchNumber = fixtureElement.querySelector('.element1 .match-count')?.textContent?.trim() || 'N/A';
                    
                    // Team A information
                    const teamAElement = fixtureElement.querySelector('.team.team-a');
                    const teamAName = teamAElement?.querySelector('.team-name')?.textContent?.trim() || 'N/A';
                    const teamAScore = teamAElement?.querySelector('.team-score .score')?.textContent?.trim() || 'N/A';
                    const teamAWon = teamAElement?.querySelector('.team-score.won') !== null;
                    
                    // Team B information
                    const teamBElement = fixtureElement.querySelector('.team.team-b');
                    const teamBName = teamBElement?.querySelector('.team-name')?.textContent?.trim() || 'N/A';
                    const teamBScore = teamBElement?.querySelector('.team-score .score')?.textContent?.trim() || 'N/A';
                    const teamBWon = teamBElement?.querySelector('.team-score.won') !== null;
                    
                    // Match status and venue
                    const matchStatus = fixtureElement.querySelector('.match-status')?.textContent?.trim() || 'N/A';
                    const venue = fixtureElement.querySelector('.element3 .match-place')?.textContent?.trim() || 'N/A';
                    
                    // Match link
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
                    console.error('Error extracting match info:', error);
                    return null;
                }
            }

            // Find all fixtures listings (both Live and Recent sections)
            const fixturesListings = document.querySelectorAll('.fixtures-listing');
            
            if (fixturesListings.length >= 2) {
                // First section is typically Live/Upcoming
                const liveSection = fixturesListings[0];
                const liveTitle = liveSection.querySelector('.fixtures-title')?.textContent?.trim() || 'Live Matches';
                const liveMatches = liveSection.querySelectorAll('.fixtures-group');
                
                liveMatches.forEach(match => {
                    const matchInfo = extractMatchInfo(match);
                    if (matchInfo) {
                        data.live.push(matchInfo);
                    }
                });

                // Second section is typically Recent matches
                const recentSection = fixturesListings[1];
                const recentTitle = recentSection.querySelector('.fixtures-title')?.textContent?.trim() || 'Recent Matches';
                const recentMatches = recentSection.querySelectorAll('.fixtures-group');
                
                recentMatches.forEach(match => {
                    const matchInfo = extractMatchInfo(match);
                    if (matchInfo) {
                        data.recent.push(matchInfo);
                    }
                });
            } else if (fixturesListings.length === 1) {
                // If only one section exists, check if it's Live or Recent based on content
                const section = fixturesListings[0];
                const matches = section.querySelectorAll('.fixtures-group');
                
                // Try to determine section type by looking at match status
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
        console.error('Error during Kabaddi scraping:', error);
        return {
            success: false,
            error: error.message,
            data: { live: [], recent: [] }
        };
    } finally {
        await browser.close();
    }
}
