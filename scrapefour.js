import puppeteer from 'puppeteer';

export async function scrapeBadmintonMatches() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent to avoid blocking
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto('https://www.flashscore.in/badminton/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for the content to load
        await page.waitForSelector('.event__match', { timeout: 10000 });


        // Extract data from the page
        const matchesData = await page.evaluate(() => {
            const data = {
                live: [],
                upcoming: [],
                finished: [],
                scrapedAt: new Date().toISOString()
            };

            // Function to extract country from flag class
            function getCountryFromFlag(flagClass) {
                const flagMatch = flagClass.match(/fl_(\d+)/);
                if (flagMatch) {
                    // You could map flag codes to country names, but for now return the code
                    return flagMatch[1];
                }
                return '';
            }

            // Function to extract set scores
            function extractSetScores(matchElement) {
                const sets = [];
                const setElements = matchElement.querySelectorAll('.event__part');
                
                for (let i = 0; i < setElements.length; i += 2) {
                    const homeSet = setElements[i]?.textContent?.trim() || '';
                    const awaySet = setElements[i + 1]?.textContent?.trim() || '';
                    
                    if (homeSet || awaySet) {
                        sets.push({
                            set: Math.floor(i / 2) + 1,
                            home: homeSet,
                            away: awaySet,
                            isCurrent: setElements[i]?.classList.contains('highlighted') || 
                                     setElements[i + 1]?.classList.contains('highlighted')
                        });
                    }
                }
                return sets;
            }

            // Function to determine match type
            function getMatchType(matchElement) {
                if (matchElement.classList.contains('event__match--doubles')) {
                    return 'doubles';
                }
                return 'singles';
            }

            // Function to extract match information
            function extractMatchInfo(matchElement) {
                try {
                    // Get match status
                    const isLive = matchElement.classList.contains('event__match--live');
                    const isScheduled = matchElement.classList.contains('event__match--scheduled');
                    const isFinished = !isLive && !isScheduled;
                    
                    // Match ID
                    const matchId = matchElement.id.replace('g_21_', '') || 'N/A';
                    
                    // Match link
                    const matchLink = matchElement.querySelector('a.eventRowLink')?.href || 'N/A';
                    
                    // Time or stage
                    const timeElement = matchElement.querySelector('.event__time');
                    const stageElement = matchElement.querySelector('.event__stage--block');
                    const timeOrStage = timeElement?.textContent?.trim() || 
                                      stageElement?.textContent?.trim() || 
                                      (isLive ? 'Live' : 'N/A');

                    // Check if it's doubles
                    const isDoubles = getMatchType(matchElement) === 'doubles';
                    
                    let homePlayers = [];
                    let awayPlayers = [];
                    let homeCountry = '';
                    let awayCountry = '';

                    if (isDoubles) {
                        // Doubles match - extract multiple players
                        const homePlayer1 = matchElement.querySelector('.event__participant--home1')?.textContent?.trim() || '';
                        const homePlayer2 = matchElement.querySelector('.event__participant--home2')?.textContent?.trim() || '';
                        const awayPlayer1 = matchElement.querySelector('.event__participant--away1')?.textContent?.trim() || '';
                        const awayPlayer2 = matchElement.querySelector('.event__participant--away2')?.textContent?.trim() || '';
                        
                        if (homePlayer1) homePlayers.push(homePlayer1);
                        if (homePlayer2) homePlayers.push(homePlayer2);
                        if (awayPlayer1) awayPlayers.push(awayPlayer1);
                        if (awayPlayer2) awayPlayers.push(awayPlayer2);
                        
                        // Get flags for doubles (usually first player's flag represents the team)
                        const homeFlag1 = matchElement.querySelector('.event__logo--home1')?.className || '';
                        const awayFlag1 = matchElement.querySelector('.event__logo--away1')?.className || '';
                        homeCountry = getCountryFromFlag(homeFlag1);
                        awayCountry = getCountryFromFlag(awayFlag1);
                    } else {
                        // Singles match
                        const homePlayer = matchElement.querySelector('.event__participant--home')?.textContent?.trim() || '';
                        const awayPlayer = matchElement.querySelector('.event__participant--away')?.textContent?.trim() || '';
                        
                        if (homePlayer) homePlayers.push(homePlayer);
                        if (awayPlayer) awayPlayers.push(awayPlayer);
                        
                        // Get flags
                        const homeFlag = matchElement.querySelector('.event__logo--home')?.className || '';
                        const awayFlag = matchElement.querySelector('.event__logo--away')?.className || '';
                        homeCountry = getCountryFromFlag(homeFlag);
                        awayCountry = getCountryFromFlag(awayFlag);
                    }

                    // Scores
                    const homeScoreElement = matchElement.querySelector('.event__score--home');
                    const awayScoreElement = matchElement.querySelector('.event__score--away');
                    const homeScore = homeScoreElement?.textContent?.trim() || '0';
                    const awayScore = awayScoreElement?.textContent?.trim() || '0';

                    // Set scores
                    const setScores = extractSetScores(matchElement);

                    // Serve indicator
                    const serveHome = matchElement.querySelector('.icon--serveHome') !== null;
                    const serveAway = matchElement.querySelector('.icon--serveAway') !== null;

                    // Tournament info (from the nearest header)
                    const headerElement = matchElement.closest('.sportName')?.querySelector('.headerLeague__title-text');
                    const tournament = headerElement?.textContent?.trim() || 'Unknown Tournament';

                    // Category info
                    const categoryElement = matchElement.closest('.sportName')?.querySelector('.headerLeague__category-text');
                    const category = categoryElement?.textContent?.trim() || 'Unknown Category';

                    return {
                        matchId,
                        matchType: isDoubles ? 'doubles' : 'singles',
                        status: isLive ? 'live' : (isScheduled ? 'scheduled' : 'finished'),
                        timeOrStage,
                        tournament: {
                            name: tournament,
                            category: category
                        },
                        home: {
                            players: homePlayers,
                            country: homeCountry,
                            score: homeScore,
                            isServing: serveHome
                        },
                        away: {
                            players: awayPlayers,
                            country: awayCountry,
                            score: awayScore,
                            isServing: serveAway
                        },
                        setScores,
                        matchLink,
                        hasLiveBetting: matchElement.querySelector('.liveBetWrapper') !== null
                    };
                } catch (error) {
                    console.error('Error extracting match info:', error);
                    return null;
                }
            }

            // Get all match elements
            const matchElements = document.querySelectorAll('.event__match');
            
            matchElements.forEach(matchElement => {
                const matchInfo = extractMatchInfo(matchElement);
                if (matchInfo) {
                    if (matchInfo.status === 'live') {
                        data.live.push(matchInfo);
                    } else if (matchInfo.status === 'scheduled') {
                        data.upcoming.push(matchInfo);
                    } else {
                        data.finished.push(matchInfo);
                    }
                }
            });

            return data;
        });

        return {
            success: true,
            data: matchesData,
            message: `Found ${matchesData.live.length} live matches, ${matchesData.upcoming.length} upcoming matches, and ${matchesData.finished.length} finished matches`
        };

    } catch (error) {
        console.error('Error during Badminton scraping:', error);
        return {
            success: false,
            error: error.message,
            data: { live: [], upcoming: [], finished: [] }
        };
    } finally {
        await browser.close();
    }
}

