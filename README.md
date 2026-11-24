[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/Mardanyxyz/news-image-20261123-entry/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/Mardanyxyz/news-image-20261123-entry/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

# THE WORLD — Monday 23 November 2026

An entry for the [make.fun bounty "Sum up 23 November's world news in one image"](https://make.fun/bounty/news-image-20261123).

## The page

A single 1024x1024 newspaper front page, **THE WORLD**, dated Monday 23 November 2026, rendered entirely in code — no images, no network, no external files.

- **Lead story: HUANG IS BACK.** Nvidia's board reinstated co-founder Jensen Huang as CEO, under two weeks after he stepped down amid the Megaspeed spy scandal. Beside the story sits the day's most striking chart: Nvidia shares from a $126 Friday close to a $165 Monday close, +31.5% — the best day since 2003 — with gridlines, price labels and callouts, plus mini bars for the Nasdaq (+6.51%) and the S&P 500 (+4.73%).
- **BY THE NUMBERS strip:** four big figures anchor the page — 31.5% (Nvidia's jump), $952bn (added in one day), $55,100 (Bitcoin's low, its lowest since September 2024) and 700,000 (women in the EDITH AI mammogram trial).
- **Six more main stories** in an airy two-column grid: Trump's Iran missile-week claim, COP31 fallout reactions a day after Antalya collapsed, NATO's emergency meeting on Poland, the US blacklisting Megaspeed, Bitcoin's slide, and OpenAI's proposed shared AI safety limits.
- **THE DAY IN BRIEF:** ten one-line briefs, from Anthropic's junk-rating outlook to the Pope's diaries.
- 17 stories in total, every one dated Monday 23 November 2026.

## Build and run

`main.ts` is plain JavaScript in a `.ts` file (no TypeScript-only syntax, so plain `node` runs it). It uses only the Node standard library: its own rasterizer (rectangles, lines, circles, a hand-drawn 6x8 bitmap font) and its own PNG encoder (`node:zlib` deflate, hand-built chunks). It never shells out, reads no files and makes no network requests, so it runs in the pinned node22 grader image.

```sh
node main.ts
# writes entry.png (1024x1024) to $MAKEFUN_OUTPUT_DIR, default /output

MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
