#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const ProgressBar = require("progress");
const yargv = require("yargs");

const collector = require("..");

const argv = yargv

  .command("scrape", "Scrape data from nicodic", {
    char: {
      alias: "c",
      type: "string",
      description: "Specify start character"
    },
    page: {
      alias: "p",
      default: 0,
      type: "number",
      description: "Specify start page index"
    }
  }, args => {

    console.log("Start scraping");

    const resumeFile = path.resolve(__dirname, "..", "cache", "resume.json");
    const bar = new ProgressBar("[:bar] :i :c :current/:total :percent :eta s", { total: 1, width: 20 });

    const stream = fs.createWriteStream(
      path.resolve(__dirname, "..", "cache", "words.txt"),
      { flags: "a" }
    );

    let resume, firstCharIndex, firstPageIndex;
    try {
      resume = JSON.parse(fs.readFileSync(resumeFile, "utf8"));
      firstCharIndex = resume.page < resume.max ? resume.charIndex : resume.charIndex + 1;
      firstPageIndex = resume.page < resume.max ? resume.page : 0;
    } catch (e) {
      resume = {};
      firstCharIndex = args.char;
      firstPageIndex = args.pageIndex;
    }

    collector.scraper.scrapeAll({
      progressCb(c, i, p, m, w) {
        stream.write(w.map(ww => ww.name + "\t" + ww.yomi).join(os.EOL) + os.EOL);
        fs.writeFile(resumeFile, JSON.stringify({ char: c, charIndex: i, page: p, max: m }));
        bar.total = m;
        bar.tick(p - bar.curr, { c, i });
      },
      firstCharIndex,
      firstPageIndex,
      concurrency: 1,
      concurrencyForEachCharacter: 1,
      waitMillisec: 1000
    }).then(() => {
      stream.end();
      console.log("DONE!");
    }).catch(err => {
      stream.end();
      console.error(os.EOL + os.EOL + "ERROR!");
      if (err.error && err.error.statusCode) {
        console.log("FetchError! Status code: " + err.error.statusCode);
      } else {
        console.error(err.stack || err.message || err);
      }
    });

  })

  .help()
  .argv;

if (!argv._[0]) {
  yargv.showHelp();
}
