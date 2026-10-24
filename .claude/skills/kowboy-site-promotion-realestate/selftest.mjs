// Renders the saved Norban run and checks that the report still says what Patric approved on
// 2026-10-20, with that run's own numbers. Not part of Core's tests: the skill never blocks Core.
//   node .claude/skills/kowboy-site-promotion-realestate/selftest.mjs

import { readFile } from 'node:fs/promises';
import { decode, render } from './lib.mjs';
import { buildModel } from './model.mjs';

const here = (file) => new URL(file, import.meta.url);
const facts = JSON.parse(await readFile(here('fixture/norban-facts.json'), 'utf8'));
const html = render(await readFile(here('template.html'), 'utf8'), buildModel(facts));
const text = decode(
  html.replace(/<style[\s\S]*?<\/style\s*>|<svg[\s\S]*?<\/svg\s*>/g, ' ').replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ');
const { speed, counts } = facts;

const approved = [
  "Today's site brings Norban's homes, agents and areas from Vitec to buyers every day. The next generation keeps all of that and builds on it: faster on phones, easier to find in Google and AI assistants, more pages that bring buyers in, and forms that turn more visits into leads.",
  `${speed.ours.home.lcp.toFixed(1)} s until the home page shows on a phone. Google counts up to 2.5 seconds as good.`,
  `${speed.ours.home.perf} / 100 in Google's speed test for the home page on a phone.`,
  `${counts.associations} new pages, one for each housing association in Norban's records.`,
  `${speed.ours.home.a11y} / 100 in Google's accessibility test, so the site works for every visitor.`,
  "layout shift while a home's page loads, so nothing jumps. Google counts up to 0.1 as good.",
  `${counts.areas} area pages, each with its outline on a map and its homes.`,
  "Three ways to get in touch, each where it belongs: a free valuation on every page, interest on every home, and booking a chosen viewing time. Every form can also save the visitor's home search in Vitec.",
  'Seconds until a phone shows the main content',
  'What Norban keeps',
  'Every home, agent, area and office from Vitec, as today.',
  'The same web addresses for every home and agent that Vitec lists for the site.',
  "Norban's name, logo and texts.",
  'Kowboy as the partner behind the site, and for the move.',
  'Six steps forward',
  'Google writes that good speed aligns with what its ranking rewards.',
  'The first screen appears at once, even on mobile data.',
  'Every home, list and heading arrives as finished text that Google and assistants such as ChatGPT can read.',
  'Homes can appear in searches and in AI answers.',
  'A shared home shows its photo and first lines.',
  `A page for each of the ${counts.associations} housing associations, a map for every area, and lists of all homes, agents and areas.`,
  "A search for a building or an area can land on Norban's own page, which offers a free valuation.",
  "A building's documents and sold homes together.",
  "Each form opens in a short window and can also save the visitor's home search in Vitec.",
  'We expect more valuation requests and buyer profiles, and a robot check keeps junk out.',
  'The phone fills in name, phone and e-mail by itself.',
  'Cards name the area and the next viewing, photos open full screen, and every home sits on a map.',
  `An accessibility score of ${speed.ours.home.a11y} of 100 helps the site reach every buyer, screen reader users too.`,
  "Kowboy's service tells the site as soon as Vitec reports a change, and the site checks again every 15 minutes.",
  'One theme and one plugin do the work, so there are fewer parts to keep updated.',
  'What they see is what Vitec says now.',
  "Kowboy Chat, which greets visitors on a home's page as its agent and offers to book a viewing or a valuation.",
  'Found in Google by people ready to move',
  'What Kowboy Core does so Google finds every home',
];

const missing = approved.filter((sentence) => !text.includes(sentence));
const sheets = (html.match(/<section class="sheet/g) ?? []).length;
if (sheets !== 3) missing.push(`three sheets (found ${sheets})`);
for (const sentence of missing) console.error(`missing: ${sentence}`);
console.log(
  missing.length === 0
    ? `ok: ${approved.length} approved sentences, 3 sheets`
    : `${missing.length} missing`,
);
process.exitCode = missing.length === 0 ? 0 : 1;
