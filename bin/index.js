#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");

const ProgressBar = require("progress");
const yargs = require("yargs");
const co = require("co");

const collector = require("..");

function scrape(args) {
  return co(function *() {

    console.log("Start scraping");

    const bar = new ProgressBar("[:bar] :i :c :current/:total :percent :eta s", { total: 1, width: 20 });

    const stream = fs.createWriteStream(args.output, { flags: "a" });

    let resume, firstCharIndex, firstPageIndex;
    try {
      resume = JSON.parse(fs.readFileSync(args.resume, "utf8"));
      firstCharIndex = resume.page < resume.max ? resume.charIndex : resume.charIndex + 1;
      firstPageIndex = resume.page < resume.max ? resume.page : 0;
    } catch (e) {
      resume = {};
      firstCharIndex = args.char;
      firstPageIndex = args.pageIndex;
    }

    try {
      yield collector.scraper.scrapeAll({
        progressCb(c, i, p, m, w) {
          stream.write(w.map(ww => ww.name + "\t" + ww.yomi).join(os.EOL) + os.EOL);
          fs.writeFile(args.resume, JSON.stringify({ char: c, charIndex: i, page: p, max: m }));
          bar.total = m;
          bar.tick(p - bar.curr, { c, i });
        },
        firstCharIndex,
        firstPageIndex,
        concurrency: 1,
        concurrencyForEachCharacter: args.concurrency,
        waitMillisec: args.interval
      });

      console.log("DONE!");
    } catch (err) {
      console.error(os.EOL + os.EOL + "ERROR!");
      if (err.error && err.error.statusCode) {
        console.log("FetchError! Status code: " + err.error.statusCode);
      } else {
        console.error(err.stack || err.message || err);
      }
    } finally {
      stream.end();
    }

  });
}

function drop(args) {
  return co(function *() {

    console.log("Loading dictionary...");

    const set = yield collector.dropper.createDictionarySet(args.dictionary);

    console.log("Dropping words...");

    const count = yield collector.dropper.drop(args.input, set, args.output);

    console.log("DONE! " + count + " words are recorded!");

  });
}


const argv = yargs

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
    },
    output: {
      alias: "o",
      default: "cache/words.txt",
      type: "string",
      description: "Specify output file path"
    },
    resume: {
      alias: "r",
      default: "cache/resume.json",
      type: "string",
      description: "Specify file to save the progress"
    },
    concurrency: {
      alias: "c",
      default: 1,
      type: "number"
    },
    interval: {
      alias: "i",
      default: 1000,
      type: "number"
    }
  }, args => {
    scrape(args).catch(err => {
      console.error(err.stack || err);
    });
  })

  .command("drop", "Drop words recorded in dictionary and write results to file", {
    input: {
      alias: "i",
      type: "string",
      default: "cache/words.txt"
    },
    output: {
      alias: "o",
      type: "string",
      default: "cache/results.txt"
    },
    dictionary: {
      alias: "d",
      type: "string",
      required: true
    }
  }, args => {
    drop(args).catch(err => {
      console.error(err.stack || err);
    });
  })

  .command("all", "Exec scrape command and then drop command", {
    words: {
      alias: "w",
      type: "string",
      default: "cache/words.txt"
    },
    output: {
      alias: "o",
      type: "string",
      default: "cache/results.txt"
    },
    dictionary: {
      alias: "d",
      type: "string",
      required: true
    },
    resume: {
      alias: "r",
      default: "cache/resume.json",
      type: "string",
      description: "Specify file to save the progress"
    },
    concurrency: {
      alias: "c",
      default: 1,
      type: "number"
    },
    interval: {
      alias: "i",
      default: 1000,
      type: "number"
    }
  }, args => {
    scrape({
      output: args.words,
      resume: args.resume,
      concurrency: args.concurrency,
      interval: args.interval
    })
    .then(() => drop({
      input: args.words,
      output: args.output,
      dictionary: args.dictionary
    }))
    .catch(err => {
      console.error(err.stack || err);
    });
  })

  .help()
  .argv;

if (!argv._[0]) {
  yargs.showHelp();
}
