"use strict";

const Scrapist = require("scrapist").Scrapist;

const nicodic = new Scrapist({

  rootUrl: "http://dic.nicovideo.jp/m/a/a",

  defaultParam: {
    charIndex: 0,
    char: null,
    pageIndex: 0
  },

  pages: [

    // index page

    {
      resToData(result, ctx) {
        const { $ } = result;

        const characters = $("#main > div.left-box > div > table td a:nth-child(1)")
          .toArray()
          .map(e => $(e).text());

        const wordCount = $("#main > div.left-box > div > table td a:nth-child(3)")
          .toArray()
          .map(e => parseInt($(e).text().replace(/\(|\)/g, ""), 10));

        const count = wordCount.map(e => Math.ceil(e / 50));

        const start = ctx.param.charIndex ||
          (ctx.param.char ? Math.max(characters.indexOf(ctx.param.char), 0) : 0);

        return { characters, count, wordCount, start };
      },
      resToChildren(result, data) {
        const { $ } = result;

        return $("#main > div.left-box > div > table td a:first-child")
          .toArray()
          .slice(data.start)
          .map(e => $(e).url());
      }
    },

    //

    {
      toData(ctx) {
        return {
          char: ctx.parentData.characters[ctx.index + ctx.parentData.start],
          charIndex: ctx.index + ctx.parentData.start,
          count: ctx.parentData.count[ctx.index + ctx.parentData.start],
          pageIndex: ctx.index === 0 ? ctx.param.pageIndex : 0
        };
      },
      toChildren(data) {
        return new Array(data.count).fill()
          .slice(data.pageIndex)
          .map((c, i) => {
            return encodeURI(`http://dic.nicovideo.jp/m/yp/a/${data.char}/${(i + data.pageIndex) * 50 + 1}-`);
          });
      }
    },

    // word list page

    {
      resToData(result) {
        const { $ } = result;

        return $("#main > div.left-box > div > ul > ul > li")
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
            .filter(e => e !== null);
      }
    }
  ]

}, {

  onError(err) {
    return err.hasOwnProperty("url") && (err.statusCode !== "404" || err.statusCode !== 404);
  }

});

module.exports = nicodic;
