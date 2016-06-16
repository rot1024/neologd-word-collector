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
      default: 0,
      type: "number",
      description: "Specify character index: ア = 0"
    },
    page: {
      alias: "p",
      default: 0,
      type: "number",
      description: "Specify page index"
    }
  }, args => {

    console.log("Start scraping");

    const bar = new ProgressBar("[:bar] :c :current/:total :percent :eta", { total: 1, width: 20 });

    const stream = fs.createWriteStream(path.resolve(__dirname, "..", "cache", "words.txt"));

    collector.scraper.scrapeAll((p, m, w, c) => {
      stream.write(w.map(ww => ww.name + "\t" + ww.yomi).join(os.EOL) + os.EOL);
      bar.total = m;
      bar.current = p;
      bar.tick({ c });
    }).then(() => {
      stream.end();
      console.log("DONE!");
    }).catch(err => {
      stream.end();
      console.log("ERROR!");
      console.log(err.stack || err.message || err);
    }, args.char, args.page, 1, 1, 1000);

  })

  .help()
  .argv;

if (!argv._[0]) {
  yargv.showHelp();
}
