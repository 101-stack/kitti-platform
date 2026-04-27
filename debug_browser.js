const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    page.on('requestfailed', request => console.log('BROWSER REQUEST FAILED:', request.url(), request.failure()?.errorText));

    // Go to root first to set localStorage
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
    
    await page.evaluate(() => {
      localStorage.setItem('kitti-auth', JSON.stringify({
        state: {
          token: "fake-token",
          user: { id: "1", username: "test", coins: 1000, totalWins: 0, totalGames: 0 },
          isAuthenticated: true
        },
        version: 0
      }));
    });

    console.log('Navigating to lobby...');
    await page.goto('http://localhost:3001/lobby', { waitUntil: 'networkidle0' });
    
    console.log('Navigation complete. Capturing screenshot to see if it is white...');
    await page.screenshot({ path: 'test_lobby.png' });
    
    await browser.close();
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  }
})();
