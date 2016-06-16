"use strict";

const co = require("co");
const cheerio = require("cheerio-httpcli");
const throat = require("throat");

const katakana = "アイウエオヴカキクケコガギグゲゴサシスセソザジズゼゾタチツテトダヂヅデドナニヌネノハヒフヘホバビブベボパピプペポマミムメモヤユヨラリルレロワヲンァィゥェォッヮヰヱャュョー";

class FetchError {
  constructor(e) {
    this.name = "FetchError";
    this.message = "Failed to fetch";
    this.stack = e.stack;
    this.error = e;
  }
}

function waitFor(millisec = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, millisec);
  });
}

function fetch(char, index = 1, waitMillisec = 0) {

  if (!char) throw new Error("char is invalid");

  return co(function *() {

    if (waitMillisec > 0)
      yield waitFor(waitMillisec);

    const url = encodeURI(`http://dic.nicovideo.jp/m/yp/a/${char}/${index}-`);

    let result;
    try {
      result = yield cheerio.fetch(url);
    } catch (e) {
      throw new FetchError(e);
    }

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

function scrapeCharacter(char, pageIndex = 0, progressCb, concurrency = 1, waitMillisec = 0) {

  const t = throat(concurrency);
  const isCbEnabled = typeof progressCb === "function";

  return co(function *() {

    const result1 = yield fetch(char, pageIndex * 50 + 1, waitMillisec);
    const pageCount = (result1.maxPage - 1) / 50 + 1 - pageIndex;
    progressCb(char, 1, pageCount, result1.words, char);

    return Promise.all([
      Promise.resolve(result1.words),
      ...Array.from(new Array(pageCount - 1)).map((n, i) => {
        return t(() => fetch(char, (i + pageIndex + 1) * 50 + 1, waitMillisec).then(r => {
          if (isCbEnabled) progressCb(char, i + 2, pageCount, r.words, char);
          return r.words;
        }));
      })
    ]);

  });
}

function scrapeAll(progressCb, firstChar, pageIndex = 0, concurrency = 1, concurrencyForEachCharacter = 1, waitMillisec = 0) {

  const t = throat(concurrencyForEachCharacter);
  const isCbEnabled = typeof progressCb === "function";
  const progress = new Map();
  const max = new Map();

  function cb(char, i, m, words, c) {
    if (!isCbEnabled) return;
    progress.set(char, i);
    max.set(char, m);
    const wholeCurrent = Array.from(progress.values()).reduce((a, b) => a + b, 0);
    const wholeMax = Array.from(max.values()).reduce((a, b) => a + b, 0);
    progressCb(wholeCurrent, wholeMax, words, c);
  }

  const firstCharIndex = katakana.indexOf(firstChar);

  return Promise.all(
    Array.from(katakana.slice(firstCharIndex === -1 ? 0 : firstCharIndex)).map(k => t(
      () => scrapeCharacter(k, pageIndex, isCbEnabled ? cb : null, concurrency, waitMillisec)
    ))
  );

}

module.exports = {
  FetchError,
  fetch,
  scrapeCharacter,
  scrapeAll
};
