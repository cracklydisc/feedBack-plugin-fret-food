# Fret Food

A pixel-art chord-change arcade game for [fee[dB]ack](https://github.com/got-feedback).
Cook orders by playing their chord progressions: practise chord shapes, recall and faster changes while keeping a kitchen running.

**Alpha · v0.2.0** — [Download the latest release](https://github.com/cracklydisc/feedBack-plugin-fret-food/releases/latest) · [Changelog](CHANGELOG.md)

![Current gameplay: refreshed customers and cooks, upcoming chords, fingering diagrams and individual cooking timers](docs/service.png)

## Play

- **Play the requested chord** to cook the next step. One chord can advance several orders at once.
- **Change before the pot cools.** Late steps lose quality and tips; an empty pot loses the customer. Three lost customers end a regular service.
- **Read ahead.** Each chalkboard shows the current chord, the next two and a count of further steps. Full barre F is labelled **F BAR**.
- **Build your score** through served dishes, combo and clean cooking. Choose your pace and one to five burners before starting.

## Practice your way

| Mode | What it does |
| --- | --- |
| **Service** | Arcade progression through harder shapes and a busier counter. |
| **Practice** | No strike limit. New shapes arrive in short recipes before competing orders return. |
| **Loop** | One pair, one untimed pan: six changes in each direction, then a report. Uses comparable observations, or starts with C ↔ G. |
| **Sprint** | A three-minute service, unlocked through the host's progression. |

![Current start menu with pace, burners, mode and Guided or Memory assistance](docs/options-plate.png)

**Guided** keeps diagrams visible. **Memory** keeps chord names visible and hides fingerings until you click a board or press **H**. Help stays visible for that target; assistance is fixed once the service starts.

The compact recap shows your results and next practice, with expandable details: directional medians, sample counts, errors, hints and previous-session comparisons. Recommendations require at least **five eligible observations** in a matching context. Initial waits, retries and requested hints do not enter the median. Service timings include choosing between orders and stay separate from isolated exercises.

Only guitar input can score on the host. Memory records are **local and separate** because the current host leaderboard has no assistance categories. Practice, Loop and development inputs do not score on the host.

<details>
<summary>Service closing screen</summary>

![Current service closing screen](docs/service-closed.png)

</details>

## Install

1. Download `fret-food-v0.2.0.zip` from the [release page](https://github.com/cracklydisc/feedBack-plugin-fret-food/releases/latest).
2. Extract its `fret-food` folder into the plugins directory used by your fee[dB]ack installation. The result should be `plugins/fret-food/plugin.json`.
3. Restart fee[dB]ack and open **Fret Food** from Minigames.

Real guitar input requires the **desktop app's native audio engine**. Browser previews use keyboard or scripted input. The plugin needs no bundler or build step.

## Controls

| Control | Action |
| --- | --- |
| Arrows / click | Choose options before play |
| Enter / first chord | Open the kitchen |
| **P** | Pause or resume; losing focus also pauses |
| **H** / click a chalkboard | Reveal current fingerings in Memory |
| **I** | Show input diagnostics |

## Development

Requires Node.js. Clone the repository, then:

```sh
npm test
node tools/serve.mjs
```

Open `http://localhost:8765/tools/anteprima.html` for the scene preview. For keyboard input in the host use `?fretfood_input=keys`; scripted runs use `?fretfood_input=scripted&profile=real&seed=7`.

Run a headless balance check:

```sh
node tools/run.mjs --input bot --profile real --seed 7 --seconds 600
```

For a development checkout, place a link to this repository under your host's `FEEDBACK_PLUGINS_DIR`. Code edits apply on reload; manifest changes require a restart. Keep the versions in `plugin.json`, `package.json` and `src/game.js` aligned.

The repository ships final sprite sheets; raw generations and art tools stay out of Git. The release ZIP contains runtime files and the licence. Tests cover engine behaviour, input handling, learning measurements and UI layout; educational effectiveness still needs playtesting.

## Licence

[AGPL-3.0-or-later](LICENSE).
