# Legally Distinct Answer-Question Game

A projector-friendly, zero-build trivia board—the lowest-budget version of hacker jeopardy you'll ever laugh at. It is plain HTML, CSS, and JavaScript, so GitHub Pages can host it directly.

## Run it locally

Opening `index.html` directly will not work because browsers block `fetch()` from `file://` pages. From this directory, run:

```powershell
npx serve .
```

Then open the local URL printed by `serve`. Any small static web server works.

## Write questions separately

The live game loads [`data/questions.json`](data/questions.json). Writers only need to change that file. Each ordinary clue supports:

```json
{
  "value": 300,
  "clue": "The prompt shown to contestants.",
  "answer": "What is the accepted response?",
  "note": "Optional judge guidance.",
  "zeroDay": false,
  "lifeline": "Optional instruction for the audience lifeline.",
  "flag": "flag{optional_prize_text}"
}
```

Run this before committing:

```powershell
node scripts/validate-data.mjs
```

The included GitHub Action runs the same check before publishing.

### Contributing content

- Writers who do not want to edit JSON can open the **Submit a category or clue** issue form. It collects the round, category premise, five clues, accepted questions, sources, Zero Day ideas, and optional lifeline details.
- Writers working directly in the repository should open a pull request. The PR template includes originality, value-ladder, fact-checking, formatting, and validation checks.
- Submit one complete category per issue or a small, reviewable group of categories per pull request.

### CSV workflow

Copy [`data/questions-template.csv`](data/questions-template.csv) and keep its header row. CSV columns are:

`type, round, category, value, clue, answer, note, zeroDay, lifeline, flag, audio`

- Set `type` to `clue` for board squares or `final` for the Exfil clue.
- Quote any cell containing commas, quotes, or line breaks.
- Set `zeroDay` to `true`, `yes`, or `1` for a hidden bonus square.
- Set `audio` on the `final` row to a site-relative MP3 path for the Exfil music control.
- Rows stay in their file order; that determines round, category, and clue order.

Use CSV in either of two ways:

1. Click **Game setup → Choose JSON or CSV** for a rehearsal-only local import.
2. Commit the CSV and open the board with `?data=data/your-file.csv`. For example: `https://example.github.io/game/?data=data/conference.csv`.

## Host controls

- Each round randomly draws six categories from its category pool. The draw survives refreshes and round switching; **Reset game** draws a fresh set.
- Click a square to open its clue.
- Press Space or click **Reveal question**.
- Correct and incorrect team buttons apply the square value. Incorrect answers leave an ordinary clue open so another team can try.
- A Zero Day exposes a wager field and closes after the landing team's result.
- A clue with `lifeline` enables **Use lifeline**. If the audience helper solves it, award that team a flag marker; optional `flag` text is revealed in the host view.
- Scores, used squares, flags, and team names are saved in the browser.
- **Undo score** reverses the latest score or flag award.
- The print stylesheet produces a simple paper backup of the current board.
- Exfil has a minimal Play/Stop control when its data contains an `audio` path. Stopping or leaving Exfil rewinds the track.

## Publish on GitHub Pages

1. Create a GitHub repository with this directory as its root and push to `main`.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. The included workflow validates the JSON and deploys the site after every push to `main`.

No API keys, database, build step, or paid hosting are required.
