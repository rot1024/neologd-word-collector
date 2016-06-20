# neologd-word-collector

Nicodic word collector not recorded in NEologd

## Requirement

Node.js v6

## Usage

```sh
git clone https://github.com/neologd/mecab-ipadic-neologd.git
git clone https://github.com/rot1024/neologd-word-collector.git
cd neologd-word-collector
npm install
xz -dk ../mecab-ipadic-neologd/seed/*.xz
cat ../mecab-ipadic-neologd/seed/*.csv > cache/seed.csv
npm start -- --help # show help
 npm start -- scrape # scrape title and title pronunciation of all articles of niconico dictionary
npm start -- drop -d cache/seed.csv # drop words already recorded in NEologd
```
