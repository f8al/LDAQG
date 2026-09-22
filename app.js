"use strict";

const STORAGE_KEY = "ldaqg-state-v1";
const DEFAULT_DATA_URL = "data/questions.json";
const TEAM_COLORS = ["#48f58b", "#57e8ff", "#ffc857"];

const elements = {
  board: document.querySelector("#board"),
  finalBoard: document.querySelector("#final-board"),
  teams: document.querySelector("#teams"),
  roundNav: document.querySelector("#round-nav"),
  roundTitle: document.querySelector("#round-title"),
  roundKicker: document.querySelector("#round-kicker"),
  errorPanel: document.querySelector("#error-panel"),
  errorMessage: document.querySelector("#error-message"),
  clueDialog: document.querySelector("#clue-dialog"),
  clueCategory: document.querySelector("#clue-category"),
  clueValue: document.querySelector("#clue-value"),
  clueText: document.querySelector("#clue-text"),
  answerPanel: document.querySelector("#answer-panel"),
  answerText: document.querySelector("#answer-text"),
  answerNote: document.querySelector("#answer-note"),
  zeroDayBanner: document.querySelector("#zero-day-banner"),
  revealButton: document.querySelector("#reveal-button"),
  lifelineButton: document.querySelector("#lifeline-button"),
  lifelinePanel: document.querySelector("#lifeline-panel"),
  lifelineText: document.querySelector("#lifeline-text"),
  flagText: document.querySelector("#flag-text"),
  judgeControls: document.querySelector("#judge-controls"),
  wagerControl: document.querySelector("#wager-control"),
  wagerInput: document.querySelector("#wager-input"),
  setupDialog: document.querySelector("#setup-dialog"),
  teamNameInputs: document.querySelector("#team-name-inputs"),
  dataSourceLabel: document.querySelector("#data-source-label"),
  undoButton: document.querySelector("#undo-button")
};

let game = null;
let state = defaultState();
let activeClue = null;

function defaultState() {
  return {
    roundIndex: 0,
    teams: [
      { name: "Team Alpha", score: 0, flags: 0 },
      { name: "Team Bravo", score: 0, flags: 0 },
      { name: "Team Charlie", score: 0, flags: 0 }
    ],
    used: [],
    history: [],
    finalRevealed: false
  };
}

async function init() {
  bindEvents();
  restoreState();
  const params = new URLSearchParams(location.search);
  const source = params.get("data") || DEFAULT_DATA_URL;
  try {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = await response.text();
    game = source.toLowerCase().endsWith(".csv") ? gameFromCsv(text) : JSON.parse(text);
    validateGame(game);
    elements.dataSourceLabel.textContent = `Loaded: ${source}`;
    render();
  } catch (error) {
    showError(`${error.message} Open this site through a web server; browsers block data loading from file:// URLs.`);
  }
}

function bindEvents() {
  document.querySelector("#clue-close").addEventListener("click", closeClue);
  document.querySelector("#setup-button").addEventListener("click", () => elements.setupDialog.showModal());
  document.querySelector("#fullscreen-button").addEventListener("click", toggleFullscreen);
  document.querySelector("#reset-button").addEventListener("click", resetGame);
  elements.undoButton.addEventListener("click", undoScore);
  elements.revealButton.addEventListener("click", revealAnswer);
  elements.lifelineButton.addEventListener("click", revealLifeline);
  document.querySelector("#data-file-input").addEventListener("change", loadLocalFile);
  document.addEventListener("keydown", handleShortcut);
}

function validateGame(data) {
  if (!data || !Array.isArray(data.rounds) || !data.rounds.length) throw new Error("Data needs a non-empty rounds array.");
  data.rounds.forEach((round, roundIndex) => {
    if (!round.name || !Array.isArray(round.categories) || !round.categories.length) throw new Error(`Round ${roundIndex + 1} needs a name and categories.`);
    round.categories.forEach((category, categoryIndex) => {
      if (!category.name || !Array.isArray(category.clues) || !category.clues.length) throw new Error(`Category ${categoryIndex + 1} in ${round.name} is incomplete.`);
      category.clues.forEach((clue, clueIndex) => {
        if (!Number.isFinite(Number(clue.value)) || !clue.clue || !clue.answer) throw new Error(`Clue ${clueIndex + 1} in ${category.name} needs value, clue, and answer.`);
      });
    });
  });
}

function render() {
  if (!game) return;
  state.roundIndex = Math.min(state.roundIndex, game.rounds.length);
  renderRoundNav();
  renderTeams();
  renderTeamInputs();
  elements.undoButton.disabled = state.history.length === 0;
  if (state.roundIndex === game.rounds.length) renderFinal();
  else renderBoard();
  saveState();
}

function renderRoundNav() {
  elements.roundNav.replaceChildren();
  game.rounds.forEach((round, index) => {
    const button = makeButton(round.shortName || round.name, "button round-button");
    button.setAttribute("aria-current", String(state.roundIndex === index));
    button.addEventListener("click", () => { state.roundIndex = index; render(); });
    elements.roundNav.append(button);
  });
  if (game.final) {
    const button = makeButton(game.final.shortName || "Exfil", "button round-button");
    button.setAttribute("aria-current", String(state.roundIndex === game.rounds.length));
    button.addEventListener("click", () => { state.roundIndex = game.rounds.length; render(); });
    elements.roundNav.append(button);
  }
}

function renderBoard() {
  const round = game.rounds[state.roundIndex];
  elements.board.hidden = false;
  elements.finalBoard.hidden = true;
  elements.roundKicker.textContent = `ROUND ${String(state.roundIndex + 1).padStart(2, "0")}`;
  elements.roundTitle.textContent = round.name;
  elements.board.style.setProperty("--columns", round.categories.length);
  elements.board.replaceChildren();
  round.categories.forEach((category) => {
    const header = document.createElement("div");
    header.className = "category";
    header.textContent = category.name;
    elements.board.append(header);
  });
  const maxClues = Math.max(...round.categories.map((category) => category.clues.length));
  for (let clueIndex = 0; clueIndex < maxClues; clueIndex += 1) {
    round.categories.forEach((category, categoryIndex) => {
      const clue = category.clues[clueIndex];
      if (!clue) {
        const spacer = document.createElement("div");
        elements.board.append(spacer);
        return;
      }
      const key = clueKey(state.roundIndex, categoryIndex, clueIndex);
      const button = makeButton(formatScore(clue.value), "tile");
      button.dataset.key = key;
      button.classList.toggle("used", state.used.includes(key));
      button.disabled = state.used.includes(key);
      button.setAttribute("aria-label", `${category.name} for ${clue.value}${clue.zeroDay ? ", hidden Zero Day" : ""}`);
      button.addEventListener("click", () => openClue({ clue, category, categoryIndex, clueIndex, key }));
      elements.board.append(button);
    });
  }
}

function renderFinal() {
  const final = game.final;
  elements.board.hidden = true;
  elements.finalBoard.hidden = false;
  elements.roundKicker.textContent = "FINAL ROUND";
  elements.roundTitle.textContent = final?.name || "Exfil";
  elements.finalBoard.replaceChildren();
  if (!final) {
    elements.finalBoard.textContent = "No final question is configured.";
    return;
  }
  const title = document.createElement("h3");
  title.textContent = final.category;
  const text = document.createElement("p");
  text.textContent = state.finalRevealed ? final.answer : final.clue;
  const button = makeButton(state.finalRevealed ? "Show clue" : "Reveal question", "button button-primary");
  button.addEventListener("click", () => { state.finalRevealed = !state.finalRevealed; renderFinal(); saveState(); });
  elements.finalBoard.append(title, text);
  if (state.finalRevealed && final.note) {
    const note = document.createElement("p");
    note.className = "answer-note";
    note.textContent = final.note;
    elements.finalBoard.append(note);
  }
  elements.finalBoard.append(button);
  const controls = document.createElement("div");
  controls.className = "clue-controls";
  state.teams.forEach((team, index) => {
    const label = document.createElement("label");
    label.className = "wager-control";
    label.append(`${team.name} wager `);
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(Math.max(0, team.score));
    input.step = "100";
    input.value = String(final.wagers?.[index] || 0);
    input.dataset.finalWager = String(index);
    label.append(input);
    controls.append(label);
    const correct = makeButton(`✓ ${team.name}`, "button judge-button correct");
    correct.addEventListener("click", () => scoreFinal(index, 1, input));
    const wrong = makeButton(`✕ ${team.name}`, "button judge-button wrong");
    wrong.addEventListener("click", () => scoreFinal(index, -1, input));
    controls.append(correct, wrong);
  });
  elements.finalBoard.append(controls);
}

function renderTeams() {
  elements.teams.replaceChildren();
  state.teams.forEach((team, index) => {
    const card = document.createElement("article");
    card.className = "team-card";
    card.style.setProperty("--team-color", TEAM_COLORS[index]);
    const name = document.createElement("span");
    name.className = "team-name";
    name.textContent = team.name;
    const score = document.createElement("strong");
    score.className = "team-score";
    score.textContent = formatScore(team.score);
    const flags = document.createElement("span");
    flags.className = "team-flags";
    flags.textContent = `${team.flags || 0} ⚑`;
    flags.title = "Flags won through lifelines";
    card.append(name, score, flags);
    elements.teams.append(card);
  });
}

function renderTeamInputs() {
  elements.teamNameInputs.replaceChildren();
  state.teams.forEach((team, index) => {
    const label = document.createElement("label");
    label.append(`Team ${index + 1}`);
    const input = document.createElement("input");
    input.value = team.name;
    input.maxLength = 30;
    input.addEventListener("change", () => { team.name = input.value.trim() || `Team ${index + 1}`; render(); });
    label.append(input);
    elements.teamNameInputs.append(label);
  });
}

function openClue(context) {
  activeClue = context;
  const { clue, category } = context;
  elements.clueCategory.textContent = category.name;
  elements.clueValue.textContent = formatScore(clue.value);
  elements.clueText.textContent = clue.clue;
  elements.answerText.textContent = clue.answer;
  elements.answerNote.textContent = clue.note || "Responses must be phrased as a question.";
  elements.zeroDayBanner.hidden = !clue.zeroDay;
  elements.answerPanel.hidden = true;
  elements.judgeControls.hidden = true;
  elements.revealButton.hidden = false;
  elements.lifelineButton.hidden = !clue.lifeline;
  elements.lifelinePanel.hidden = true;
  elements.flagText.hidden = true;
  elements.wagerControl.hidden = !clue.zeroDay;
  elements.wagerInput.value = clue.zeroDay ? String(clue.value) : "";
  elements.clueDialog.showModal();
}

function revealAnswer() {
  if (!activeClue) return;
  elements.answerPanel.hidden = false;
  elements.revealButton.hidden = true;
  elements.judgeControls.hidden = false;
  renderJudgeControls(false);
}

function revealLifeline() {
  if (!activeClue?.clue.lifeline) return;
  elements.lifelineText.textContent = activeClue.clue.lifeline;
  elements.flagText.textContent = activeClue.clue.flag || "Flag awarded by the judge.";
  elements.flagText.hidden = !activeClue.clue.flag;
  elements.lifelinePanel.hidden = false;
  elements.lifelineButton.hidden = true;
  elements.judgeControls.hidden = false;
  renderJudgeControls(true);
}

function renderJudgeControls(lifelineMode) {
  elements.judgeControls.replaceChildren();
  state.teams.forEach((team, index) => {
    const correct = makeButton(lifelineMode ? `⚑ ${team.name} got it` : `✓ ${team.name}`, "button judge-button correct");
    correct.addEventListener("click", () => lifelineMode ? awardFlag(index) : judge(index, true));
    elements.judgeControls.append(correct);
    if (!lifelineMode) {
      const wrong = makeButton(`✕ ${team.name}`, "button judge-button wrong");
      wrong.addEventListener("click", () => judge(index, false));
      elements.judgeControls.append(wrong);
    }
  });
  const noScore = makeButton(lifelineMode ? "Nobody got it" : "No score / close", "button button-quiet");
  noScore.addEventListener("click", markUsedAndClose);
  elements.judgeControls.append(noScore);
}

function judge(teamIndex, correct) {
  const clue = activeClue.clue;
  const rawAmount = clue.zeroDay ? Number(elements.wagerInput.value) : Number(clue.value);
  const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : Number(clue.value);
  applyScore(teamIndex, correct ? amount : -amount, correct ? "correct" : "incorrect");
  if (correct || clue.zeroDay) markUsedAndClose();
}

function awardFlag(teamIndex) {
  state.history.push({ type: "flag", teamIndex, delta: 1, clueKey: activeClue.key });
  state.teams[teamIndex].flags = (state.teams[teamIndex].flags || 0) + 1;
  markUsedAndClose();
}

function applyScore(teamIndex, delta, reason) {
  state.history.push({ type: "score", teamIndex, delta, reason, clueKey: activeClue?.key || "final" });
  state.teams[teamIndex].score += delta;
  renderTeams();
  elements.undoButton.disabled = false;
  saveState();
}

function scoreFinal(teamIndex, direction, input) {
  const available = Math.max(0, state.teams[teamIndex].score);
  const wager = Math.min(available, Math.max(0, Number(input.value) || 0));
  input.value = String(wager);
  applyScore(teamIndex, wager * direction, direction > 0 ? "final correct" : "final incorrect");
}

function markUsedAndClose() {
  if (activeClue && !state.used.includes(activeClue.key)) state.used.push(activeClue.key);
  saveState();
  closeClue();
  render();
}

function closeClue() {
  if (elements.clueDialog.open) elements.clueDialog.close();
  activeClue = null;
}

function undoScore() {
  const item = state.history.pop();
  if (!item) return;
  if (item.type === "flag") state.teams[item.teamIndex].flags = Math.max(0, state.teams[item.teamIndex].flags - item.delta);
  else state.teams[item.teamIndex].score -= item.delta;
  render();
}

function resetGame() {
  if (!confirm("Reset scores, flags, and every used square? Team names will be kept.")) return;
  const names = state.teams.map((team) => team.name);
  state = defaultState();
  state.teams.forEach((team, index) => { team.name = names[index]; });
  render();
}

async function loadLocalFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const candidate = file.name.toLowerCase().endsWith(".csv") ? gameFromCsv(text) : JSON.parse(text);
    validateGame(candidate);
    game = candidate;
    state.roundIndex = 0;
    state.used = [];
    state.finalRevealed = false;
    elements.dataSourceLabel.textContent = `Loaded locally: ${file.name} (refresh returns to the site file)`;
    elements.errorPanel.hidden = true;
    render();
  } catch (error) {
    showError(`Could not read ${file.name}: ${error.message}`);
  }
}

function gameFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV file has no question rows.");
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || ""])));
  const data = { title: "Legally Distinct Answer-Question Game", rounds: [], final: null };
  for (const record of records) {
    const type = (record.type || "clue").toLowerCase();
    if (type === "final") {
      data.final = { name: record.round || "Exfil", category: record.category, clue: record.clue, answer: record.answer, note: record.note };
      continue;
    }
    let round = data.rounds.find((item) => item.name === record.round);
    if (!round) {
      round = { name: record.round, shortName: record.round, categories: [] };
      data.rounds.push(round);
    }
    let category = round.categories.find((item) => item.name === record.category);
    if (!category) {
      category = { name: record.category, clues: [] };
      round.categories.push(category);
    }
    category.clues.push({
      value: Number(record.value),
      clue: record.clue,
      answer: record.answer,
      note: record.note,
      zeroDay: ["true", "yes", "1"].includes(record.zeroDay?.toLowerCase()),
      lifeline: record.lifeline,
      flag: record.flag
    });
  }
  return data;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function handleShortcut(event) {
  if (event.target.matches("input, textarea")) return;
  if (event.code === "Space" && elements.clueDialog.open && !elements.revealButton.hidden) { event.preventDefault(); revealAnswer(); }
  if (event.key.toLowerCase() === "f") toggleFullscreen();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function clueKey(round, category, clue) { return `${round}-${category}-${clue}`; }
function formatScore(value) { return Number(value) < 0 ? `−${Math.abs(Number(value)).toLocaleString()}` : Number(value).toLocaleString(); }
function makeButton(text, className) { const button = document.createElement("button"); button.type = "button"; button.className = className; button.textContent = text; return button; }
function showError(message) { elements.errorMessage.textContent = message; elements.errorPanel.hidden = false; }
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode may disable storage */ } }
function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.teams?.length === 3) state = { ...defaultState(), ...saved };
  } catch { localStorage.removeItem(STORAGE_KEY); }
}

init();
