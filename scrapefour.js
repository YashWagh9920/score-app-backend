import puppeteer from 'puppeteer-core';
import chromium from 'chromium';

export async function scrapeBadmintonMatches() {
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
        
        await page.goto('https://www.flashscore.in/badminton/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForSelector('.event__match', { timeout: 15000 });

        const matchesData = await page.evaluate(() => {
            const data = {
                live: [],
                upcoming: [],
                finished: [],
                scrapedAt: new Date().toISOString()
            };

            function getCountryFromFlag(flagClass) {
                const flagMatch = flagClass.match(/fl_(\d+)/);
                if (flagMatch) {
                    return flagMatch[1];
                }
                return '';
            }

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

            function getMatchType(matchElement) {
                if (matchElement.classList.contains('event__match--doubles')) {
                    return 'doubles';
                }
                return 'singles';
            }

            function extractMatchInfo(matchElement) {
                try {
                    const isLive = matchElement.classList.contains('event__match--live');
                    const isScheduled = matchElement.classList.contains('event__match--scheduled');
                    const isFinished = !isLive && !isScheduled;
                    
                    const matchId = matchElement.id.replace('g_21_', '') || 'N/A';
                    
                    const matchLink = matchElement.querySelector('a.eventRowLink')?.href || 'N/A';
                    
                    const timeElement = matchElement.querySelector('.event__time');
                    const stageElement = matchElement.querySelector('.event__stage--block');
                    const timeOrStage = timeElement?.textContent?.trim() || 
                                      stageElement?.textContent?.trim() || 
                                      (isLive ? 'Live' : 'N/A');

                    const isDoubles = getMatchType(matchElement) === 'doubles';
                    
                    let homePlayers = [];
                    let awayPlayers = [];
                    let homeCountry = '';
                    let awayCountry = '';

                    if (isDoubles) {
                        const homePlayer1 = matchElement.querySelector('.event__participant--home1')?.textContent?.trim() || '';
                        const homePlayer2 = matchElement.querySelector('.event__participant--home2')?.textContent?.trim() || '';
                        const awayPlayer1 = matchElement.querySelector('.event__participant--away1')?.textContent?.trim() || '';
                        const awayPlayer2 = matchElement.querySelector('.event__participant--away2')?.textContent?.trim() || '';
                        
                        if (homePlayer1) homePlayers.push(homePlayer1);
                        if (homePlayer2) homePlayers.push(homePlayer2);
                        if (awayPlayer1) awayPlayers.push(awayPlayer1);
                        if (awayPlayer2) awayPlayers.push(awayPlayer2);
                        
                        const homeFlag1 = matchElement.querySelector('.event__logo--home1')?.className || '';
                        const awayFlag1 = matchElement.querySelector('.event__logo--away1')?.className || '';
                        homeCountry = getCountryFromFlag(homeFlag1);
                        awayCountry = getCountryFromFlag(awayFlag1);
                    } else {
                        const homePlayer = matchElement.querySelector('.event__participant--home')?.textContent?.trim() || '';
                        const awayPlayer = matchElement.querySelector('.event__participant--away')?.textContent?.trim() || '';
                        
                        if (homePlayer) homePlayers.push(homePlayer);
                        if (awayPlayer) awayPlayers.push(awayPlayer);
                        
                        const homeFlag = matchElement.querySelector('.event__logo--home')?.className || '';
                        const awayFlag = matchElement.querySelector('.event__logo--away')?.className || '';
                        homeCountry = getCountryFromFlag(homeFlag);
                        awayCountry = getCountryFromFlag(awayFlag);
                    }

                    const homeScoreElement = matchElement.querySelector('.event__score--home');
                    const awayScoreElement = matchElement.querySelector('.event__score--away');
                    const homeScore = homeScoreElement?.textContent?.trim() || '0';
                    const awayScore = awayScoreElement?.textContent?.trim() || '0';

                    const setScores = extractSetScores(matchElement);

                    const serveHome = matchElement.querySelector('.icon--serveHome') !== null;
                    const serveAway = matchElement.querySelector('.icon--serveAway') !== null;

                    const headerElement = matchElement.closest('.sportName')?.querySelector('.headerLeague__title-text');
                    const tournament = headerElement?.textContent?.trim() || 'Unknown Tournament';

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
                    return null;
                }
            }

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
        return {
            success: false,
            error: error.message,
            data: { live: [], upcoming: [], finished: [] }
        };
    } finally {
        await browser.close();
    }
}