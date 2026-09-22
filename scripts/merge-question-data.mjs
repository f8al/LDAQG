import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const write = args.includes("--write");
const incomingPath = args.find((arg) => arg !== "--write");
const targetPath = resolve(new URL("../data/questions.json", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));

if (!incomingPath) {
  console.error("Usage: node scripts/merge-question-data.mjs <incoming.json> [--write]");
  process.exit(1);
}

const current = JSON.parse(await readFile(targetPath, "utf8"));
const incoming = JSON.parse(await readFile(resolve(incomingPath), "utf8"));

const normalize = (value) => String(value || "")
  .normalize("NFKD")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const clueKey = (item) => `${normalize(item.clue)}\u001f${normalize(item.answer)}`;
const allCurrentClues = current.rounds
  .flatMap((round) => round.categories)
  .flatMap((category) => category.clues);
const currentFinals = Array.isArray(current.finalPool) && current.finalPool.length
  ? current.finalPool
  : current.final ? [current.final] : [];
const seenClues = new Set([...allCurrentClues, ...currentFinals].map(clueKey));

const report = {
  categoriesAdded: [],
  cluesAddedToExistingCategories: [],
  finalQuestionsAdded: [],
  duplicateCategoriesSkipped: [],
  duplicateCluesSkipped: 0,
  warnings: []
};

for (const incomingRound of incoming.rounds || []) {
  let targetRound = current.rounds.find((round) => normalize(round.name) === normalize(incomingRound.name));
  if (!targetRound) {
    targetRound = { name: incomingRound.name, shortName: incomingRound.shortName || incomingRound.name, categories: [] };
    current.rounds.push(targetRound);
  }

  for (const incomingCategory of incomingRound.categories || []) {
    const targetCategory = targetRound.categories.find((category) => normalize(category.name) === normalize(incomingCategory.name));
    if (targetCategory) {
      let added = 0;
      for (const clue of incomingCategory.clues || []) {
        const key = clueKey(clue);
        if (seenClues.has(key)) {
          report.duplicateCluesSkipped += 1;
          continue;
        }
        targetCategory.clues.push(clue);
        seenClues.add(key);
        added += 1;
      }
      if (added) report.cluesAddedToExistingCategories.push(`${targetRound.name} / ${targetCategory.name}: ${added}`);
      else report.duplicateCategoriesSkipped.push(`${targetRound.name} / ${targetCategory.name}`);
      continue;
    }

    const uniqueClues = [];
    for (const clue of incomingCategory.clues || []) {
      const key = clueKey(clue);
      if (seenClues.has(key)) {
        report.duplicateCluesSkipped += 1;
        continue;
      }
      uniqueClues.push(clue);
      seenClues.add(key);
    }
    if (!uniqueClues.length) {
      report.duplicateCategoriesSkipped.push(`${targetRound.name} / ${incomingCategory.name}`);
      continue;
    }
    if (uniqueClues.length !== 5) report.warnings.push(`${targetRound.name} / ${incomingCategory.name} has ${uniqueClues.length} unique clues, expected 5.`);
    targetRound.categories.push({ ...incomingCategory, clues: uniqueClues });
    report.categoriesAdded.push(`${targetRound.name} / ${incomingCategory.name}`);
  }
}

if (!Array.isArray(current.finalPool)) current.finalPool = currentFinals;
const incomingFinals = Array.isArray(incoming.finalPool) && incoming.finalPool.length
  ? incoming.finalPool
  : incoming.final ? [incoming.final] : [];
for (const final of incomingFinals) {
  const key = clueKey(final);
  if (seenClues.has(key)) {
    report.duplicateCluesSkipped += 1;
    continue;
  }
  current.finalPool.push({
    ...final,
    ...(current.final?.audio ? { audio: current.final.audio } : {})
  });
  seenClues.add(key);
  report.finalQuestionsAdded.push(final.category);
}

console.log(JSON.stringify(report, null, 2));
console.log(write ? "Writing merged data." : "Dry run only; pass --write to update data/questions.json.");
if (write) await writeFile(targetPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
