"use strict";

const co = require("co");
const cheerio = require("cheerio-httpcli");
const throat = require("throat");

const katakana = "アイウエオヴカキクケコガギグゲゴサシスセソザジズゼゾタチツテトダヂヅデドナニヌネノハヒフヘホバビブベボパピプペポマミムメモヤユヨラリルレロワヲンァィゥェォッヮヰヱャュョー";

function waitFor(millisec = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, millisec);
  });
}

function scrapePage(char, index = 1, waitMillisec = 0) {

  if (!char) throw new Error("char is invalid");

  return co(function *() {

    if (waitMillisec > 0)
      yield waitFor(waitMillisec);

    const url = encodeURI(`http://dic.nicovideo.jp/m/yp/a/${char}/${index}-`);

    const result = yield cheerio.fetch(url);

    const $ = result.$;

    const maxPage = parseInt($("#main > div.left-box > div > div:nth-child(5) > a").eq(-2).text(), 10);

    const words = $("#main > div.left-box > div > ul > ul > li")
      .toArray()
      .map(e => [
        $(e).children("a"),
        $(e).html().replace(/\n/g, "").match(
          /.*<\/a> \((.+)\).*(\d+\/\d+\/\d+\(.+\) \d\d:\d\d:\d\d)[. ]*(\(リダイレクト\))?/
        )
      ])
      .map(e => e[1] ? ({
        name: e[0].text(),
        yomi: e[1][1],
        url: e[0].attr("href"),
        fullUrl: e[0].url(),
        updatedAt: new Date(e[1][2]),
        redirect: !!e[1][3]
      }) : null)
      .filter(e => e !== null && !/一覧$/.test(e.name));

    return { maxPage, words };

  });
}

function scrapeCharacter({
  charIndex,
  pageIndex = 0,
  progressCb,
  concurrency = 1,
  waitMillisec = 0
}) {

  const t = throat(concurrency);
  const isCbEnabled = typeof progressCb === "function";

  return co(function *() {

    const result1 = yield scrapePage(katakana[charIndex], pageIndex * 50 + 1, waitMillisec);
    const pageCount = (result1.maxPage - 1) / 50 + 1 - pageIndex;
    progressCb(katakana[charIndex], charIndex, pageIndex + 1, pageCount + pageIndex, result1.words);

    return Promise.all([
      Promise.resolve(result1.words),
      ...Array.from(new Array(pageCount - 1)).map((n, i) => {
        return t(() => scrapePage(katakana[charIndex], (i + pageIndex + 1) * 50 + 1, waitMillisec).then(r => {
          if (isCbEnabled)
            progressCb(katakana[charIndex], charIndex, i + 2 + pageIndex, pageCount + pageIndex, r.words);
          return r.words;
        }));
      })
    ]);

  });
}

function scrapeAll({
  progressCb,
  firstChar,
  firstCharIndex = katakana.indexOf(firstChar),
  firstPageIndex = 0,
  concurrency = 1,
  concurrencyForEachCharacter = 1,
  waitMillisec = 0
}) {

  const t = throat(concurrencyForEachCharacter);
  const isCbEnabled = typeof progressCb === "function";
  const startIndex = firstCharIndex === -1 ? 0 : firstCharIndex;

  return Promise.all(
    Array.from(katakana.slice(startIndex)).map((k, i) => t(
      () => scrapeCharacter({
        charIndex: startIndex + i,
        pageIndex: firstPageIndex,
        progressCb: isCbEnabled ? progressCb : null,
        concurrency,
        waitMillisec
      })
    ))
  );

}

module.exports = {
  scrapePage,
  scrapeCharacter,
  scrapeAll
};
