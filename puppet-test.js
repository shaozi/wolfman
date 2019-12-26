const puppeteer = require('puppeteer');
var Promise = require('bluebird')

let lanuchUser = async (username) => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 600, height: 800 },
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3200');

  await page.waitFor('#username');
  await page.focus('#username')
  await page.keyboard.type(username)
  await page.$eval('#next', el => el.click())

  await page.waitFor('#gamename');

  await page.focus('#gamename')
  await page.keyboard.type('g')

  if (username === 'user 1') {
    await page.$eval('#create', el => el.click())
    await Promise.delay(20000)
    await page.$eval('#start', el => el.click())
    await page.bringToFront()
  } else {
    await Promise.delay(5000)
    await page.$eval('#join', el => el.click())
    await Promise.delay(15000)
    await page.waitFor('#myrole')
    await page.$eval('#myrole', ele=>ele.click())
    await page.waitFor('#roleready')
    await page.$eval('#roleready', ele=>ele.click())
  }


  //await browser.close();
}

(async () => {
  var users = [
    'user 1',
    'user 2',
    'user 3',
    'user 4',
    // 'user 5',
    // 'user 6',
    // 'user 7',
    // 'user 8'
  ]
  users.forEach(async username => {
    await lanuchUser(username)
  });
})()
