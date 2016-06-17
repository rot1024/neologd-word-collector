"use strict";

const fs = require("fs");
const os = require("os");

const byline = require("byline");

function createDictionarySet(dicFile) {
  const set = new Set();

  return new Promise(resolve => {
    const dicStream = byline(fs.createReadStream(dicFile, { encoding: "utf8" }));

    dicStream.on("data", line => {
      const i = line.indexOf(",");
      if (i === -1) return;
      const word = line.slice(0, i);
      set.add(word);
    });

    dicStream.on("end", () => {
      resolve(set);
    });
  });
}

function drop(targetFile, dictionary, outputFile) {

  const words = new Set();

  return new Promise(resolve => {
    let counter = 0;
    const stream = byline(fs.createReadStream(targetFile, { encoding: "utf8" }));
    const output = fs.createWriteStream(outputFile);

    stream.on("data", line => {
      const i = line.indexOf("\t");
      if (i === -1) return;
      const word = line.slice(0, i);
      if (!words.has(word) && !dictionary.has(word)) {
        output.write(line + os.EOL);
        words.add(word);
        counter++;
      }
    });

    stream.on("end", () => {
      output.end();
      resolve(counter);
    });
  });

}

module.exports = {
  createDictionarySet,
  drop
};
