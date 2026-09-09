# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-09

### Added

- Explicit Guided/Memory assistance chosen before play, with per-target diagram
  reveal by click or H. Memory records are local and separate from the guided
  hub leaderboard, whose API does not partition by assistance.
- Short pair drills with six changes per direction on one untimed pan.
- Learning reports with directional medians, sample counts, first attempts,
  hint/error exclusions, same-context session comparisons and a five-observation
  minimum for recommendations. Initial waits and interruptions are excluded.
- Short first encounters with new shapes in Practice, using the existing tier
  schedule and delaying competing orders until the introduction finishes.
- Compact end-of-run recap with expandable learning and run details, and
  full-width directional tables suited to the host's narrow results dialog.

- Full upcoming chord names on the existing chalkboards, with two-step previews,
  a separated continuation count and distinct full-barre F labels.
- Refreshed pixel art for 17 seated customers, 18 standing figures and two
  animated line cooks; input-triggered picking poses for the original player.
- Native-pixel kitchen utensils, cookware details and individual place settings.
- Compact parchment orders with larger outlined quality stars; local timer
  urgency, unobstructed heat gauges and stationary stove feedback.

- **Nine shapes for the changes themselves, and a second F.** Cadd9, Gsus4,
  Dsus4, Asus2, Asus4 and G/B — the small movements a hand practises between
  the chords it knows, and the bass step from G to C — join the first two
  tiers beside the shapes they belong to; B and G#m finish the keys of E and A
  up the neck, and the inventor can voice a dish in E now. F has two
  fingerings: the small one stays at the second tier and the whole barre
  (`133211`) arrives at the fourth, written F on the card like the other and
  told apart by its diagram (`SHAPES[key].show`, `label()`: two fingerings
  need two keys, and a key is never printed). Five dishes are written on the
  new shapes, with numerals (`Isus4`, `Iadd9`, `V/3`, `I+`) only the keys
  that own them can voice. The keyboard reaches them on `7 8 9`, `q w r y u`
  and Shift-G, and the card says which.
  - A five-glyph name did not fit a card cut for three: the root is written
    big and the rest small at its shoulder, the way a chord book writes it,
    and a chip too narrow for the name keeps its root. Both fonts grew the
    lowercase `a d s u`, so `Cadd9` is not `CADD9`; the customers' names,
    which the small font used to uppercase by accident, are uppercased on
    purpose now. `docs/chords.svg` prints the frets under every shape.

### Changed

- Clearer kitchen silhouettes: copper saucepan, enamel stockpot, deeper
  skillet and quieter tiles/brickwork. Staff stand behind the main worktop; background
  patrons are shaded without making them transparent. Existing pixel sprites
  and the 480×270 canvas remain in use.
- Customers now use their existing impatient, happy and angry poses while
  waiting, according to the order's state. Urgency is highlighted around the timer.
- Pause freezes visual feedback as well as gameplay; hidden tabs also pause
  the service. Long diagnostic lines wrap inside their panel.
- No changes to recipe generation, scoring, input recognition or balance.

- **The chord is named from the notes that are ringing, not from the shapes
  the counter wants.** Two sessions with a guitar said the same thing: *suono
  lo stesso accordo a ripetizione e sblocco accordi diversi*. The road that
  produced it asks the engine how much of each WANTED shape rang and takes the
  best, so a chord nobody wants can only come back as one of the chords
  somebody does — and an open string, which rings on almost anything played in
  first position, counts as evidence for the shapes that have four of them.
  The engine's polyphonic ML detector (`audio.detectNotes()`, the one
  `notedetect` gates its own chord timing on) reports the pitches actually in
  the air, and `nameFrom` names them against the WHOLE vocabulary by recall
  and precision together: how much of the shape is ringing, and how much of
  the ringing the shape accounts for. C and Am share four of five pitches and
  are told apart by the one that differs. A chord nobody ordered comes back as
  itself and cooks nothing, instead of being pushed onto the nearest ticket.
  All twenty-eight shapes name themselves exactly, one inside another
  included — the small F against the whole barre, G/B against G — and that is
  a test. `scoreChord` stays as the fallback for a build with no ML detector,
  with its ties broken on the fretted strings instead of on whichever chord
  the counter happened to list first.
- **Reading a card is not idling: the silence rule bites later, gentler, and
  never on a fresh ticket.** Past three beats with no strum everything cooled
  at DOUBLE rate, and since the card shows the seconds at the current rate the
  number a player was reading halved at 2.25 s and then fell twice as fast. A
  session reported it as a balance problem — *parto da 15-16 secondi e mi
  trovo a partire un piatto con solo 5* — and the measurement found it exactly:
  on relaxed a fresh pot showed 16.2, 14.2, then 6.9 at two and a half seconds
  and 5.4 at four, which is the time it takes to read a new card and put a hand
  on the neck. Worse, the card was lying: a pot promising 16.2 s really lasted
  9.2. Now the rule bites at five beats instead of three, multiplies by 1.5
  instead of 2, and does not reach a pot the hand has never fed (`st.fed`) —
  a customer who has just sat down is being read, not ignored. The card and the
  customer agree: it says 16.2 and they leave at 16.0. The strip's line drops
  the arithmetic it no longer does.
- **The C, which a session reported as simply not heard.** Not confused with
  another chord: played against a ticket that wanted it, over and over, while
  the rest of the vocabulary was fine. What is different about C is the string
  that is NOT in it — `x32010` mutes the low E, a beginner's thumb damps it
  about as often as not, and a strummed low E is the loudest string there is.
  Precision counted it as a note the shape does not explain, so a clean C came
  back 0.87 and a C with one more thing wrong 0.76, which against a strict ear
  is the difference between cooking and nothing happening. The open sound of a
  string a shape asks you to MUTE is now forgiven — it is that shape's own
  known imperfection. Five shapes are built that way and C is the one a player
  meets first.
- **The chord is scored by the engine's ML scorer when there is one.**
  `scoreChord` has two scorers behind it: with Spotify's Basic Pitch model
  loaded the native side judges each note against the ML detector's active
  pitch set, and without it a constraint scorer over spectral bands that
  `notedetect`'s own README documents as false-positiving on a neighbour's
  energy-band bleed. `bypassMl: true` forces the second, and this game sent
  it on every call — copied from Strum Fighter, which only ever asks about
  one shape. A session with a guitar reported exactly what the band scorer is
  documented to do. `notedetect` sends that flag for SINGLE notes and for its
  verify target, where "the onset-driven ML path silently drops fast notes",
  and sends neither flag for a CHORD, because "the native scorer is ML-backed
  when a model is loaded and it times chords correctly". A chord is what this
  game asks about. With no model loaded there is nothing to choose between
  and the harmonic comb still stands, so that payload is kept for that case.
- **The fallback says it is a fallback, and it got the work.** Three rounds
  of fixes went into the notes road while a session kept reporting a chord
  that would not register — and then the overlay showed `SHAPES`: that build
  has no polyphonic detector at all, so none of it had ever run there. The
  header now says which road and why (`no detectnotes`, `ml off`), and the
  rows show what that road actually had in front of it: the shapes it asked
  the engine about and what each scored, where the notes road shows pitches.
  A fallback that does not announce itself costs more than the feature it
  stands in for.
- **The shapes road asks about the neighbours too.** Scoring only what the
  counter wants can answer nothing but a chord somebody ordered, however
  badly it fits — the flaw the notes road exists to fix, and on a build
  without the detector this is the road that runs. Every shape that shares
  most of its strings with something on the counter is now scored beside it
  (`NEAR_SHAPES`, three each), so a chord that is not on any ticket comes
  back as itself. The set is capped at ten shapes a strum: each is a round
  trip to the engine and the next strum is 375 ms away.
- **More on the menu, and more shapes of drill on it.** A session said it was
  training the same handful of combinations over and over, and the count said
  where: the Opening had **fourteen** tickets between it and eleven distinct
  changes, and a service spends forty-five seconds there. Worse, **eleven of
  those fourteen were the same silhouette** — `X X Y Y` — because the Opening's
  band held every degree for exactly two steps. The chords varied; the drill
  never did, and where the change FALLS is most of what a change drill is. So
  the band holds for one step or two over three or four, which makes `C C G`,
  `C G G` and `C C G G` out of one pair, and ten dishes are invented a tier
  instead of six: the Opening now deals **twenty** tickets, and the whole menu
  goes from seventy-eight dishes to a hundred and sixteen. Ten and not twelve
  because that is where the measurement stops paying — at twelve the Opening
  has more tickets and not one more change in them.
  - **Thirty-seven patterns instead of eighteen**, and the ones that matter
    most were missing entirely: `KEYS` gave most keys an `Isus4`, an `Iadd9`, a
    `Vsus4` and a `V/3`, and **not one pattern used any of them**. Those shapes
    reached a player only through the five dishes written by hand for them.
    They are also the best drills on the neck — one finger moves and the hand
    stays put. Reaching them evenly needed weighting and not just patterns:
    `Iadd9` lives in one key where `I V vi IV` can be written in every key
    there is, so an even draw over patterns is a very uneven draw over shapes.
    Measured over forty seeds, Cadd9 reached an invented dish in 13 of them
    and Gsus4 in 15; weighted, 21 and 26.
  - **The last service was being invented out of one pattern.** Its band wants
    six to eight steps with five to seven changes and holds nothing, so
    nothing shorter than six degrees can land in it — and of the eighteen,
    exactly one could: Canon. Seven long patterns join it, and a pattern that
    cannot reach a band is now dropped from that band's deck instead of
    wasting the roll, which is why the late tiers kept returning fewer dishes
    than they were asked for.
  - **Three dishes written by hand for the shapes that had none.** Gsus4, B and
    G#m were on the neck with nothing on the menu asking for them — a diagram
    nobody is ever sent to play. Dominant Suspense (`C G Gsus4 G`) is the one
    place a sus4 is the point of the bar rather than decoration; Key-of-E Lungo
    and Sharp-Minor Sformato are why B and G#m were added at all.
  - **And no two dishes are the same any more.** Not the same recipe — `Dm Dm
    G G` was Dorian Broth by hand AND Half-Step Ragu invented beside it, two
    tickets that are one exercise, because the inventor deduped within a level
    and not against the menu. Not the same name either: the noun pool is
    picked over before it repeats, but a bigger menu exhausts it, and four
    names in a hundred and sixteen came out identical. And two nouns are gone
    that could not be DRAWN — "Stracciatella" and "Tagliatelle" made a name
    that walked out of its bubble, on the seeds whose draw ran far enough down
    the pool to reach them.
  - **The dealer remembers the last few tickets.** It only ever checked what
    was on the counter right now, so a pot that just went out could come
    straight back with the same recipe on it. The memory is a third of the
    pool and never more than eight — a fixed number would starve the Opening's
    twenty cards and do nothing by Dinner's hundred — and it is a preference
    and never a filter, because a repeat beats dealing nothing.

  The bot's service is unchanged at 388 s against 394 s over twelve seeds:
  this is variety, not difficulty.

- **The ear overlay froze on the first chord it ever named, and said nothing
  about it.** A session with three dishes served and a combo of twelve had a
  plate reading `STRUMS 1 NAMED 0 COOKED 0` and `PLAY SOMETHING`. It was not
  stale data: `src/game.js` imports `label` from the menu — the function that
  turns a shape key into the name on a card — and then declared `let label`
  inside its main function for something else entirely, which input is live.
  Every `label(chord)` in that function threw `label is not a function`.
  All three call sites only run once something has gone RIGHT — the overlay's
  rows need a chord to have been named, the other two need a service to end
  with a slowest change — so while the recognition was poor none was ever
  reached and the bug sat there through every session. The first chord the
  game named cleanly killed the plate, and the `catch (_) {}` around the
  redraw meant it died on the frame BEFORE the one that would have explained
  it. A shadowed import and a swallowed error are not two bugs. The local is
  `inputLabel` now, the redraw says what it could not draw instead of
  swallowing it, and a test of the source — not of behaviour, because no test
  of behaviour was going to find this — holds every file to "a name imported
  into a file is that name for the whole file". It found two more of the same
  trap, in `hud.js` and `scene.js`, neither broken today and both one line
  away from it.

- **The ladder is dealt inside a service somebody actually plays.** A session
  played the counter at three pans and never saw the third: "il terzo
  bruciatore in questa configurazione esce fuori molto tardi, ho giocato almeno
  10-15 minuti e non era ancora uscito". Measured, it arrived at **six
  minutes** — and that session's own runs ended at Happy Hour and Late Dinner,
  levels 5 and 7, so the pan half of the ladder sat past where the game ends
  for the player it is written for. A service is forty-five seconds now instead
  of sixty, which moves everything the level table deals out on the one clock
  it all hangs from: the last tier of shapes goes from 5:00 to **3:45**, the
  third pan from 6:00 to **4:30**, the whole counter from 8:00 to **6:00**. The
  order is untouched — every shape is in the hand before the counter starts to
  grow — and so is the rule that a bell either unlocks a tier or adds a place,
  never both. The cost is worth stating: the bot's service on five pans goes
  from 560 s to 437 s over twelve seeds, because the flames step up a quarter
  sooner too. Shorter in minutes, longer in what it contains. There is a test
  on the arrival times now, so the next hand on `LEVEL_MS` knows what it is
  holding.
- **A chord played badly cooks nothing, instead of cooking with a mark of
  soot.** It used to pass and cost a star, which was the right bargain while
  the ear was the weak link — a muted string the DETECTOR imagined would have
  taken a star that was really earned. With the engine's ML detector armed the
  naming is precise, and the rule a session asked for is the other one: "ora
  che il riconoscimento è preciso direi o passa o no, così devi imparare a
  suonarli puliti". Under `RULES.CLEAN` (0.8, the number that used to cost the
  star) the strum cooks no step, charges no miss and moves no state — not even
  the hand, because a chord that did not come out is not a shape the hand can
  be said to have made. Deliberately not a strike: the ear can be right about
  WHAT was played and wrong about how well, and a drill that takes a life for
  that stops being one; the pot going on draining is the whole of it. Soot is
  now only ever late. The screen says `MUDDY` over the guitar and explains
  itself once, the overlay counts it beside `UNNAMED` — the hand failing next
  to the ear failing — and the closing card carries the same number, because a
  threshold nobody can see from the chair is one nobody can tell you is wrong.

- **F is F, whichever way the hand plays it.** The card prints F for both
  fingerings — that is what `SHAPES['F+'].show` is for — and a player who is
  not a beginner reads F and plays the whole barre `133211`, because it is an
  F. It cooked nothing: `F+` was not on the ticket, so a clean barre came back
  as a chord nobody ordered. Two shapes that PRINT the same name are now
  alternates of each other, and the groups build themselves out of what the
  card prints, so a third fingering added tomorrow with a `show` joins without
  touching any of it. The shapes road scores the alternates beside the wanted
  ones — ahead of the neighbours, so the ten-shape cap cannot drop one — the
  notes road counts them as ordered, and `onTicket` maps what was heard onto
  the pot it answers, once, where both roads pass. Accepting the alternate is
  for a card that cannot tell them apart: when the counter wants BOTH, the
  exact shape wins and each cooks its own pot, because by then the evidence
  really can tell them apart. What the hand is holding is tracked as the shape
  and not as the ticket, so the barre is not read as a change every time the
  counter's F comes and goes.
- **A star, and a pair of brackets.** The ear overlay marks the chords the
  counter wants and prints in brackets the reason a road was not taken, and
  the S font had neither glyph — an unknown one draws as `?`, so
  `SHAPES (ML OFF)` came out `SHAPES ?ML OFF?` and a marked D as `D?`. A
  diagnostic that reads as a question about the thing it is stating.

- **The ML detector was never off: nobody had asked for it.** Three sessions
  of work went into making the band scorer usable because
  `isMlNoteDetection()` answered `false`, and it answered `false` on a machine
  with `resources/models/basic_pitch.onnx` present, matching its published
  SHA-256, `onnxruntime.dll` beside it and the app's own startup log saying
  the model had loaded. Basic Pitch is the most expensive thing in the audio
  engine, so the desktop build loads it and leaves the pipeline **suspended** —
  the default path scores through the harmonic-comb verifier, a tuner left
  open runs no inference, and `isMlNoteDetection()` reports that suspended
  state, not the model's. The ask is `setNoteDetectionEnabled(true)`, and it is
  refcounted across the whole app in `window.__ndShared.mlGateWanters`
  (notedetect's own set) because one consumer disarming must never suspend the
  detector for another still reading it. The game joins that set when the
  service opens and gives its hold back when it closes; it never creates
  `__ndShared`, which notedetect initialises whole and would inherit
  half-built. The overlay now tells the two apart: `ML OFF` is a host with no
  way to be asked, `ML ASKED, STILL OFF` is a host that was asked and said no —
  two problems that read identically before, with different fixes. Any arcade
  plugin scoring chords needs this call; the README says so where a reader
  looking for what to install will find it.

- **The scorer with no model behind it is read on its own terms.** The
  overlay from a session that played cleanly settled the argument with
  numbers: `SHAPES (ML OFF)`, and rows reading `A7 0.40  Em 0.33  G 0.33
  E 0.17`, with nine strums of twenty-two `UNDER THE FLOOR`. Three separate
  faults, all in the band scorer's own arithmetic. It confirms one or two
  strings where the ML-backed scorer confirms most of a chord, so the best a
  clean chord could manage sat under a floor of 0.42 and the kitchen cooked
  nothing: each ear grade now carries a second floor (`dsp`) for the scorer
  with no model behind it. `score` is `hits/total`, so with the SAME two
  strings confirmed A7 makes 0.40 where G makes 0.33 — a ranking of how many
  strings a shape HAS, not of what was played: `bestFit` now ranks on the
  strings actually confirmed, with the ratio, the fretted strings and the
  counter breaking what that leaves level, and never names a shape on fewer
  than two strings whatever ratio they make. `wanted` stays a tie-break and
  never a filter, so a chord nobody ordered still comes back as itself. And
  the overlay showed the four best scores, which are the wrong four when the
  question is whether the chord you played came first — the wanted shapes now
  lead the rows with a `*`, and every row says `2/5` beside its score.
- **The notes' own onsets were tried as a second trigger, and taken back
  out.** Every note carries an `onsetSeq` that goes up when that pitch is
  struck anew, which looked like the answer to a quietly strummed C. It is
  not: one pitch struck anew is one STRING, so a single sweep fired the
  naming several times and a ringing note re-triggering fired it again, each
  one another chance to name something wrong. The session that followed
  reported more false positives and no change on the C. The reasoning is kept
  in the file so nobody spends the afternoon again.
- **The counter breaks a dead heat and nothing wider.** The band was 0.08;
  measured over every shape with a string missing, a stray one ringing or two
  strings gone, that rescues 98.2% against 98.1% for an exact tie — because
  the cases that need rescuing ARE exact ties. A hand that fails to press the
  one string telling Am from A leaves pitches that fit both to the last
  decimal. The tenth of a percent was being paid for with cases where the ear
  had an opinion and the counter overruled it.
- **A chord is not named on less than half of itself.** The fit balances two
  ratios, so a small piece of a chord that happens to be clean scored like a
  whole one that is slightly dirty: the top two notes of an Am are both in a C
  and nothing else was in the air to argue, so they fitted a C at 0.57 and the
  kind ear cooked one. `MIN_RECALL` is the floor — half the shape has to be
  there, whatever the rest of the arithmetic says. Two strings dead out of
  five is 0.6 and still passes, so it costs nothing real.
- **When the pitches cannot separate two shapes, the counter says which.**
  Measuring every shape with a string missing turned up twenty-one ties and
  every single one is the chord's THIRD: Am without its C4 is the pitches of
  an A, Em without its G3 an E, Dm without its F4 a D. None turns on the bass.
  They were being decided by the order the shapes happen to be written in,
  which always picked the same side — every open minor is declared before its
  major, so a hand playing A with a missing third was told it had played Am,
  for ever. Shapes within `TIE_BAND` of the leader are now offered to the
  counter, and only those: 143 of 144 degraded shapes come back right when the
  counter wants them, and all 756 whole shapes still name themselves when it
  wants something else. A weighting by pitch rarity was tried for the same
  problem and dropped — it fixed twenty of the ties and invented a worse one,
  calling an Am with no third an Asus2 by a margin too wide for the counter to
  reach.
- **`I` shows what the ear heard.** The counters — strums, cooked, held, too
  quick, unnamed — and the last four hearings with the pitches that were in
  the air, what they were named and how well they fitted. A drill about which
  chord you played had no way to answer the one question that matters when a
  chord does not cook: was it not heard, or heard as something else. Those two
  have different owners and now they look different.
- **The kitchen cools when the menu changes.** The flames climbed from the
  first bell to the last, so the hardest shapes arrived at the tightest clock
  in the game: measured, a pot lived 12.6 s at the Opening and 3.0 s by
  Closing Time, and the barres were dealt at 4.4 s while C to Am had twelve.
  A session put it plainly — *tendo a perdere prima di aver provato tutti gli
  accordi*. A bell that unlocks a tier of SHAPES now takes the burner back
  down by `TIER_RELIEF` instead of pushing it up, and a bell that opens a
  PLACE climbs as it always did, so the six shape bells run 12.6 → 8.8 s and
  the three pan bells 6.7 → 4.5. A slow hand on two pots lasted four to seven
  minutes and now lasts eight to nine. The wall band in the balance suite
  moves from `ruined > 5` to `> 1`, and says why: it was never a target, it is
  the proof that a service can end.
- **A chip that cannot say the whole chord says so.** The recipe chips are
  eight pixels wide on a long dish and `Cadd9` is five glyphs, so the preview
  printed `C` — the same letter as a different chord, and the hand goes to the
  shape it read before the card arrives. A cut name keeps its root and takes a
  cyan rule under it, in the colour this game paints everything the hand is
  told to do with; the big name on the card is the whole of it. `chipText` is
  pure and every shape in the game is held to it at five chip widths.
- **The repository is the game, not the workshop.** The art pipeline — the
  prompts and the ComfyUI runner, the roll loop, the cut-out chain, the sprite
  viewer, the brief and the recipe — and every generated take are work files
  and stay out of git: the repository carries the sprites the game ships and
  the atlas that places them, and nothing of the seventy megabytes behind
  them.

## [0.1.0] - 2026-09-08

First release. Fret Food is a chain and not a single trattoria, so the
restaurants and the cooks it grows later have somewhere to be. Everything
below was built before anything was published: the *Changed* and *Fixed*
entries are the record of how the build moved on the way to this version,
kept because the reasons are worth more than the diff.

### Added

- The kitchen: every customer orders a dish, a dish is a chord progression, and
  a step cooks with two strums and a beat of silence. At the silence the pot
  has to be above the line, otherwise the rest only warms it.
- One strum heats every pot that wants that chord, which is the game's only
  greedy decision.
- Twenty-two dishes over six levels, from One-Finger Crostini (C, Am) to Canon
  Cannoli (eight steps) and E-Flat Affogato (four barres). Every name carries
  the progression it is made of. Prices are computed from the fingers that move
  between the shapes in the recipe, not written by hand.
- The fingering for the chord each ticket owes, drawn from the real shapes with
  their open strings, muted strings, finger numbers and barres. When two pots
  want the same chord the card says so, which is also the play that pays best.
- Nine kinds of pan and one ingredient per step: cooking a step drops the next
  ingredient in, so a pan shows how far its order has come. Both lists are
  closed sets with a test behind them, because an ingredient nobody drew would
  render as an empty pan and nothing would say so.
- Customers arrive with a name and a face, six of them visible in the queue at
  the door. What they order is decided when they sit down, not before, because
  that choice has to see what is already cooking.
- Stars out of five on every order, which are the soot and nothing else, so the
  rating and the tip can never disagree.
- A combo counter next to the chain, and they are deliberately different: the
  chain is the money multiplier, capped and lost by standing still; the combo
  is the streak, and only a mistake breaks it, so stopping to think is free.
- A far chord change played inside a beat comes out dirty: it leaves soot, soot
  cools the pot faster, and soot costs the tip.
- Burners rise for the whole service, so a two-strum cycle stops being enough
  and a third is needed. What actually ends a service, measured over twelve
  seeded runs, is the round trip: with five pots a lap of the counter takes 5 to
  9 seconds and a hot pot only lives 9. You run out of hands, not of heat.
- Money as score, in dollars: price times chain, plus 25% for a dish cooked
  without a single dirty strum.
- Three input sources on one port, so the engine never knows which is talking:
  the chord detector, the keyboard, and a scripted service that plays itself
  with a real detector's latency, wrong chords and dropped strums.
- `tools/run.mjs`, which runs whole services headless and reports the balance.
- The chord diagram is drawn as VECTOR, on an SVG layer over the canvas in the
  same coordinate system, and rendered at the real resolution of the screen.
  Everything else is pixels because that is what makes it a game; a fingering
  is the instruction, and at three pixels a digit the instruction was a smudge
  — twice made bigger, twice still a smudge. It gained a fret number for shapes
  up the neck and one bar where one finger lies across it.
- A second axis of difficulty: the SHAPES climb the neck, not only the recipes
  get longer. Nineteen chords across six levels — open position, the partial F,
  the sevenths, a first barre at the first fret, full barres, and the same
  barres at the fourth and sixth. A four-chord dish of C Am F G is long; a
  three-chord dish of Bb F C is hard, and the game can now say which. Five new
  dishes ask for them, and a test refuses a dish that asks for a shape from
  above its own level.
- `tools/chordsheet.mjs` writes every shape in the game onto one SVG sheet,
  drawn by the game's own code, grouped by the level it is unlocked at. It is
  the proof sheet for that axis: read down it and the hand climbs.
- The keyboard reaches every shape: Shift gives the other chord of a letter,
  and the two flats take the spare digits. A chord with no key is a test
  failure.
- **It is played with a guitar.** The adapter goes to the desktop build's
  native audio engine — `window.feedBackDesktop.audio.scoreChord()` — which
  scores a chord shape against the live audio with no chart, no playhead and no
  song. The input level gives the strum onset, and on every strum EVERY chord
  the counter is waiting for is scored and the best fit wins: that comparison
  is what makes the engine's fixed hit threshold stop mattering, because the
  question is never "did this pass" but "which of these fits best". The ratio
  of strings that rang becomes the strum's quality, so a half-ringing chord
  leaves soot and costs the tip through the rule that was already there.
  Three earlier roads through the Minigames SDK are dead ends and `detector.js`
  is the map of them; the mistake was assuming the SDK was the only door.
  `?fretfood_ear=easy|medium|hard` loosens or tightens the ear.
- The rest, drawn. Two dots for the two strums waiting to be judged and a bar
  for the silence after them, in the strip between the chain and the combo. The
  rule of this game was the one part of it a player had to count in their head:
  the pots were judged at a moment nothing on the screen mentioned.
- A finished dish is passed up from the pan to the counter instead of appearing
  on the plate. It is the one moment that joins the two halves of the picture.
- Cards come out of the rail when an order arrives and are knocked about when
  their pan is spoiled, so which pot went wrong is something you see rather
  than something you work out.
- The small font grew a lowercase `m`. The recipe on a card is printed in it,
  and `AM DM EM` is not a shorthand for A minor, it is three other chords.

- The cook with the guitar is a DRAWN sprite now, not a coded one. The art
  pipeline was written down and never built, so every sheet ComfyUI had
  produced was sitting in `assets/art/raw/` while the game drew its people in
  code: `tools/art/process.py` is the missing half — it measures the model's
  own block size off the picture's edge energy, floods the background in from
  the border (a colour key takes the cook's red neckerchief with it), and gives
  each block the colour most of it already is. `src/art/atlas.js` existed and
  nothing imported it; the scene reads it now, and anything not drawn is still
  drawn in code.
- **Everybody in the room is drawn art now**, not code: the twelve customers,
  the crowd behind them, the two cooks at the pass, the cook with the guitar,
  the pans, the plated dishes and the house mark. Twenty-one sheets, generated
  and cut out through `tools/art/`, and the procedural versions are still there
  underneath — every sprite falls back to code on its own if its sheet is
  missing, which is what makes half a delivered set a normal state instead of a
  broken game.
- The recipe that produced them, which took five wrong ones to find: **two
  style tags and one dense flowing sentence, no LoRA, cfg 1, no negative
  prompt.** Each clause replaced something that looked reasonable. The style
  block used to be a forty-word technique brief asking for dithering, specular
  and bounce light — a genre tag (`16-bit JRPG sprite`) does better, because it
  pulls a whole learned aesthetic where a technique brief only asks the model
  to imitate a description. With that in front the base model already has the
  craft, so the pixel LoRA coarsens instead of helping — the opposite of what
  was measured against the old prompt, which is what an interaction is. And a
  prompt that stops inviting panels and cast shadows stops needing to negate
  them, so the guidance goes back to cfg 1, which is the point Z-Image Turbo
  was distilled for and where it is cleanest.
- Sprite size is chosen by saying how much of the frame the subject fills,
  because the model draws a roughly fixed number of pixel CELLS per image.
  Measured on one subject: "full body from hat to shoes" gives 153 art pixels,
  "a small sprite with a lot of empty space" 127, "a tiny sprite in a huge
  empty field" 108 — and 108 is the floor, which is why anything smaller than
  that is drawn in a grid.
- The art style stopped asking for dithering, which is what had been making it
  muddy. The style block wanted "many shades, hand placed pixel clusters, heavy
  dithering through the mid tones" plus specular and bounce light — all real
  pixel-art vocabulary, and together they produced noise and a grid of
  inconsistent cell size. It looked like the LoRA's fault; a test that changes
  one thing at a time says otherwise: same subject, same seed, the clean style
  with no LoRA comes back FLAT, and with the LoRA at a third it comes back
  clean and crafted — strings, tuning pegs, fret markers, real tonal steps.
  What replaces the dithering is the thing dithering stands in for, asked for
  directly: three or four tones per surface in hard-edged steps.
- `process.py` takes the FUNDAMENTAL of the pixel grid instead of the strongest
  peak. Autocorrelation peaks at the block size and at every multiple of it, so
  three takes of one subject at one resolution came back with blocks of 17, 8
  and 4 pixels — and the cook that was in the game had been sampled at 12 when
  the grid was 8, which threw away half of him. It was not a small error: the
  same picture is a 39-pixel sprite or a 59-pixel one depending on which peak
  wins.
- The house mark is drawn on a warm amber disc, and that is not decoration. The
  new style asks for a bold dark outline and a deep shadow tone, and the
  emblem's subject is a black cast-iron pan: asked for on its own it came back
  black on black and vanished against the game's own dark plates. It needs a
  light ground to read at all, so it asks for one.
- The house has a mark: a black pan seen from above with a flame in it and a
  guitar neck for a handle, generated the same way and used on the arcade card
  and on the closing screen — which is cut to it, both dimensions, because a
  fixed 220 by 70 box could hold a 40-pixel badge and not a 121-pixel one. The name on the beam sits on an enamel sign, so it
  reads as a restaurant's name rather than as a word somebody forgot to
  translate.
- The counter opens with ONE pan and grows a place every half minute up to what
  the level allows. It opened with three, which is three chords to hold in your
  head in the first ten seconds of a game whose rule nobody has explained. A
  place that is next to open counts itself in on its card.
- A new burner lights cool and comes up with the rest of the kitchen. The old
  spread put the third place a player ever saw at 4.0 against the first one's
  2.4, so its first customer had fourteen seconds where the first had
  twenty-four.

- The report times the CHANGES: from the last chord that cooked something to
  this one, pair by pair, and `slowest` names the three that took longest.
  It is the one number a chord-change drill owes its player, and it is on
  the closing card, in the hub's summary and in `tools/run.mjs`. `cleanSteps`
  beside it, so nobody has to multiply a ratio.
- The scene can `say` something (a title and a line or two, queued, never
  over a banner), has a `setPaused` overlay, `setCoach` and `setClosing`; the strip
  layout takes the coach's sentence; `bubbleLines` cuts a dish's name to its
  bubble. The preview page uses the pause overlay too.
- Tests for all of it: the wait for the first chord; the first two tickets
  and the counter without doubles, on seven seeds; every invented name inside
  its bubble; every coach sentence beside a four-digit combo; a detector that
  never started saying nothing on stop.
- **`src/invent.js`: the menu is invented, and inventing is not generating at
  random.** Twenty-three dishes stay hand-written because they are the ones
  worth writing by hand — Canon Cannoli is Pachelbel, Twelve-Bar Beans is a
  twelve bar blues — and thirty-five more are built around them, six a level,
  out of the same seed as everything else. Four dishes a level meant a player
  saw the same four tickets over and over inside one service.
  - A random walk over the chords a level has taught is not a progression, it
    is a list: `Am Bb Em D7` is playable and means nothing, and this game's
    claim is that the menu teaches while it sells. So a recipe is built from a
    KEY and a PATTERN OF DEGREES — pick a key the level can play, pick
    `I V vi IV` — which is how progressions are actually made. Eight keys, only
    with chords this game has shapes for (F major has no ii, because there is
    no Gm on the neck yet, and it says so instead of substituting something).
  - And a random draw from forty-two ingredients is not a dish: `chocolate,
    ribs, cucumber` is funny once. Eight FAMILIES — a pan, a pool of things
    that belong together, a set of food nouns — and a dish is one family all
    the way through.
  - The gate is three numbers readable off the recipe: how many steps, how many
    of them are CHANGES, and the hardest shape it asks for. `BANDS` is the
    whole difficulty curve in six lines, and its `hold` column is the design:
    two at the opening, so `V I` becomes `G G C C` — four chords and one
    change — and one from the fourth service, where every step is a change. A
    dish outside its band is thrown away and re-rolled, because a gate that
    bends is not a gate.
  - No two dishes on one level share a PROGRESSION. Variety is the chords under
    the hand and not the word on the ticket: the first version of this handed
    back six level-one tickets that were five copies of `C C G G` with
    different food on them.
  - Every invented dish answers to every rule a written one does — a pan the
    kitchen owns, an ingredient per step, numerals that count its steps,
    nothing above its level, a price from its own recipe. That is the only real
    danger in generated content: not that it is bad, but that nobody checks it.
  - `isBarre` in `menu.js` reads a barre off the FINGERING — one finger across
    two strings or more — so a dish is called Barre only when a finger really
    lies across the neck. D is a level four shape with no barre in it, and F is
    a barre that is also the level two lesson, so its dishes are named after
    their progression the way Amen Pomodoro is.
- `tools/art/cut.mjs` — the whole set from raws to sheets in one command, with
  each sheet's cut recorded beside its prompt in `sheets.mjs` instead of in a
  shell history. Anchors are decisions: a customer is anchored at the head
  because the counter hides her waist, the crowd at the feet because they stand
  on a floor.
- `tools/art/process.py --auto` — finds the sprites in a sheet by looking at
  it. A grid in a prompt is a REQUEST: ask for twenty cells and the model lays
  out thirty on a lattice of its own, and a `cols x rows` crop then reads its
  lattice at an angle to the picture and cuts half of one cook against half of
  the next. Connected components, glued when they are within a pixel or two,
  read in reading order.
- `tools/install.mjs` — mirrors the plugin into a fee[dB]ack install, so what
  is played is what is in the editor, to the line.
- A test that refuses a sprite too big for the band it is drawn in. Both size
  failures above were invisible to every test in the suite, because a size that
  agrees with nothing is not a bug in any one file.

### Changed

- **Only the guitar scores, and only the guitar is offered.** The keyboard and
  the scripted player are development inputs: `?fretfood_input=keys` and
  `=scripted` still exist for the preview and the bench, but a run from either
  reports a score of zero to the hub (`SCORE_MULT.input`) and its summary says
  so, the settings page no longer offers the keyboard, and a browser with no
  desktop engine no longer falls back to the keys — the scene says `NO GUITAR
  CAN BE HEARD HERE`, the badge says `NO GUITAR` and the kitchen stays closed.
  A hub that counts dB across its games cannot be handed a service a finger on
  the C key played; on this app detection is a given, and nobody plays without
  an instrument plugged in.
- **The house mark is the skillet with the guitar neck, and the tile is
  square.** The hub's card is `aspect-ratio: 1` with `object-fit: cover`, so
  the 320 by 180 thumbnail was shown cropped at both sides; `assets/thumb.png`
  is 512 square now, the badge inside the central four fifths on the game's
  own dark ground, and it survives any crop or rounded mask the host puts on
  it. The badge — a black cast iron skillet of spaghetti seen from above, its
  handle the fretted neck of a guitar ending in an open-book headstock with
  three tuners a side, FRET FOOD arched on the wooden rim — was generated from
  the prompt in `docs/prompts.md` (section 8, which also says why the tile is
  square). The in-game mark on the closing card is the same badge, cut out by
  hand at 500 pixels to keep the headstock's detail (`assets/art/raw/mark-cut.png`,
  the original tile in `raw/logo-gibson.jpg`) and fitted to 152 by 150 through
  the sheet chain with `--alpha`. The chain gained a `--quantiser` switch on
  the way: median cut splits the colour space where the pixels are, which on a
  badge is the wood and the black, so the tomatoes and the basil came out brown
  at 32, 64 and 96 colours alike; max coverage keeps a colour that is far from
  every other whatever its count, and the mark keeps its red and green at 64.
  And a `--despeckle` pass, because max coverage keeps the noise for the same
  reason it keeps the tomatoes: the hand-cut source is a resampled JPEG with
  no clean pixel grid, and reducing it by a factor that is not a whole number
  gave 1,803 stray pixels of odd colours; a pixel that agrees with none of its
  eight neighbours now takes the colour most of them share, once, and 99 are
  left — the tuning pegs and the grain. The sheets of figures stay on median
  cut with no despeckle, as they were cut.
- **THE OPTIONS PLATE: the pace, the burners and the mode are chosen in the
  game.** They were three rows of grey buttons in the hub's picker, a word on
  each and nothing else, and a tester said both things at once: the settings
  need explaining, and they need to look like this game. The manifest declares
  no modifiers now, and the choice is made on a plate the scene draws over the
  dining room (`options.js`) while the first customer already sits with their
  ticket up. Every value has a sentence under it — what it does to the kitchen
  and what it does to the score — the plate adds the three multipliers up, and
  a sprint not yet earned is greyed with the dB it opens at, readable but not
  takeable. Arrows and Enter, a click on a chip or on START, or the first
  chord, which closes the plate and opens the kitchen in one gesture. The
  choice is kept for next time and the address preselects it.
  - Every change is laid over the engine's rules on the spot (`setRules`,
    allowed until the first chord and refused after) and the counter is dealt
    again under them with the same person seated, so a LOOP has its one dish
    on the card before the kitchen opens. Notices wait for the plate to close.
  - The plate's geometry is pure and tested box by box: nothing overlaps,
    nothing leaves the plate, every sentence is in the S font and stops
    short of START, and every multiplier a sentence quotes is the one
    `scoreOf` charges. The hub reads the manifest at startup: a host that was
    already running shows the old picker rows until it restarts.
- **The plates on sticks: a step cooked steadies the other pots.** With two
  pots or more the round trip is what killed — cook one pot cleanly and the
  others cooled the whole while — and a tester's note said the clock was
  right for one burner and wrong for two. Every step cooked now hands the
  OTHER pots a fifth of a full pot between them (`SPIN_BONUS`, `SPIN_SHARED`):
  two pots get the whole fifth every time, five a twentieth each. Split, not
  handed whole: handed to each pot, five pots got four fifths back per lap and
  the automatic player lost nobody in ten minutes with the strikes off — the
  wall was gone. Split, the same run loses 6 to 13 over twelve seeds instead
  of 28 to 37, the realistic player lasts 500 to 559 s instead of 423 to 475,
  and a slow hand on two pots lasts 4 to 7 minutes instead of 4 to 5. The
  balance band moved from `ruined > 12` to `> 5`, and says why.
- **Every open chord in the first two tiers, and drills between the
  progressions.** Em and D were at the third and fourth tiers with the
  sevenths and the first barre, E and A at the third, so a player who knew
  every open chord met none of them until minute three and every service
  opened on C and G. The six open shapes with two or three fingers are the
  first tier now (C, Am, G, Dm, Em, D), A, E and the partial F the second,
  the sevenths the third, and Roast Reduction (G D Em C) is a tier-2 dish. And
  `inventMenu` deals half as many DRILLS as progressions at every tier: two or
  three shapes of that tier in a random order, named for their changes —
  E-to-A Frittata, D-G-D Skewers — because this is a drill of changes and a
  change does not need a harmony to be worth practising.
- **The hand holds its shape: the chord last named is not the next chord.**
  Play the G a ticket wants and the pot cooked — and so did the C on the
  ticket beside it. The ear asks which of the chords on the counter fits best,
  and once the G has cooked the counter wants C and Am, so the NEXT strum of
  the same G — a player strums a chord several times — was judged against
  those alone, and the nearest wrong shape (Em shares three strings with G,
  Am three with C) cleared the floor. The chord last named now stays in the
  line-up for as long as it takes, and a strum that still fits it best is the
  hand still there, dropped and counted under `stats.ring`; only a chord that
  BEATS it is a change. A first version kept it for 700 ms and a second
  session played slower than that: a hand does not let go of a shape because
  time has passed. And no hand changes shape in a quarter of a second: a
  different chord named within `MIN_CHANGE_MS` (250 ms) of the last strum is
  the ring misjudged, dropped and counted under `stats.quick`, and heard on
  its next strum. The auto ear starts in the MIDDLE grade instead of the
  kindest one, where the answer between two shapes is sharpest; `earFor`
  moves it from there.
- **The cooks at the pass show a face and a chest instead of a hat.** The band
  is thirty rows — the kitchen starts at 134 under the strip and the chord
  cards start at 164 — and a sprite cut to exactly thirty filled it with hat:
  eleven of those rows were the toque, so the pass read as two hats with a
  strip of face under them, wedged against the interface. They are cut four
  rows TALLER than the band now and hung four rows higher, so the same thirty
  visible rows hold the face and the chest, and the top of the hat is cut by
  the strip — the one edge in this scene that can cut a cook without looking
  like a bug, because a hard dark line across a white hat reads as the hat
  continuing behind the interface.
  - Raising them without the extra rows was the obvious move and it is wrong:
    the sprite's bottom rises too and leaves a gap of tiles between the cook
    and the cards he is standing behind. `COOK_LIFT` lives in `geo.js` because
    the sheet's box height and the placement have to agree about it, and the
    band test now says the two things that matter — he reaches the cards, and
    he does not climb out through the interface.

- **THE KITCHEN WAITS FOR THE FIRST CHORD.** It opened the moment the scene
  appeared, and worse: `lastHitAt` starts at minus infinity, so the service
  counted as SILENT from its first tick and every pot cooled at double rate
  before anybody had played a note. Measured with no input at all, in the hub:
  heat 42 at three seconds, the first customer gone and a strike taken at
  seven. A beginner reading their first fingering was being timed for the
  reading. Now the first customer sits down and waits: nothing cools, the
  flames do not climb, the level clock and the next place's clock are not
  running, the card breathes amber and gold and the strip says `PLAY C TO
  OPEN THE KITCHEN`. The first chord opens it (`open()` in the engine, and the
  `open` event), `SERVICE OPEN` crosses the pass, and from there the service
  runs on its own exactly as before. The bar's clock counts from that moment.
  The bench opens the kitchen by hand (`newGame`, `onePot`), because a bench
  measures a kitchen that is running; the wait has a test of its own.
- **The first two customers are the lesson, and no recipe is dealt twice at
  once.** The menu said One-Chord Toast was "the very first thing anybody
  plays" and nothing made it so: the first ticket could be Dorian Broth, whose
  third step is a change, before the screen had shown that a card turns over
  when you play what it says. The first customer now orders a dish with no
  change in it and the second one a dish with a single change. And at the
  second service three customers side by side had all ordered Nightfall
  Minestrone — the echo rule and the gentle rule together kept dealing one
  card — so a recipe already on the counter is out of the deck, with the deck
  itself as the fallback for a menu of one dish. Measured on twelve seeds
  after the rule: clean steps 0.80 to 0.87, level 4 or 5, the shape unchanged;
  the balance test's band moved from 0.80 to 0.78 for the two seeds that sit
  on 0.80 to the third decimal.
- **The strip says things now.** Its middle had been four widgets — a beat
  meter, an instruction that counted, the rule beside a second heat bar for
  the pot in most trouble — and the last of those was the third gauge on the
  screen for a fact every card shows twice. It is a LINE now, on the right
  where the total used to be, and `coachText` in `hud.js` decides what it
  says, most urgent first: that the kitchen is waiting for the first chord;
  `SILENCE - THE POTS COOL TWICE AS FAST`, because the double rate was a rule
  nothing on the screen had ever mentioned; that the window is too small to
  read a fingering in (under 720 CSS pixels); the keyboard's legend, in turn
  with the rule, when the keyboard is what is talking; and otherwise `ONE
  CHORD, ONE STEP`. Every sentence it can say is measured to fit beside a
  four-digit combo, and a test holds it to that. `CHAIN` is called `PRICE`,
  because beside a COMBO that also counts cooked steps it read as the same
  number twice, and it is the multiplier on what the next dish pays. The
  TOTAL moved to the bar's corner, where `THIS LEVEL` used to fall back to $0
  at every bell: one sum of money on the screen, and it only goes up.
- **A pace, chosen in the hub's picker.** The rules were tuned for a hand
  that changes chord in a second or two; the player this game is for takes
  three to five seconds from C to F, and against the normal burner that hand
  lives on `-1 STAR`. Measured with a human-paced player (0.9 to 1.6 s a
  change, 8% wrong chords): level 3 in 134 s with half the steps spoiled.
  `plugin.json` declares a `pace` modifier — relaxed, normal, rush — and
  `PACES` in `engine.js` is what each one is: how fast a pot drains and how
  fast the flames climb, and nothing else, so a score is still a score. The
  picker, which used to be an empty modal with a Start button, now decides
  something. `?fretfood_pace=` is the same knob for the bench and the preview.
- **The closing card is seen, and the summary says something.** `over` used
  to call the hub's `end()` in the same tick, and `end()` hides the stage and
  tears the scene down in the same frame, so the card the scene draws when
  the service closes — the mark, the takings, served and lost, the service
  number — had never once been seen inside the app. The scene is held three
  and a half seconds first (`OVER_HOLD_MS`), the card carries the slowest
  change of the service as one line, and the hub's summary is rewritten: it
  said "Clean cycles 90 (54%)" where the ninety was the total, and "1 (100%)"
  for a run with nothing served. It now says clean steps out of steps, names
  the three changes that took the hand longest, prints the service number
  with the `?seed=` that plays it again, and the pace when it was not normal.
  `.kc-summary` in the stylesheet is its shape.
- **Pause, and a quit that asks.** `P` holds the service under a dimmed
  picture that says how to resume; the window losing focus holds it too; the
  hub's Quit button — which archived the service on the first click — holds it
  and asks, and a second click closes. Before the first chord and after the
  last one a quit is immediate, because there is nothing to hold. The engine
  never hears about any of this: the clock stops feeding it.
- **The keyboard is explained where the player is looking.** The badge in
  the hub's bar (eleven pixels, 65% opacity) was the only sign that a guitar
  was not being heard, and the caret in `^D` was printed as `?` by a font that
  had no caret. When the keyboard is what is talking the scene says so once,
  with the keys, Shift, the digits and `P`, why (a guitar needs the desktop
  build) when a guitar was expected, and which of its keys the app has
  already taken. Both fonts have a `^` now.
- **A coach, in a first service only.** Three notices, each said once and
  remembered in `fretfood.coached`: the first step cooked (keep the bar above
  the white tick); the first step under the line (one star off, the step
  still cooks); the first chord that fed two pots. A quit before the first
  chord does not use them up.
- **The first chord sets the ear.** The guitar's three grades were a URL
  parameter, which is to say nobody's. With the ear on AUTO (the default, and
  the settings page's first choice) the adapter starts with the kindest grade,
  so that the first chord is heard at all on a guitar the game has never met,
  and that chord's score picks the grade for the rest of the service
  (`earFor`: whole gets hard, thin keeps easy) through the adapter's new
  `setEar`. The scene says which ear was chosen and where to pin one instead.
- **A score comparable across the picker's choices.** The score was the
  takings, and with a pace and a number of burners to choose a record made on
  one pot in relaxed beat one made on five in rush. There is no shared board,
  the numbers are the player's own, but a personal best that is beaten by
  choosing an easier service is not a best: `scoreOf` scales the takings by
  what was chosen (relaxed 0.75, rush 1.25; one to five pans 0.5 to 1.0;
  practice and the loop score nothing, the sprint counts as it is) and the
  summary shows the arithmetic when it is not one.
- **A dish is dealt in a key of its own.** Every service opened with C and then
  G, because One-Chord Toast is `I I I I` written in C and the cadence is
  written in C too. A dish is a progression and its name says which one; the
  key is drawn when the dish is dealt (`voice` in `invent.js`), among the keys
  whose chords the tier allows, and the pot pays for the recipe it was actually
  asked, since `price` counts the fingers that move. Two players on one seed
  still get one service. A dish whose degrees no key has (a minor key, a
  secondary dominant) stays as written.
- **Arcade, to lengthen and vary:**
  - **A perfect service.** A level that ends with something served and nobody
    lost pays a quarter of its takings on top (forty dollars at least), and the
    bell's banner says `PERFECT SERVICE +$N` in gold where it said how many
    places were open. Every minute has a goal of its own now, not only the end.
  - **The critic.** From the second service on, now and then and never two at
    once, a customer sits down who orders the hardest dish the counter can ask
    for and pays three times for it; their bubble is edged in gold, the tag
    under their pan says what they pay, and losing them is a strike like any
    other. The coach introduces them the first time. The critic is the hub's
    first unlock (300 dB); the bench has them from the start.
  - **Unlocks.** The manifest declares three, at the dB the hub keeps across
    its games: the critic at 300, the sprint at 1000, the signature menu at
    2500 (nine invented dishes a tier instead of six). The game asks the hub's
    profile which are earned before the service starts, and starts without the
    answer if the hub is slow.
  - **The evening.** The sky in the doorway goes from morning to afternoon to
    dusk to night as the services pass, and from Dinner on the room dims a
    step a service and the lamps over the counter come on. The backdrop is
    painted once with the night; the earlier hours are painted over it.
  - **Modes**, as a third picker: practice never closes and writes the time of
    every change over the card it cooked, green when it beat the line and red
    when it did not; the loop is one dish on one pot for ever, aimed at the
    change the last report said was slowest; the sprint is three minutes from
    the first chord, with the bar counting down. A sprint not yet unlocked is a
    service, and the scene says so.
- **Sound, and why every sound is a knock.** An arcade without sound loses
  half its feedback, but this game is played into a microphone, and a chime is
  a pitched thing the engine would score as a string. `sfx.js` synthesises
  short bursts of filtered noise — a spoon on a pan for a step, the till drawer
  for a dish, a lid dropped for a customer lost, a shaker for the bell, three
  rising knocks for a ticket won back — at a volume well under the guitar's,
  with nothing a harmonic verifier could take for a fundamental. `M` mutes and
  the choice is remembered.
- **The two partials, closed.** Under 720 pixels the recipe chips give way
  and the chord diagram takes their rows, forty-five tall instead of
  thirty-six, because the instruction outranks the progress. And the plugin
  has a settings page (`settings.html`, built by `mountSettings` in
  `game.js` with the kit's controls): the ear (AUTO or a pinned grade), the
  sound, and the keyboard instead of a guitar that is there — the three things
  that are a player's and not a service's. Pace, burners and mode stay in the
  hub's picker, where a per-service choice belongs.
- **Shapes first, then pans; and the pans are a choice.** The second session
  with a player said the alternating table below was still the wrong order:
  this is a chord-change drill, and a third pot before the neck is done teaches
  juggling instead of changes. The whole ladder of shapes is climbed on the
  opening's two pans now, one tier a service (the partial F at Lunch, the
  sevenths at Lunch Rush, the first barre at Afternoon, the full barres at
  Happy Hour, the neck at Dinner), and only then does the counter grow, one
  place a service. The second pan stays because two pots on one chord is the
  one greedy play and a round trip has to exist for the clock to mean
  anything. And the hub's picker has a second modifier, **Burners**, one to
  five: `MAX_STATIONS` caps the counter for the whole service, a closed card
  past the cap says CLOSED and names no level, and the summary says how many
  were in play. `?fretfood_pans=` is the same knob from the address.
- **The pot lives a sixth longer.** `COOL` 4.2 → 3.6 and `GROW_PER_S` 0.008 →
  0.0065: at 4.2 the fourth pot was where a good beginner stopped being able to
  read every card before one went out. Twelve and a half seconds at the
  opening instead of ten, and the climb spread over nine services instead of
  six. `PACES` moved with it (relaxed 2.8, rush 4.6). Measured, twelve seeds,
  perfect ear: services of 437 to 483 seconds, levels 8 and 9, clean steps
  0.87 to 0.94; the realistic ear 421 to 481 seconds, clean 0.86 to 0.93. With
  strikes off the same player reaches level 10 and loses 27 where it lost 86.
- **A lost customer can be won back.** Three strikes closed the service and
  the count only ever went up, so a service was as long as its three worst
  moments. `REDEEM_TIPS` (eight) dishes served CLEAN in a row — with the tip,
  not a star lost on any of them — bring one lost customer back: the engine
  emits `redeem`, the ticket lights up again on the bar, `TICKET WON BACK`
  goes up from it, and while somebody is lost the strip counts the run down
  (`5 CLEAN DISHES WIN A TICKET BACK`). A dish that lost a star breaks the
  run, and so does losing somebody else; with nobody lost nothing is counted.
  The coach says it once, the first time it happens.
- **A level unlocks a shape tier or adds a place, never both.** The shapes a
  dish may ask for come in six tiers, and the tier used to be the level
  number itself: every bell that opened a new pan also unlocked new shapes,
  so the first barre of a player's life arrived at Afternoon together with a
  fourth pot — and with four pots the round trip is already what ends a
  service. The first time you met a hard recipe you were too busy to read it.
  `LEVELS` has a `shapes` column now and the two axes take turns down the
  table: Lunch unlocks the partial F with the opening's two pans, Lunch Rush
  adds the third pan with shapes the hand already has, Afternoon brings the
  sevenths to three pans, Happy Hour the fourth pan, Dinner the first barre,
  Late Dinner the fifth pan, Saturday Night the full barres and Closing Time
  the neck. Nine services instead of six, a minute each, the flames climbing
  by smaller steps because there are more of them. The engine deals and
  weights dishes by the tier (`shapesAt`), keeps a gentle dish on the counter
  through the third tier, and the bench's one-line levels still work with no
  column at all. Measured on twelve seeds with the perfect ear: services of
  290 to 365 seconds where they were 220 to 290, levels 5 to 7 of 9, clean
  steps 0.77 to 0.87 with the lowest on the longest runs, which is the shape
  wanted; the balance band moved from 0.78 to 0.75 to say so. A test holds
  the table to the rule.
- **Money is gold, and only money.** Amber is the frame's colour and the
  labels', and the sums of money on the screen were written in it too, or in
  white: the TOTAL in the corner, the price on the tag, the takings on the
  closing card. They are all gold now, the same gold the `+$` floats and the
  tip already had, so one colour means "what gets paid" wherever it appears.
  Not green: green is what a clean step and a full heat bar already mean in
  this picture, and money in green would have made the bar look like cash.
- **The tag under the pan says what the dish PAYS NOW.** It printed the list
  price, a number the till never paid out: a dish goes out at the price times
  the multiplier, plus the tip while the pot is clean. `worth` in the snapshot
  is that sum, so the tag falls when a star is lost and climbs with the chain,
  and the number a player reads when choosing which pot to save is the number
  that arrives. The list price stays in the snapshot for the bench.
- **The stove is a stove.** The cooktop had three flat ovals per place on plain
  steel. A burner seen front on is a drip well, a cast-iron grate in it with a
  lit top edge, and the grate's five fingers where the pan lands; the steel is
  brushed with faint strokes; the front has a chrome lip and a toe-kick; the
  knobs are round with a pointer and a catch of light instead of a square
  with a notch. The flame's tongues have dark tips, which is what stops a
  drawn fire from reading as a flat orange comb. And every vessel has an ink
  foot and a shaded bottom row, and its inside darkens towards the middle, so
  a pan sits ON the grate and reads as a hole rather than a disc.
- **A pass over the picture with a loupe**, every panel blown up to twelve
  pixels a pixel, and what it found:
  - The sign over the door was an empty enamel plate. It says `CLOSED` until
    the first chord, `OPEN` while the service runs and `CLOSED` again when it
    is over — the same fact the strip states, told the way a restaurant tells
    it, readable from across the room.
  - The waiting card said `11 SEC` in grey, which read as a clock that had
    stopped. It says `PLAY`, with `TO OPEN` under it, breathing with its
    border, so the card explains itself without the strip. At single size:
    the left column is thirty-four pixels and the word at double size was
    forty-six, and the diagram's board took the Y off it.
  - `COOKED` and `-1 STAR` rose from under the card up through the heat bar,
    and spent the middle of their life green on green. They start over the
    pan now and stop where the card begins.
  - The small `x2` beside the chord said what the `2 POTS` row under it said,
    an inch apart, and read as two facts. Gone.
  - The keyboard hint for a three-letter chord (`^F` beside `F#m`) landed on
    the chord's last letter. It moves under the chord, at the right end of the
    `2 POTS` row, when the chord is too wide to leave it room.
  - A level bell ringing while a notice was up put the two plates on top of
    each other. The notice holds its clock until the banner has gone.
- The customer's bubble wraps by MEASURED WIDTH (`wrapPx` in `font.js`),
  and in the small font when a name will not go in two lines of the big one.
  `wrap()` counted twelve characters and glued the tail back onto the last
  line, so "Shadow Sorbetto in Minor" came out as `SHADOW` over `SORBETTO IN
  MINOR` — a hundred and one pixels on a line with room for seventy-four,
  walking out of the bubble and across the next customer. A test now tries
  every name the menu can invent on several seeds.
- The tagline and the description in `plugin.json` said "two strums, then let
  it rest": the only text a player read before playing described a rule that
  no longer existed. They say the current one.
- **ONE CHORD HEARD IS ONE STEP COOKED**, and the reason is the microphone.
  This is the rule the game will keep, and it replaced two that could not
  survive a guitar being pointed at them.
  - Counting strums is not a measurement this input can make. The onset
    detector re-arms after 180 ms whether the sound has died back or not, and
    it has to — the gate that waits for it to die was throwing away the second
    strum of every pair — so one slow sweep across six strings fires again at
    180, 360 and 540 ms. The first player to meet a four-strum bar reported
    that a single long strum filled it. That is not a bug to be fixed: it is
    the shape of the information, and anything built on a count of strums is
    built on a number the ear invents.
  - What the ear DOES know is which chord is sounding — `scoreChord`, a state
    rather than an event, and reliable. So the whole game stands on it. Play
    what the ticket wants and the step cooks, at once, and the card turns over.
    The rhythm is not counted at all now; it is TIMED.
  - The pot is the clock, and one bar answers all three questions a player
    has: a cooked step fills it, above the line the next step comes out clean,
    under the line it cooks and spoils, at zero the customer leaves. The line
    sits high (80 of 100) because the ratio between "time to do it well" and
    "time before they go" is set by how far down the bar it is: 2.4 seconds
    inside a 10 second life at the opening, 0.7 inside 3 by the fifth service.
  - `FINGER_GRACE` is what makes it fair: a change is given more room for
    every finger that has to move, so C to F gets 4 seconds where C to Am gets
    2.4. A drill that paid the same for both would be measuring the fingering
    and not the hand.
  - The rush rule is gone, and inverted. A far change played fast used to come
    out dirty; it is now exactly what the game asks for, and it pays. What the
    rush rule was standing in for — a fumbled shape — the ear measures
    directly: a chord that comes back with a poor score cooks and spoils.
  - Measured: 225 dishes a service where the old rule managed 40, level 5 with
    a realistic ear, and 88% of steps beating the clock. The old rule's number
    for the same question was 80% of *correct gestures doing anything at all*.
  - The bot models a HAND now — 260 ms for any change plus 90 per finger that
    moves — because a bot that answered instantly would measure a game nobody
    can play. It is the same quantity `FINGER_GRACE` pays out on the other
    side.
  - **A recipe may repeat a chord**, which is how the easy dishes are easy and
    was impossible under every earlier rule. `C C Am Am` is four steps and one
    change: hold it, play it twice, change, play that twice — which is the
    shape the four-strum bar was reaching for, arrived at from the side the
    microphone can measure. The opening service is now One-Chord Toast (`C C C
    C`), Cadence Bruschetta (`G G C C`) and their neighbours, and by the fourth
    service every step is a change. The whole difficulty curve is in the menu,
    where it can be read.
  - A repeat needs `STEP_GAP_MS` to exist at all: where the chord CHANGES the
    ear's phantom onsets land on a chord nobody wants and are harmless, and
    where it repeats every one of them cooks a real step — measured, one sweep
    cooked four steps of `C C C C C`. Six hundred milliseconds is past the
    three phantoms a slow sweep can make and is one strum a beat at a hundred
    to the minute, so a repeated step asks to be played IN TIME rather than
    filled with noise. It is a floor on the REPEAT and not on cooking: a change
    is unthrottled, because a phantom of the chord just played cannot cook a
    step that wants a different one.
  - A repeat is also cheap by arithmetic rather than by decision: `price` pays
    three for a step and two for every finger that moves, and a chord repeated
    moves nothing. A dish of repeats is worth about half a dish of changes,
    which is what an easy dish should be worth. `hits` is gone from the menu
    with the rule that read it.
  - The strip says the rule and never stops saying it: `ONE CHORD, ONE STEP`,
    with the pot in most trouble as a bar beside it. The card's row of pips is
    gone with the count it drew, and the row went to the one fact a player
    cannot get from the card in front of them: `2 POTS` — this chord is wanted
    somewhere else too, and one strum cooks both.
- **A step is a BAR the dish writes, and playing it always cooks.** The two
  halves of that sentence replace the two rules the game could not be played
  with.
  - The count is now a property of the DISH, one number per step, so a recipe
    is a chord chart: `4 x C then 4 x Am` at the opening, `2 x C, 2 x G, 3 x
    Am` on something that costs more, `4 x A7, 4 x D7, 2 x A7 ...` on the
    twelve-bar dishes, which is what they were named after. The difficulty is
    the menu now rather than a formula, and it runs the way a guitarist
    actually learns: long bars and one change while you are still finding the
    shapes, short bars and seven changes when changing is the thing you are
    good at. It is also the exercise every teacher sets — four to the bar on C,
    then Am, then back.
  - And the heat stopped being a gate. It was `the bar AND above the line`, and
    measured against the bot with a realistic ear that refused ONE IN FIVE
    completed gestures: the player played the bar, let it rest, and nothing
    happened because the pot was a few degrees under a line whose meaning no
    gauge could explain. A rule you can follow exactly and still fail silently
    is not a difficulty, it is a bug with a meter beside it. Now the bar always
    advances the recipe and the heat says what the step is WORTH — under the
    line it cooks and spoils, which costs a star, the tip, and cools the pot
    faster from there. A dish can be finished badly all the way to the counter
    and be worth almost nothing, and the only thing that takes a customer away
    is their own clock.
  - Measured after: with a perfect ear the completed gesture works 98-100% of
    the time (it was 80%) and the tip falls to 0.77-0.85 as the burners rise;
    with the real ear, level 5 on every seed, 37-49 served, tip 0.71. The
    difficulty moved from "did that count" to "how well did that go", which is
    the same difficulty in a place the player can see.
  - One pip per strum on the card, so the row IS the rule: play until they are
    all lit, then stop. Its geometry is in `hud.js` with the rest of the
    layout, and the pitch is divided out of the room the diagram leaves rather
    than written by eye — a `needs > 3 ? 5 : 7` fitted the bars the menu asks
    for today and walked under the diagram at seven pips.
  - The prices are taken from the STRUMS and not the steps: the same three
    chords over four-strum bars is more work than over two, and a menu where
    those cost the same is a menu that lies about what it is asking for.
- **A pot keeps the strums it was given, so two strums cook a step at any
  speed.** This is the one the game was unplayable without, and it took a real
  guitar to find. The card says two strums and then a beat of silence, and says
  nothing about how close together the two strums have to be — but a rest wiped
  the count for everybody, so the pair had to land inside ONE BEAT. Measured:
  749 ms apart cooks, 750 never does, at any burner, for ever, with the heat
  climbing to 82 and sitting there while the chord never changes. Three
  quarters of a second is quick when you are also reading a fingering and
  moving your hand, and nothing on the screen mentioned a clock. The player who
  hit it asked what rhythm they were supposed to use and whether strumming
  harder would help; there was no rhythm to find. Now the rule is what it says.
- The rest's warm is paid to a pot that has DONE the gesture and is short of
  heat, not to one in the middle of a slow pair — otherwise, sixteen degrees
  being more than a beat of the burner takes, playing slowly came out hotter
  than playing in time, and a rhythm game with no reason to play in time is a
  chord chart with a stopwatch. Slow now works and costs heat: at the opening
  burner a pair can be two and a half seconds apart, by the fourth service
  about one, and in a late kitchen only a tight pair holds the line.
- The beat meter in the strip is an INSTRUCTION and no longer a label. It said
  `REST` beside a meter, with the full rule shown once until the first dish was
  cooked; naming a meter is not telling anybody what to do with it, and after
  the first dish the screen went back to naming its parts. It now says
  `STRUM x2`, then `ONE MORE`, then `NOW REST`, in the present tense, for ever.
  All three are eight characters wide so nothing shifts under the player's
  hands.
- The pans stay procedural, and that is a PROJECTION and not a quality: the
  drawn ones are seen from three quarters above, and this kitchen is drawn
  front on — cooktop, stove front, pass and cards are all flat elevations, and
  a rim drawn as an ellipse sits in that like a photograph pasted into a
  diagram. It is the one thing every other generated sheet got away with,
  because a person seen front on is a flat elevation too. The sheet is cut,
  measured, wired and one line away in `DRAWN`.
- **Everybody on the screen is drawn art now, and every one of them fits the
  band it is drawn in.** Three sprites were the wrong SIZE rather than the
  wrong picture, which is a failure no drawing skill prevents:
  - The two cooks at the pass came back as whole standing figures, fifty-six
    and forty-four pixels tall, for a band that is thirty rows deep — so they
    reached up through the chain and combo strip and stood with their hats over
    the score. They are drawn as head and chest now, twenty of them in a grid,
    hung from the top of the kitchen with the chord cards hiding everything
    below the rail.
  - The player came back seventy-six wide for a column that is sixty-one, so
    the cut took eight columns off each side of him: the tuning pegs, the lower
    bout of the guitar and the flat top of his toque. He is posed for the
    column now — the guitar held upright against his chest instead of slung
    across it — and arrives at sixty-one by one hundred and twenty, complete.
  - The pans came back forty-four tall for a thirty-two row band, and two of
    the nine had domed LIDS, which is the same lie as painted-in food: a pan
    here is a container the player watches fill up. Regenerated open — and then
    regenerated seven more times, because the ONE thing the prompt does not
    control is scale: the same words at the same settings gave pans 6, 12, 18,
    31, 44 and 57 pixels tall depending on the seed. The first set that fitted
    was half the size of the coded pans, and the fire, the lit ring, the food
    surface and the steam are four drawings tuned together against a vessel
    twenty to thirty tall, so all four went wrong at once. Scaling them down to
    match was tried and reverted — a stove where nothing is broken and nothing
    has any weight — and a take was measured into the band instead. A test now
    holds a drawn pan to a floor as well as a ceiling.
- The chord diagram gave up four rows at the bottom. It was forty tall from
  `CARD_Y + 13`, which put it over the heat bar and the white tick of the line
  the pot has to clear — the one gauge a player watches while a pan comes up to
  temperature, hidden by the diagram of the chord that heats it.
- The seconds on a card no longer blink by NOT BEING DRAWN. Under three seconds
  that took the clock off the card for half of the only moment it matters; it
  changes colour instead.
- A dish gets eaten. The plate lands, the food comes off it a piece at a time
  over a beat, and the customer is in the chair for all of it — the seat used
  to empty five hundred milliseconds after the dish left the pan, while the
  food was still in the air.
- The crowd in the dining room is opaque. It was drawn at 0.55 for the back row
  and 0.85 for the front, and behind a brick wall that is not depth, it is
  people made of glass.
- Nothing is cut by an edge nobody can see any more: the queue is clipped to
  the doorway it stands in (it used to run fourteen pixels off the right of the
  screen), the card row is clipped to the kitchen (a card arriving slid down
  through the interface), and the room's clip reaches the last standing spot
  instead of stopping three pixels short of it.

- A drawn sprite is placed by **where its subject is inside its frame**, not by
  the middle of the frame, and the atlas measures that off the sheet's own
  pixels. A frame is a rectangle in a grid, which is all a person needs — feet
  on the bottom row, centred left to right. Half the pans have a HANDLE
  sticking out of one side, so the middle of the rectangle is three to five
  pixels from the middle of the vessel and the fire, drawn centred on the
  burner, came out under the handle; the rectangle is up to a third wider than
  the vessel, so the flame licked past a pan it was meant to be under; and
  because every cell is as tall as the tallest sprite in its sheet, a
  twenty-pixel roasting tray in a cell of thirty-one was getting a stockpot's
  flame. One missing fact, three symptoms. It could have been written down —
  nine pans, three numbers each — and then it would be twenty-seven numbers to
  re-measure by hand every time a sheet is regenerated. The sheet already knows:
  a body is the run of columns nearly as tall as the tallest, because a handle
  is thin and a pan is not.
- Eight of the nine pans are drawn and the pizza stone is not. The dough is the
  only ingredient drawn as a disc covering the whole surface, the drawn stone
  hangs its peel below the disc, and a surface taken as a fraction of that
  sprite puts the dough in the air above the stone. The coded stone is built
  around that dough, so it keeps the job.
- **The art is a hybrid, and the mix is a decision rather than a side effect of
  which files are on disk.** `DRAWN` in `src/art/atlas.js` names the sheets the
  game draws from and says why each one that is off is off. The rule it
  encodes: a drawn sprite has to be better than the coded one AND fit the band
  it goes in. Code loses badly at faces, hands and cloth, so every person in
  the room is drawn. Code wins at whatever the GAME has to say about an object
  over time — a pan that fills one ingredient per step, darkens with soot, sits
  in a flame whose height is the burner and steams when it is ready — and wins
  again below the model's floor, which is where the shelf clutter and the
  plated dishes live. So the props and the dishes stay procedural: 21 to 30 art
  pixels for shelves that are 8 rows deep, and 65 to 114 for a plate that is
  22.

- **Every service is dealt fresh.** The seed read `Number(q.get('seed') || 7)
  || 7`, so without a seed in the URL every session was seed 7: the same
  customers with the same names and faces arriving in the same order, ordering
  the same dishes — and, because the invented half of the menu comes out of the
  same seed, the same thirty-five invented dishes as well. The second service a
  player ever played was a repeat of the first, and nothing on the screen said
  why. That default was right for the bench and wrong for the game. `?seed=`
  still pins a service exactly, and the closing card now prints the number, so
  one worth playing again can be.

### Fixed

- The flame no longer eats the pan. It was drawn wider and taller than the pan
  it was under, so at a high burner the whole station went orange and what was
  on the fire — the one thing the stove is there to show — could not be seen.
  It is inside the pan's width and under its rim now, and how hard the gas is
  going is read off the gauge and the ring, neither of which can hide anything.
- A pot that joined a run of strums could cook a step off a single one. Every
  pot was stamped with the HAND's consecutive-strum count instead of counting
  the strums it received, so one that walked in halfway inherited credit for
  strums it never got: seated at 58, given one strum landing as the hand's
  second, it went above the line with a cycle of 2 and cooked. Whether it did
  depended on the burner and on when it arrived — an arithmetic accident,
  against a rule the game states everywhere. Every pot counts its own now, and
  reads the heat curve at its own place in it, so all of them earn their steps
  the same way whenever they sat down. The balance did not move: measured over
  eight seeds the run length went from 255-315 s to 263-308 s, which is the
  windfall leaving without the game getting harder.
- The second strum of every cycle was being thrown away. The onset gate went
  shut on a strum and only re-opened when the input level fell back to within a
  whisker of the background — which, on a chord decaying over a second or more,
  is long after the second strum has come and gone. So the rest was judged on
  one strum, one strum never reaches the line, and almost nothing cooked. From
  the player's chair that is "it takes it now and then and mostly not", which
  is exactly what came back from the first session with a guitar. The gate
  times out now; what stops a ring-out re-triggering is the slope test, because
  a decay falls and falling is not a strum.
- A strum the ear cannot name is dropped instead of reported as a strum of no
  chord. `chord: null` makes the engine file a miss, and three in a row cost
  the chain: right for a keyboard, where the key pressed is a fact, and wrong
  for an ear, where an unnameable strum is evidence that WE did not hear it.
  The pot not heating is punishment enough for a wrong chord. It is counted, so
  `unknown` climbing while `named` does not still names the fault.
- The rule is on the card. Two dots for the two strums the pot wants and a bar
  for the silence after them, in the row the compact fingering used to have —
  that text said the same thing as the diagram two pixels to its right, and
  between a second copy of the fingering and the only place the rule is
  visible, the rule wins. The strip spells it out in words — STRUM x2 THEN REST
  — until the first step cooks, and then gets out of the way: a tutorial that
  dismisses itself on success needs nobody to be told they have understood.
- Nothing on the screen sits on the edge of the box it lives in. Three of them
  did: the takings on their plate's own bottom frame (the row positions were
  written out per panel, and `[3, 10]` put a seven pixel number at row 12 of an
  eighteen pixel plate), the second line of every two-line dish on the speech
  bubble's outline (the height was a fixed 25 and the line was printed at 18),
  and the chord diagram two pixels INTO the recipe chips, where its opaque
  board cut the bottoms off the chord names and covered two chips outright. All
  three are now derived rather than placed — the rows are distributed inside
  the plate, the bubble is cut to its number of lines, the diagram starts below
  the chips — and a test for each refuses the old numbers.
- The key that plays a chord is printed on its card when the keyboard is what
  is talking. Nineteen shapes across letters, capitals and digits is not
  something anybody holds in their head, and the guitar path is blocked by the
  host, so the keyboard is how the game is played today.
- A fault in the drawing or in a game step no longer stops the clock. `raf` was
  the last statement in the loop, so anything that threw took the whole service
  with it: the scene kept animating off its own timer while the game stood
  still, with nothing in the console to say why. The loop re-arms first and
  reports the fault once, with its stack, then counts it.
- Plates in the top bar are cut to what is written on them. The width of the
  service plate was the number 66, sized by eye for `SERVED 9`, and every run
  past nine customers printed the count off the end of it onto the wood.
- The picture is blown up onto the screen by a whole number now, and the browser
  fits that image to the box. A canvas sized to exactly fill its box makes
  pixels of two different sizes, which takes a third of the weight off a letter
  three pixels wide, and below 1 it deletes whole rows of them.
- The scene draws on a whole number of the panel's frames, chosen to land as
  near sixty as that panel allows. It drew thirty; a gate that asked for 16.7 ms
  between frames would have made it 48 on a 144 Hz screen, because two frames
  there are 13.9 ms and three are 20.8.
- The snapshot reaches the scene once per frame rather than twenty times a
  second, so the heat bar no longer climbs in steps while everything around it
  moves smoothly.
- Cards no longer judder for the first half second of a game that was mounted
  quickly: the instant that means "never" was written as zero, and
  `performance.now()` starts at zero too.

- **The hand-drawn player was being DECODED when it should have been FITTED**,
  and the difference is visible from across the room: the shipped sprite had
  pink specks on the hat and the guitar body, a neck that broke up into
  fragments and a headstock that was a smear.
  - Everything else in `assets/art/` is pixel art rendered large — a grid of
    flat cells — and `shrink` decodes it by taking the mode of each block. A
    hand-drawn asset has no grid, and that is measurable rather than a matter
    of opinion: the share of its colour edges landing on a lattice of N is
    exactly 1/N, which is what chance gives. 35% at cell 3, 27% at 4, 13% at 9.
    Decoded anyway, blocks straddle two shapes and whichever half wins the vote
    becomes the pixel — and leftovers of the asset's old magenta background
    survive as the winning vote of a block, which is where the pink came from.
  - `--fit WxH` is the operation such a source actually wants: an area average,
    which uses every source pixel instead of one vote per block, then a
    quantise to a small palette, which puts back the hard edges the average
    necessarily softens. Same 60 by 104, and the guitar has frets and tuning
    pegs in it.
  - `lattice()` measures whether a source has a grid at all, so a block decode
    on a grid-less picture says so instead of quietly producing mush.
  - And a bigger buffer would not have helped, which is the thing that made
    this confusing: the asset carries more detail than 60 by 104, but the
    scene's whole picture is 480x270 game pixels and the player has a 61 pixel
    column. What was wrong was the reduction, not the size.

- **The picture is pixel-hard on a retina panel now, and the cap was the reason
  it was not.** The chain is: the scene draws a 480x270 buffer, the buffer is
  blown up by a WHOLE number with nearest-neighbour, and the browser fits that
  image into the box. The whole number was capped at FOUR — and a retina panel
  showing the game 1200 CSS pixels wide wants five device pixels per game
  pixel, 1440 wants six, a 4K one wants eight. Above the cap the browser was
  UPSCALING our own picture with filtering to reach the display, which is the
  worst of both: no more detail and softer edges. Measured across the fourteen
  sizes the game is played at, five of the soft cases were the cap and nothing
  else. The cap is eight now, the buffer hits the whole number exactly when the
  display asks for one, and the cost between x4 and x8 measured at 0.09 ms a
  frame — the blit is not what a frame is spent on.
  - What CANNOT be fixed this way, and it is worth writing down because it
    looks like the same problem: a box that is a fractional multiple of 480. At
    900 CSS pixels on a plain screen every game pixel wants 1.874 device
    pixels, and no buffer size makes that whole. The only cure is letterboxing
    to the largest whole multiple, which at that width means showing the game
    480 wide inside a 900 box — 47% of the picture given up for hard edges. The
    softness is the better trade and it stays.
  - So a host that wants guaranteed hard pixels gives the panel a width that is
    a multiple of 480 — 960 or 1440 CSS pixels — and the code now lands on it
    exactly.
- **And the picture never re-fitted when its box changed.** The resize was a
  `ResizeObserver` with a window listener as the fallback if the CONSTRUCTOR
  threw, which covers a browser that has no observer and not the case that
  actually happens: an observer that exists, accepts `observe()`, and never
  calls back. Measured in one such engine, a fresh observer fired zero times
  while the container went from 900 pixels to 1085 — so the canvas kept the
  size it was born at for the whole session, getting softer as the window moved
  away from it, with nothing on screen to say so. Both are registered now.

- **The fallback to the keyboard ran a recursion, and one key pressed was
  2,264 strums.** When the detector cannot start it says `ready: false`; the
  glue answers by stopping it and switching to the keyboard; and `stop()`
  answered with ANOTHER `ready: false` — "guitar unplugged", from a guitar
  that was never heard — which landed back in the glue, which stopped it
  again. The recursion ran until the stack gave out and every turn of it left
  a keyboard adapter, with its own `keydown` listener, on `document`. Every
  right key fired thousands of times (saved only by `STEP_GAP_MS`); every
  wrong key was thousands of misses in one press, and the chain was gone.
  Two guards: the adapter only says "unplugged" if it was ever "ready", and
  the glue falls back once whatever it is told. A test counts the answers.
- **A cooked step is marked again.** The scene listened for a `ring` event
  the engine stopped emitting when the rest went, so the green flash, the
  word COOKED, the lifted chip and the customer's delight were all dead code:
  a card turned over with nothing to say it had. They hang off `cycle` now,
  which carries `late` — the pots that cooked under the line — so those get
  `-1 STAR` in red where the star was lost instead of a missing one in the
  bubble.
- A closed card the level already allowed still named the level that would
  open it, so on Saturday Night the third place said `OPENS AT LATE DINNER`.
  Every place the level allows now says WHEN it opens, one `OPEN_MS` after the
  one before it; only a place the level does not yet allow names a level.
- The drop of sweat on an angry customer hung in the air a good ten pixels
  to the right of their head. It was placed four pixels in from the edge of
  the sprite's CELL, and the drawn customers share a sheet whose cells are as
  wide as the widest figure on it, so a slim customer had air on both sides.
  The drawing hands back the atlas's measured body with the box now, and the
  drop falls off the temple.
- The closed card's `OPENS IN` count ran before the first chord and reached
  `0 SEC` while the player was still reading the first fingering — a place
  that opened itself, as far as the screen could tell. `nextPlaceAt` is
  re-based when the kitchen opens but `t` runs from the mount, and the
  snapshot subtracted one from the other. It holds at the full wait until the
  kitchen opens, and the test of the wait says so.
- The level banner's third row, `2 PLACES OPEN`, sat half under the plate's
  own frame: thirty-four rows for text printed at twenty-eight in a font five
  tall. Thirty-eight.
- `tools/run.mjs` printed "395 of undefined rests": the rests are gone. It
  prints steps cooked, clean steps and the slowest changes.
- **The player is drawn and cut out by hand now** (`assets/art/Firefly.png`),
  and the pipeline's job on it is only to decode. Two things had to be taught:
  - `--alpha`: the mask came in with the file, so the flood must not be asked
    to find it again. `background` reads the colour of the border and walks
    inwards from it, and on a transparent PNG that colour is black — the flood
    would set off through the cook's own outlines and boots and take them with
    it.
  - and the CELL SIZE is nine, measured off a dark outline in the source that
    runs exactly nine pixels wide. A first attempt at seven read the same
    drawing as 73 by 128 instead of 57 by 99, which looks like a richer sprite
    and is a misreading of the grid with some cells counted twice. Fifty-seven
    is also what fits: the column left of the screen is sixty-one wide, so the
    right decode and the layout agreed without either of them moving.
- **`--fringe 0` did not mean off.** Zero went through as a THRESHOLD of zero,
  and a threshold of zero clears every pixel that leads at all in the ground's
  dominant channel. On an asset whose ground is taken as black — dominant
  channel red — it deleted every warm pixel in the picture: the cook came out
  as a white hat and a pair of trousers, and the first guess was that the
  hand-drawn asset had no pixel grid in it.
- **The scene was throwing on every frame** and had been since the notice
  plate was added: `notice` was a variable holding the notice being shown, and
  a function that queues one, declared in the same scope. `Identifier 'notice'
  has already been declared` takes the whole module down, so nothing rendered
  at all. The queue is `say` now.
- **The room was full of headless torsos and floating legs**, and the cause was
  a lattice: the crowd's prompt asks for twelve in a 4x3 and the model laid out
  sixteen in a 4x4, so every cell of the crop held the legs of one patron and
  the hair of the one below. `--auto` finds the sprites by looking, which is
  what that flag is for, and it should have been on this sheet from the day it
  existed.
- **A standing patron was shorter than a seated customer.** Twelve in one grid
  came back 33 art pixels tall against the customers' 52, because the model
  draws about the same number of pixel cells per image however many subjects it
  is given — so asking for twelve makes each of them small, and a whole
  standing body shorter than a head-and-chest bust does not read as distance,
  it reads as children. Two sheets of six land them at 57 and 64, which is a
  standing adult behind a seated one.
- **A customer had lost his shirt.** Olive is a green, the flood walks in from
  the border over anything within tolerance of the ground, and a garment the
  colour of the ground touching the outer silhouette is simply not there
  afterwards: he sat at the counter for a day as an outline with a collar in
  it. His shirt is rust brown now — and the cut has three new mouths, because
  learning this one garment at a time is not learning it:
  - `--solid` warns when a figure fills less than its declared share of its own
    bounding box. Measured across the twelve customers, eleven sat between 61%
    and 84% and the man with no shirt sat at 47%.
  - The key now reports what IT took, per cell, over 4%.
  - And a sprite much smaller than its box is called out, because the box
    silently pads what falls short: the twelfth customer came back 37 pixels
    tall for a box of 52 and sat there noticeably smaller than everybody else,
    floating above the counter she was leaning on.
- `tools/art/roll.mjs` — rolls a sheet until it comes back at the size the game
  needs. The one thing a prompt does not control is scale: the same words at
  the same settings, changing only the seed, gave block sizes from 4 to 16 and
  patrons 33, 56 and 64 pixels tall. A set that matches can only be had by
  measuring every take and keeping the ones that land, and doing that by hand
  is what put a 37-pixel customer in a 52-pixel box. `process.py --measure`
  prints what a take WOULD cut to, so the loop is a command.
- The chroma key clears what the flood cannot reach, and the test is CHANNEL
  DOMINANCE and not distance. The first version measured plain L1 distance to
  the ground and cleared anything within 150 — the tolerance the flood uses —
  and put holes through every pan on the sheet: a mid grey is 142 from chroma
  green, because a ball of that radius in RGB contains most of the greys. The
  flood can afford it because it is spatial and the inside of a pan is not
  reachable from the border. A colour test cannot. Asking instead whether a
  pixel leads in the key channel the way the key colour does takes the fringe
  from 274 pixels across the set to 16.
- A blank cell in a grid is a blank frame, not a failed run. One empty cell
  used to take twenty-nine good sprites down with it.
