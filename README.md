# neologd-word-collector

Word collector not recorded in neologd

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
 npm start -- scrape
npm start -- drop -d cache/seed.csv
```
