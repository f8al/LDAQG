import { readFile } from "node:fs/promises";

const path = new URL("../data/questions.json", import.meta.url);
const data = JSON.parse(await readFile(path, "utf8"));
const errors = [];

if (!Array.isArray(data.rounds) || data.rounds.length === 0) errors.push("rounds must be a non-empty array");
for (const [roundIndex, round] of (data.rounds || []).entries()) {
  if (!round.name) errors.push(`round ${roundIndex + 1}: missing name`);
  if (!Array.isArray(round.categories)) errors.push(`${round.name || roundIndex}: categories must be an array`);
  for (const [categoryIndex, category] of (round.categories || []).entries()) {
    if (!category.name) errors.push(`${round.name}, category ${categoryIndex + 1}: missing name`);
    for (const [clueIndex, clue] of (category.clues || []).entries()) {
      for (const field of ["value", "clue", "answer"]) if (clue[field] === undefined || clue[field] === "") errors.push(`${round.name} / ${category.name} / clue ${clueIndex + 1}: missing ${field}`);
      if (!Number.isFinite(Number(clue.value))) errors.push(`${round.name} / ${category.name} / clue ${clueIndex + 1}: value must be numeric`);
    }
  }
}
const finals = Array.isArray(data.finalPool) && data.finalPool.length ? data.finalPool : [data.final];
for (const [finalIndex, final] of finals.entries()) {
  if (!final?.category || !final?.clue || !final?.answer) errors.push(`final ${finalIndex + 1} needs category, clue, and answer`);
}

if (errors.length) {
  console.error(`Question data has ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  const clueCount = data.rounds.reduce((total, round) => total + round.categories.reduce((sum, category) => sum + category.clues.length, 0), 0);
  const zeroDays = data.rounds.flatMap((round) => round.categories).flatMap((category) => category.clues).filter((clue) => clue.zeroDay).length;
  console.log(`Valid: ${data.rounds.length} rounds, ${clueCount} clues, ${zeroDays} Zero Days, and ${finals.length} final question(s).`);
}
