const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');


/**
 * @name Amazon search
 *
 * @desc Looks for a "nyan cat pullover" on amazon.com, goes two page two clicks the third one.
 https://github.com/checkly/puppeteer-examples/blob/master/2.%20search/amazon.js
 */
// const screenshot = 'amazon_nyan_cat_pullover.png'
// try {
//   (async () => {
//     const browser = await puppeteer.launch()
//     const page = await browser.newPage()
//     await page.setViewport({ width: 1280, height: 800 })
//     await page.goto('https://www.amazon.com')
//     await page.type('#twotabsearchtextbox', 'nyan cat pullover')
//     await page.click('input.nav-input')
//     await page.waitForSelector('#resultsCol')
//     await page.screenshot({ path: 'amazon_nyan_cat_pullovers_list.png' })
//     await page.click('#pagnNextString')
//     await page.waitForSelector('#resultsCol')
//     const pullovers = await page.$$('a.a-link-normal.a-text-normal')
//     await pullovers[2].click()
//     await page.waitForSelector('#ppd')
//     await page.screenshot({ path: screenshot })
//     await browser.close()
//     console.log('See screenshot: ' + screenshot)
//   })()
// } catch (err) {
//   console.error(err)
// }


// const screenshot = 'youtube_fm_dreams_video.png'
// try {
//   (async () => {
//     const browser = await puppeteer.launch()
//     const page = await browser.newPage()
//     await page.goto('https://youtube.com')
//     await page.type('#search', 'Fleetwood Mac Dreams')
//     await page.click('button#search-icon-legacy')
//     await page.waitForSelector('ytd-thumbnail.ytd-video-renderer')
//     await page.screenshot({ path: 'youtube_fm_dreams_list.png' })
//     const videos = await page.$$('ytd-thumbnail.ytd-video-renderer')
//     await videos[2].click()
//     await page.waitForSelector('.html5-video-container')
//     await page.waitFor(5000)
//     await page.screenshot({ path: screenshot })
//     await browser.close()
//     console.log('See screenshot: ' + screenshot)
//   })()
// } catch (err) {
//   console.error(err)
// }
async function getBrowser() {
  return  await puppeteer.launch({
      headless: true,
      timeout: 20000,
      ignoreHTTPSErrors: true,
      slowMo: 0,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-sandbox',
        '--no-zygote',
        '--window-size=1280,720',
      ],
    });
}
// exports.bing = async (q) => {
//   var encodedQ = encodeURI(q);
//   const browser = await getBrowser()
//   const page = await browser.newPage();
//
//   await page.setDefaultNavigationTimeout(60000);
//   await page.goto(`https://bing.com/search?q=${encodedQ}&setmkt=en-WW&setlang=en`);
//   await page.waitForSelector(".b_pag");
//   const numberOfResults = await page.$$("#b_results > li");
//   for (let i = 1; i <= numberOfResults.length; i++) {
//     await page.hover(`#b_results > li:nth-child(${i})`);
//     await page.waitForTimeout(1000);
//   }
//   await page.hover(".b_pag");
//   const result = await page.evaluate(function () {
//     return Array.from(document.querySelectorAll("li.b_algo")).map((el) => ({
//       link: el.querySelector("h2 > a").getAttribute("href"),
//       title: el.querySelector("h2 > a").innerText,
//       snippet: el.querySelector("p, .b_mText div").innerText,
//     }));
//   });
//   return result;
// }


exports.bing = async (q) => {
  var encodedQ = encodeURI(q);
  const browser = await getBrowser()
  const page = await browser.newPage();
  await page.goto(`https://bing.com/search?q=${encodedQ}&setmkt=en-WW&setlang=en`);
  await page.waitForSelector(".b_pag");
  const result = await page.evaluate(function () {
    return Array.from(this.document.querySelectorAll("li.b_algo")).map((el) => {
      return {
        link: el.querySelector("h2 > a").getAttribute("href"),
        title: el.querySelector("h2 > a").innerText ,
        snippet: el.querySelector("p, .b_mText div").innerText,
      }
    });
  });
  console.log(result)
  return result;
}

exports.googs2 = async (q) => {
  const browser = await getBrowser()
  const page = await browser.newPage();
  await page.goto('https://google.com');
  await page.type('input[name="q"]', q);
  await page.$eval('input[name=btnK]', button => button.click()); // find button & click
  await page.waitForSelector('div[id=search]');
  var html = await page.content();
  return convert(html, {
    selectors: [
      { selector: 'a', format: 'skip' },
      { selector: 'img', format: 'skip' },
      { selector: 'data', format: 'skip' },
    ]
  });
}

exports.googs = async (searchQuery) => {
  const browser = await getBrowser()
    const page = await browser.newPage();
    await page.goto('https://google.com');
    await page.type('input[name="q"]', searchQuery);
    await page.$eval('input[name=btnK]', button => button.click()); // find button & click
    await page.waitForSelector('div[id=search]');
    await page.waitForSelector('h3');
    await page.$$eval('h3', results => {
      console.log(">>>")
      console.log(results)
      // results.forEach(e => {
      //   console.log(e);
      // });

        // let data = [];
        // results.forEach(parent => {
        //     const ele = parent.querySelector('h2');
        //     if (ele === null) {
        //         return;
        //     }
        //
        //     //Check if parent contains 1 div with class 'g' or contains many but nested in div with class 'srg'
        //     let gCount = parent.querySelectorAll('div[class=g]');
        //     //If there is no div with class 'g' that means there must be a group of 'g's in class 'srg'
        //     if (gCount.length === 0) {
        //         //Targets all the divs with class 'g' stored in div with class 'srg'
        //         gCount = parent.querySelectorAll('div[class=srg] > div[class=g]');
        //     }
        //     console.log(gCount)
        //
        //     //Iterate over all the divs with class 'g'
        //     gCount.forEach(result => {
        //         const title = result.querySelector('div[class=rc] > div[class=r] > a >  h3').innerText;
        //         const url = result.querySelector('div[class=rc] > div[class=r] > a').href;
        //         const desciption = result.querySelector('div[class=rc] > div[class=s] > div > span[class=st]').innerText;
        //         data.push({title, desciption, url});
        //     });
        // });

        //Return the top results
    });
    await browser.close();
};
