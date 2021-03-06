const puppeteer = require('puppeteer');
var Promise = require('bluebird')
var userCount = 12

let lanuchUser = async (username, gamename) => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 600, height: 600 },
    args: [`--window-size=600,800`]
  });
  const page = await browser.newPage();
  page.setMaxListeners(100)
  await page.goto('http://localhost:3200');

  await page.waitFor('#username');
  await page.type('#username', username)
  await page.$eval('#next', el => el.click())

  await page.waitFor('#gamename');

  //await page.focus('#gamename')
  await page.type('#gamename', gamename)

  if (username === 'u0') {
    await page.$eval('#create', el => el.click())
    for (let i = 0; i < 20; i++) {
      let playerCount = (await page.$$('.playername')).length
      if (playerCount == userCount) {
        break
      }
      console.log(playerCount)
      await Promise.delay(1000)
    }
    await page.$eval('#start', el => el.click())
    await page.bringToFront()
  } else {
    await Promise.delay(2000)
    await page.$eval('#join', el => el.click())

  }
  await Promise.delay(2000)
  await page.waitFor('#myrole')
  await page.$eval('#myrole', ele => ele.click())
  await page.waitFor('#roleready')
  await page.$eval('#roleready', ele => ele.click())


  //await browser.close();
}

(async () => {
  var users = []
  for (let i = 0; i < userCount; i++) {
    users.push(`u${i}`)
  }
  var gamename = `g${Math.floor(Math.random() * 1000)}`
  users.forEach(async username => {
    await lanuchUser(username, gamename)
  });
})()
