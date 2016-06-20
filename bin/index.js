#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");

const Gauge = require("gauge");
const yargs = require("yargs");
const co = require("co");

const collector = require("..");

function showProgress(gauge, curr, total, char, pageIndex, pageCount) {
  gauge.show(`${char} ${pageIndex + 1}/${pageCount} | ${curr}/${total} ${Math.round(curr / total * 100)}%`, curr / total);
}

function scrape(args) {
  return co(function *() {

    console.log("Start scraping");

    const gauge = new Gauge({
      updateInterval: 50,
      theme: "ASCII"
    });

    const progress = (() => {
      try {
        return JSON.parse(fs.readFileSync(args.resume, "utf8"));
      } catch (e) {
        return { charIndex: 0, pageIndex: 0 };
      }
    })();

    const stream = fs.createWriteStream(args.output, { flags: "a" });

    let total = -1;
    let curr = 0;
    let spin;

    try {
      yield collector.nicodic.scrape({
        charIndex: progress.charIndex,
        pageIndex: progress.pageIndex
      }, {
        onData(data, ctx) {

          if (ctx.depth === 0) {

            const startPage = Math.min(data.count[data.start] - 1, ctx.param.pageIndex);

            total = data.count.reduce((a, b) => a + b, 0);
            curr = data.count.slice(0, data.start).reduce((a, b) => a + b, 0) + startPage;

            spin = setInterval(() => { gauge.pulse(); }, 100);

            showProgress(
              gauge,
              curr,
              total,
              data.characters[data.start],
              startPage,
              data.count[data.start]
            );

          } else if (ctx.depth === 2) {

            stream.write(data.map(d => d.name + "\t" + d.yomi).join(os.EOL) + os.EOL);

            fs.writeFile(args.resume, JSON.stringify({
              charIndex: ctx.parentData.charIndex,
              pageIndex: ctx.parentData.pageIndex + ctx.index
            }));

            showProgress(
              gauge,
              ++curr,
              total,
              ctx.parentData.char,
              ctx.parentData.pageIndex + ctx.index,
              ctx.parentData.count
            );

          }

        },
        concurrency: args.concurrency,
        interval: args.interval,
        trial: 5,
        trialInterval: 5000
      });

      clearInterval(spin);
      gauge.hide();
      console.log("DONE!");
    } catch (err) {
      console.error(os.EOL + os.EOL + "ERROR!");
      if (err.url || err.statusCode) {
        console.log("FetchError", err.statusCode, err.url);
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
      alias: "s",
      default: 0,
      type: "number",
      description: "Specify start character index"
    },
    page: {
      alias: "p",
      default: 0,
      type: "number",
      description: "Specify start page index"
    },
    output: {
      alias: "o",
      default: "cache/words.tsv",
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
      default: "cache/words.tsv"
    },
    output: {
      alias: "o",
      type: "string",
      default: "cache/results.tsv"
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
      default: "cache/words.tsv"
    },
    output: {
      alias: "o",
      type: "string",
      default: "cache/results.tsv"
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
