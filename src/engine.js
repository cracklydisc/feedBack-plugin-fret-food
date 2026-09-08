/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE KITCHEN ENGINE, which does not know a screen exists.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * No DOM, no timers, no `performance.now()`: time comes in through
 * `tick(dtMs)` and chords come in through `strum(name)`. Everything else is a
 * deterministic state machine.
 *
 * That is a decision, not tidiness for its own sake. A game you drive by
 * playing a guitar cannot be retested by hand every time a number moves, so a
 * whole service runs from a test in milliseconds, on exactly the numbers the
 * player will see. The detector, the keyboard and the scripted service are
 * three different sources for one input, and the engine cannot tell which of
 * them is talking.
 *
 * ── THE RULES, in one place ─────────────────────────────────────────────
 *
 * Every station has a customer with a DISH, and a dish is a chord
 * progression written as BARS. The step in front of a pot cooks like this:
 *
 *     the step's own number of strums on the chord it wants,
 *     then a beat of SILENCE.
 *
 * The silence after the strums is the REST, and nobody plays it: not playing
 * produces it. Play the bar and the step cooks — always. A step is `4 x C` at
 * the opening and `2 x C, 2 x G, 3 x Am` on a dish that costs more, so a
 * recipe is a chord chart and the dish says how long its bars are.
 *
 * Heat rises when you play the chord that station wants right now, on a curve
 * that rewards the SECOND strum (6, 14, 9, 6, 4, 2): touch and run does not
 * pay, and neither does hammering. Heat falls on its own at the burner's rate,
 * and the burners rise for the whole service.
 *
 * ── WHAT THE HEAT IS FOR, WHICH IS NOT WHETHER YOU COOK ─────────────────
 *
 * Heat decides what a step is WORTH. Under the line (READY) at the moment the
 * bar closes, the step still cooks and the pot takes a mark of soot: a star
 * off, no tip, and it cools faster from there on. A dish can be finished badly
 * all the way to the counter and be worth almost nothing.
 *
 * It used to be a gate — `two strums AND above the line` — and that refused
 * one in five completed gestures when measured against the bot with a
 * realistic ear. The player played the bar, rested, and nothing happened for a
 * reason no gauge on the screen could explain. Nothing else in this game can
 * be done right and fail silently, and this should not have been either.
 *
 * So the only thing that takes a customer away is their own clock. What ends a
 * service is the round trip: the more pots on the counter, the longer it takes
 * to get back to any one of them, and eventually a pot dies while your hands
 * are somewhere else. You run out of hands, not of heat, and `GROW_PER_S`
 * says how fast.
 *
 * One strum heats EVERY station that wants that chord at that moment. It is
 * the only rule that creates a greedy decision: waiting for a second order to
 * come round to the same step costs both of them seconds of life, but cooks
 * them together.
 *
 * ── TWO POTS ON ONE CHORD ───────────────────────────────────────────────
 *
 * It is normal to have two orders wanting the same chord, and normal for one
 * of them to walk in while the other is mid-cycle. Nothing about that can hurt
 * the pot that was already there, and it is worth saying why in one place:
 *
 *   - at the rest each pot is judged on its OWN heat against the same line;
 *   - a pot advances at most one step per rest, whatever else happened.
 *
 * So feeding a newcomer is pure gain and never a risk. What it does do is push
 * them apart again: two pots that cook together move on to the next chord of
 * their own recipes, which are usually different ones, and keeping a pair in
 * step is a thing a player does on purpose rather than something that happens.
 */

import { dist, changes, shapesAt, NAMES, FACES } from './menu.js';
import { voice } from './invent.js';

export const RULES = {
  BEAT_MS: 750,            // 80 bpm, fixed for the whole service; the idle clocks read it
  /* The pot is a clock, and the line on it is the one the CHANGE has to beat.
   *
   * A cooked step fills the pot to `HEAT_FULL`, and it drains from there at the
   * burner's rate: above `READY` the next step comes out clean, below it the
   * step still cooks and takes a mark of soot, and at zero the customer walks.
   * So one bar on the card answers all three questions a player has — how long
   * have I got, how long before this stops being worth full price, and how
   * long before I lose them.
   *
   * `FINGER_GRACE` is the part that makes it fair: a change of four fingers is
   * given four times as much room before it counts as late as a change of one.
   * The game is a chord-change drill, and a drill that pays the same for
   * C-to-Am as for C-to-F is not measuring the hand, it is measuring the
   * fingering. */
  /* The floor between two steps of a pot ON THE SAME CHORD, and it is what
   * lets a recipe repeat a chord at all.
   *
   * When every step is a different chord the ear's phantom onsets are
   * harmless: it re-arms every 180 ms whether the sound has died back or not,
   * so a slow sweep arrives as strums at 0, 180, 360 and 540, and all but the
   * first land on a chord nobody wants. Repeat a chord and every one of them
   * cooks a real step — measured, one sweep cooked four steps of `C C C C C`,
   * which is the hole the four-strum bar fell down, entered from the other
   * side.
   *
   * 600 ms is past the three phantoms a slow sweep can produce, and it is one
   * strum a beat at a hundred to the minute: a repeated step asks to be played
   * IN TIME rather than filled with noise. It is deliberately not a floor on
   * cooking in general — a CHANGE is unthrottled, because a phantom of the
   * chord just played cannot cook a step that wants a different one, and a
   * player quick enough to change twice in half a second has earned both. */
  STEP_GAP_MS: 600,
  HEAT_FULL: 100,          // a cooked step fills the pot
  /* Where the line sits, and it is high on purpose.
   *
   * The pot is one bar answering two questions: how long have I got to make
   * this change WELL, and how long before the customer leaves. Those two want
   * very different amounts of time — a change is a couple of seconds and a
   * decision across five cards is ten — so the ratio between them is set by
   * how far down the bar the line is. At 65 the ratio is two and a half and
   * the pots died in three seconds of thinking; at 80 it is five, which gives
   * a two second window inside a ten second life. */
  READY: 80,               // above this the next step comes out clean
  FINGER_GRACE: 5,         // and each finger that has to move buys this much of it
  /* However much the kitchen cools, a burner never goes below the one the
   * opening is played on: relief is a step back down the ladder, not a way
   * to a kitchen easier than the first minute of the game. */
  BURNER_FLOOR: 2.2,
  /* THE PLATES ON STICKS. With two pots or more the round trip is what kills:
   * cook one pot cleanly and the others have cooled the whole while, so a
   * player who plays one ticket well loses the rest, and only luck — two
   * pots on one chord — saves them. The spinner's trick is a touch on each
   * plate in turn, and the game now pays for it: every step cooked gives
   * every OTHER pot on the counter a fifth of a full pot back. Play in turn
   * and they all hold; camp on one and the others still go — a fifth is a
   * fifth, not a reset — so being slow somewhere is still paid for. */
  /* THE KITCHEN COOLS WHEN THE MENU CHANGES.
   *
   * The flames climb from the first bell to the last, so the hardest shapes
   * in the game arrive at the tightest clock there is: measured, a pot lives
   * 12.6 s at the Opening and 4.3 s by Closing Time, and the barres are dealt
   * at 6 s while the two-finger shapes had twelve. A player meets the neck
   * with less time than they had for C to Am, which is the difficulty curve
   * upside down — a session said so in one line: "tendo a perdere prima di
   * aver provato tutti gli accordi".
   *
   * So a bell that unlocks a TIER OF SHAPES takes the burner back down by
   * this much instead of pushing it up by `step`. A new shape is met with a
   * pot that lives about as long as the last new shape did; a bell that opens
   * a PLACE climbs as it always has, because that difficulty is the round
   * trip and not the hand. The flames still creep up inside every level
   * (`GROW_PER_S`), so nothing stands still.
   *
   * 0.20, which is half the step it replaces, so the ladder still descends —
   * just gently while the shapes are arriving. Measured, the life of a pot at
   * each of the nine bells:
   *
   *     without   12.6  9.6  7.5  6.2  5.2  4.4 | 3.8  3.4  3.0
   *     with      12.6 11.6 10.8 10.0  9.4  8.8 | 6.7  5.4  4.5
   *                 ── the six tiers of shapes ──  ── the pans ──
   *
   * The neck is met at 8.8 s instead of 4.4, and the counter growing still
   * takes the clock down to four and a half. What it buys is the player this
   * game is for: a slow hand on two pots — 0.7 s a change plus a quarter
   * second a finger — lasted 271 to 405 s over twelve seeds and now lasts 479
   * to 567. */
  TIER_RELIEF: 0.2,
  SPIN_BONUS: 0.2,
  /* Whether that fifth is handed to EACH other pot or split between them.
   * Split, measured on the bench: handed whole, with five pots a lap of the
   * counter gives every pot four fifths back and the automatic player loses
   * nobody in ten minutes — the wall is gone, and with it the end of a
   * service. Split, two pots get the whole fifth (the case the rule was made
   * for) and five get a twentieth each: a lap buys a fifth of a life at any
   * number of pots, and the wall stays where the hands run out. */
  SPIN_SHARED: true,
  /* How fast the pot drains, per point of burner, per second.
   *
   * With the line at 80, this leaves a one-finger change 2.4 seconds at the
   * opening and 0.7 by the fifth service, a four-finger change 3.6 down to
   * 1.1, and the pot itself a life of ten seconds falling to three. Those are
   * about what those two changes take a beginner and somebody who has
   * practised, and about how long it takes to read five cards and choose.
   *
   * It was tuned against a hand and not against the bot, on purpose: the bot
   * changes chord in 260 to 620 ms and stays clean at any rate this side of
   * absurd, so what it measures is the round trip between five pots and not
   * whether one change is hard. */
  /* 3.6, down from 4.2 after the second session with a player: at 4.2 the
   * fourth pot was where a good beginner stopped being able to look at every
   * card before one of them went out. The pot lives a sixth longer at every
   * burner — twelve and a half seconds at the opening instead of ten — and
   * `PACES` moves the same number both ways for whoever wants it otherwise. */
  COOL: 3.6,
  /* The flames rise on their own, and that is the only thing that makes the
   * game harder over time.
   *
   * The wall is NOT the one this comment first claimed. Per pot, three strums
   * hold the line up to a burner of about 15, which would be level 8 or 9. What
   * actually ends a service is the round trip: with four or five pots, a cycle
   * costs 1.1 to 1.9 s, so one lap of the counter takes 5 to 9 s, and at burner
   * 6 a pot only lives 9 s. The automatic player, measured over twelve seeds,
   * dies between 221 and 292 seconds, at level 4 or 5. With strikes switched
   * off it reaches level 11 in ten minutes while losing 57 customers, which is
   * the same statement from the other side: you run out of hands, not of heat.
   *
   * So this number sets how fast the lap tightens, not when a single pot
   * becomes impossible. Move it and the run length moves with it. */
  GROW_PER_S: 0.0065,      // was 0.008: with nine services the climb is spread over more of them
  SILENCE_BEATS: 3,        // past this, everything cools twice as fast
  CHAIN_IDLE_BEATS: 4,     // past this, the chain is lost
  CHAIN_MAX: 5,
  SOOT_MAX: 3,
  RUSH_COST: 3,            // from this distance up, a rushed change comes out dirty
  TIP: 1.25,               // served with no soot at all
  STRIKES: 3,
  /* How many places the counter may grow to, whatever the level table says.
   * The hub's picker offers it: a novice who wants to learn the changes and
   * not the juggling plays the whole ladder of shapes on one or two pots, and
   * the burner still climbs. Five is the counter; less is a choice. */
  MAX_STATIONS: 5,
  /* A LOST CUSTOMER CAN BE WON BACK. Three strikes and the service closes,
   * and that was the only direction the count could move: a service was as
   * long as its three worst moments. Now this many dishes served CLEAN in a
   * row — with the tip, so not a single star lost on any of them — bring one
   * lost customer back, and the ticket lights up again on the bar. A dish
   * without its tip breaks the run, and so does losing somebody. Eight is
   * about a minute of good play at the opening and half of one later, which
   * is long enough that it is earned and short enough that it is worth it. */
  REDEEM_TIPS: 8,
  /* A PERFECT SERVICE: a level ended with something served and nobody lost
   * pays a share of that level's takings on top, so every minute has a goal
   * of its own and not only the end of the run. */
  PERFECT_SHARE: 0.25,
  PERFECT_MIN: 40,
  /* THE CRITIC. Now and then, from the second service on and never two at
   * once, a customer sits down who orders the hardest dish the counter can
   * ask for and pays three times for it. Losing them is a strike like any
   * other: the risk is the chair they take from an easier customer, and the
   * reward is the tag under their pan. `CRITIC` is the switch the hub's
   * unlocks flip; the bench has them from the start. */
  CRITIC: true,
  CRITIC_CHANCE: 0.12,
  CRITIC_PAY: 3,
  CRITIC_FACE: 11,
  /* The modes, as rules the glue lays over these. `LOOP` deals the same dish
   * every time, for drilling one change (`LOOP_TARGET` names the change to
   * find a dish for); `TIME_LIMIT_MS` closes the service at the bell whatever
   * the strikes say. Practice is `STRIKES` set out of reach. */
  LOOP: false,
  LOOP_TARGET: null,
  TIME_LIMIT_MS: 0,
  LEVEL_MS: 60000,
  /* How long the counter waits before it grows another place.
   *
   * The service used to open with three burners already lit, which is three
   * chords to hold in your head in the first ten seconds of a game whose rule
   * you have not been told yet. It opens with ONE now, and a place is added
   * every half minute until the level's own count is reached, so the counter
   * grows in front of you instead of arriving. The level table still says how
   * many places a level ends with; this says how fast it gets there. */
  OPEN_MS: 30000,
  /* How long a place stays shut after a dish leaves it, and it is a beat of
   * the game rather than a pause between two of them: the dish flies to the
   * plate, the customer EATS it a piece at a time and then gets up. 1400 was
   * shorter than the eating, so the chair emptied while the food was still in
   * the air and the one thing the player had earned went past unseen. The
   * scene's `EAT_MS` and `GHOST_MS` are the same beat drawn, and this number
   * has to be the longer of the two. */
  SEAT_DELAY_MS: 2400,     // after a dish goes out: the flight, the eating, the hop off the stool
  SEAT_DELAY_LOST_MS: 2200,
  QUEUE: 6,                // how many people are visibly waiting to be seated
  STARS: 5,                // a dish is scored out of this many
};

/*
 * THE PACE, chosen before the service and nowhere else.
 *
 * The rules above are tuned for a hand that already changes chord in a second
 * or two. The player this game is FOR takes three to five seconds from C to F,
 * and against the normal burner that hand lives on `-1 STAR` from the first
 * ticket to the last. A drill has to leave room for the thing it drills, so the
 * hub's picker offers a pace and the pace is two numbers: how fast a pot
 * drains and how fast the flames climb. Nothing else moves — the line, the
 * grace per finger and the prices are the same game at every pace, so a score
 * is still a score.
 */
export const PACES = {
  relaxed: { COOL: 2.8, GROW_PER_S: 0.0045 },
  normal: {},
  rush: { COOL: 4.6, GROW_PER_S: 0.009 },
};

/*
 * THE SCORE, comparable across the picker's choices.
 *
 * The score is the takings, and with a pace and a number of burners to choose
 * a record made on one pot in relaxed would beat one made on five in rush.
 * There is no shared board — the numbers are the player's own — but a personal
 * best that is beaten by choosing an easier service is not a best. So the
 * takings are scaled by what was chosen: the full counter at the normal pace
 * is one, an easier service less, a harder one more. Practice and the loop are
 * not services and score nothing; the sprint is three minutes of the real
 * thing and counts as it is.
 */
export const SCORE_MULT = {
  pace: { relaxed: 0.75, normal: 1, rush: 1.25 },
  pans: [0.5, 0.7, 0.85, 0.95, 1],
  mode: { service: 1, sprint: 1, practice: 0, loop: 0 },
  /* ONLY THE GUITAR SCORES. The keyboard and the scripted player exist so
   * the game can be developed and measured without a guitar in the room, and
   * a hub that counts dB across its games cannot be handed a service that a
   * finger on the C key played: whatever those two take, they report nothing.
   * The engine does not know where a chord came from — the glue does, and
   * says so here. An input the table has never heard of scores, so a source
   * added later is not silently free; the two that are free are named. */
  input: { guitar: 1, keyboard: 0, script: 0 },
};

export function scoreOf(cash, o) {
  const opt = o || {};
  const pace = SCORE_MULT.pace[opt.pace] === undefined ? 1 : SCORE_MULT.pace[opt.pace];
  const pans = SCORE_MULT.pans[Math.min(5, Math.max(1, Number(opt.pans) || 5)) - 1];
  const mode = SCORE_MULT.mode[opt.mode] === undefined ? 1 : SCORE_MULT.mode[opt.mode];
  const input = opt.input === undefined || SCORE_MULT.input[opt.input] === undefined ? 1 : SCORE_MULT.input[opt.input];
  const mult = pace * pans * mode * input;
  return { score: Math.round(Math.max(0, cash || 0) * mult), mult };
}

/* What it costs the hand to go from one shape to another. There is no table
 * here: it is the same distance the menu prices dishes with, worked out from
 * the real shapes on the neck. A new chord gets added in one place. */
export const handCost = dist;

/* A deterministic generator: two services with the same seed serve the same
 * dishes, which is what makes an automatic test a test. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createGame(opts) {
  const o = opts || {};
  const R = Object.assign({}, RULES, o.rules || {});
  const menu = o.menu || [];
  const levels = o.levels || [];
  const rand = rng(o.seed || 1);
  const listeners = new Map();

  const S = {
    t: 0,                  // game time, ms
    running: true,
    over: false,
    cash: 0,
    chain: 1,
    served: 0,
    ruined: 0,
    strikes: 0,
    level: 1,
    levelName: '',          // filled in below, once the level table is known
    cycles: 0,             // steps cooked, clean or spoiled
    spoiled: 0,           // steps cooked under the line: the dish is worth less
    /* Two counters, two jobs, and keeping them apart is the point.
     *
     * `chain` is the money multiplier and it is deliberately mean: capped at 5,
     * and lost by standing still, because it is what makes waiting expensive.
     * `combo` is the arcade streak: it counts cooked steps in a row and only a
     * MISTAKE breaks it, so stopping to think does not cost it. One number says
     * what the next dish is worth, the other says how the service is going, and
     * a player reads them differently. */
    combo: 0,
    comboBest: 0,
    levelCash: 0,          // taken since this level began
    queue: [],             // who is waiting to be seated, in order
    hits: 0,
    misses: 0,
    stations: [],
    hand: null,            // the last shape the hand made
    lastChord: null,
    runOn: 0,              // consecutive strums on the same chord
    lastHitAt: -1e9,
    /* Rushing is measured from here, and this includes the rest. Measured from
     * the last STRUM instead, a whole beat would always have passed by the end
     * of a cycle and the rule could never fire: the gesture we want to catch is
     * jumping onto a far shape without taking the beat to get there, and that
     * beat IS the rest. */
    lastEventAt: -1e9,
    badRun: 0,
    nextPlaceAt: R.OPEN_MS,
    nextLevelAt: R.LEVEL_MS,
    /* THE KITCHEN WAITS FOR THE FIRST CHORD.
     *
     * It used to open the moment the scene appeared, and worse: `lastHitAt`
     * starts at minus infinity, so the service was SILENT from its first tick
     * and every pot cooled at double rate before anybody had played a note.
     * Measured with no input at all: heat 42 at three seconds, the first
     * customer gone at seven. A beginner reading their first fingering was
     * being judged for the time it took to read it.
     *
     * So until the first chord is heard the first customer sits down and
     * waits, nothing cools, the flames do not climb and the clocks of the
     * level and of the next place are not running. `open()` starts them all
     * from that moment, and `openedAt` is what the bar's clock counts from. */
    started: false,
    openedAt: 0,
    seated: 0,             // customers seated so far: the first two get the gentle dishes
    tipRun: 0,             // dishes served clean in a row, towards winning a customer back
    servedThisLevel: 0,    // for the perfect-service bonus at the bell
    lostThisLevel: 0,
    loopDish: null,        // the one dish a LOOP service deals, once it is chosen
  };

  const emit = (name, data) => {
    const fns = listeners.get(name);
    if (fns) for (const fn of fns) { try { fn(data); } catch (_) { /* a broken listener does not stop the service */ } }
  };

  function levelSpec(n) {
    const raw = levels[Math.min(levels.length - 1, Math.max(0, n - 1))] || {
      name: 'Service', stations: 3, maxSteps: 4, burnerBoost: 0, step: 0.5,
    };
    // The counter never grows past what the player asked for: see `MAX_STATIONS`.
    const cap = R.MAX_STATIONS || 5;
    return (raw.stations || 3) > cap ? Object.assign({}, raw, { stations: cap }) : raw;
  }

  /** Opens the kitchen: the clocks start counting from now. The first chord
   *  calls it; the bench calls it by hand, because a bench measures a kitchen
   *  that is open. Calling it twice does nothing. */
  function open() {
    if (S.started) return;
    S.started = true;
    S.openedAt = S.t;
    S.nextLevelAt = S.t + R.LEVEL_MS;
    S.nextPlaceAt = S.t + R.OPEN_MS;
    emit('open', { t: S.t });
  }

  /**
   * THE OPTIONS PLATE, and the one moment the rules may move.
   *
   * The pace, the cap on the counter and the mode are chosen on a plate over
   * the dining room while the first customer already sits with their ticket
   * up, so the choice arrives AFTER `createGame` and before the first chord.
   * The rules are laid over in place — every one of them is read at the
   * moment it matters, never copied at creation — and the counter is dealt
   * again under them, because the one thing already decided is that first
   * customer's dish: a LOOP wants its one recipe on the card before the
   * kitchen opens, not on the second ticket. Once the service has started
   * this answers false and changes nothing; "chosen before the service and
   * nowhere else" still holds.
   */
  function setRules(over) {
    if (S.started) return false;
    const wasLoop = !!R.LOOP;
    const wasTarget = R.LOOP_TARGET;
    Object.assign(R, over || {});
    /* Dealt again only when the deal would differ: the first dish depends on
     * the LOOP and its target and on nothing else that can be chosen here, so
     * a pace or a cap on the counter leaves the ticket the player is reading
     * exactly where it is. */
    if (!!R.LOOP !== wasLoop || R.LOOP_TARGET !== wasTarget) redeal();
    return true;
  }

  /** The same people, seated again under the rules as they now stand. Whoever
   *  was at the counter goes back to the head of the queue and sits down
   *  again, so a name and a face the player has already read do not change
   *  under them — only the ticket can. Only before the first chord. */
  function redeal() {
    if (S.started) return;
    S.loopDish = null;
    for (const st of S.stations) {
      if (!st.order) continue;
      if (st.who && !st.who.critic) S.queue.unshift(st.who);
      S.seated = Math.max(0, S.seated - 1);
      clearStation(st, true);
      st.seatAt = S.t;
      seat(st);
    }
  }

  /**
   * Keeps the doorway full.
   *
   * The queue holds people, not orders. What they will ask for is decided when
   * they sit down, by `pickDish`, which has to see the counter as it is at that
   * moment: that is what keeps a short dish available, and what makes two pots
   * land on the same chord. Deciding their dish in the doorway would throw both
   * of those away, so a person in the queue carries a name and a face and
   * nothing else. It is also the more honest fiction: you can see who is
   * waiting, you cannot see what they want yet.
   */
  function fillQueue() {
    while (S.queue.length < R.QUEUE) {
      S.queue.push({
        name: NAMES[Math.floor(rand() * NAMES.length) % NAMES.length],
        face: Math.floor(rand() * FACES) % FACES,
      });
    }
  }

  function addStation() {
    const spec = levelSpec(S.level);
    /* A burner that has just been lit is not yet hot.
     *
     * The spread used to be [2.4, 3.2, 4.0, 2.8, 3.6], so the third place a
     * player ever saw opened at 4.0 and its first customer had fourteen
     * seconds while the first place had twenty-four. A new place now opens at
     * the gentle end and climbs with the rest of the kitchen; the spread that
     * gives each pot its own rhythm is kept, but it is a spread of a few
     * tenths and not of a third of the clock. */
    const base = [2.2, 2.5, 2.8, 2.4, 2.7][S.stations.length % 5];
    S.stations.push({
      i: S.stations.length,
      order: null, who: null, step: 0, heat: 0, soot: 0, cookedAt: -1e9, cookedChord: null,
      burner: base + (spec.burnerBoost || 0),
      seatAt: S.t,
    });
  }

  const wants = (st) => (st.order ? st.order.steps[st.step] : null);

  /**
   * Which dish arrives now.
   *
   * Not a straight draw from the menu, and the reason is that the counter has
   * to stay playable: three long recipes at once are not hard, they are
   * impossible, and the player cannot tell they lost to the shuffle. The rules
   * are three, in order, and each takes cards out of the deck rather than
   * adding a special case.
   */
  function pickDish(forStation) {
    /* A LOOP service is one recipe, dealt every time: the first one chosen,
     * or — when the glue names the change to drill — the first dish on the
     * menu that contains that change, so a player can come back to the pair
     * their last report said was slowest. */
    if (R.LOOP) {
      if (!S.loopDish) {
        const want = R.LOOP_TARGET;
        const has = (m) => want && m.steps.some((c, i) => i > 0 && m.steps[i - 1] === want.from && c === want.to);
        S.loopDish = (want && menu.find(has)) || pickDishFresh(forStation);
      }
      return S.loopDish;
    }
    return pickDishFresh(forStation);
  }

  function pickDishFresh(forStation) {
    const spec = levelSpec(S.level);
    const maxSteps = spec.maxSteps || 4;
    const busy = S.stations.filter((s) => s.order && s !== forStation);

    /* The shapes a dish may ask for are the level's TIER (`shapes` in the
     * level table), not the level number: a level either unlocks a tier or
     * adds a place, never both, so a new shape is met with pans the player
     * already knows how to keep. See the note over `LEVELS`. */
    const tier = shapesAt(spec, S.level);
    const fits = menu.filter((m) =>
      m.steps.length <= maxSteps && (m.level === undefined || m.level <= tier));
    const pool = fits.length ? fits : menu;
    if (!pool.length) return null;

    /* 0. never a recipe that is already on the counter.
     *
     *    Measured at the second service: three customers side by side, all
     *    three with Nightfall Minestrone. The echo rule below picks a dish
     *    that STARTS where another pot already is, the gentle rule narrows the
     *    deck further, and on a small level the two together kept dealing the
     *    same card. Three identical tickets read as a bug and say nothing
     *    about progressions. The two-pot play does not need the same recipe,
     *    only the same chord, and the echo rule still provides that. The
     *    fallback matters: a menu of one dish (the bench) has to keep dealing
     *    it. */
    let from = pool;
    const onCounter = new Set(busy.map((s) => s.order.id));
    const fresh = from.filter((m) => !onCounter.has(m.id));
    if (fresh.length) from = fresh;

    // 1. never two long recipes at once.
    if (busy.some((s) => s.order.steps.length >= 6)) {
      const shorter = from.filter((m) => m.steps.length < 6);
      if (shorter.length) from = shorter;
    }

    /* 1b. the first two customers of a service are the lesson.
     *
     *    The menu says One-Chord Toast is "the very first thing anybody
     *    plays", and nothing made it so: the first ticket could be Dorian
     *    Broth, whose third step is a change, before the screen had shown
     *    that a card turns over when you play what it says. So the first
     *    customer orders a dish with no change in it at all, and the second
     *    one a dish with a single change. From the third on, the deck. */
    if (S.seated === 0) {
      const hold = from.filter((m) => changes(m) === 0);
      if (hold.length) from = hold;
    } else if (S.seated === 1) {
      const gentle = from.filter((m) => changes(m) <= 1);
      if (gentle.length) from = gentle;
    }

    /* 2. up to level 4 a GENTLE dish always stays on the counter: it is the
     *    release valve for when everything else is burning.
     *
     *    Gentle used to mean short — two steps or fewer — because a step was a
     *    bar of strums and the length was the work. A step is one chord heard
     *    now, so what makes a dish easy is how many CHANGES it asks for: `C C
     *    Am Am` is four steps and one change, and it is the most forgiving
     *    thing on the menu. */
    if (tier <= 3 && !busy.some((s) => changes(s.order) <= 1)) {
      const quick = from.filter((m) => changes(m) <= 1);
      if (quick.length) from = quick;
    }

    // 3. now and then a dish arrives that starts where somebody else already
    //    is: this is how the game offers the two-pot play by itself.
    if (S.level >= 2 && rand() < 0.4) {
      const open = new Set(busy.map((s) => wants(s)));
      const echo = from.filter((m) => open.has(m.steps[0]));
      if (echo.length) from = echo;
    }

    // The newest tier is dealt most often: it is the lesson of this service.
    const weight = (m) => (m.level === tier ? 5 : m.level === tier - 1 ? 3 : 2);
    const total = from.reduce((n, m) => n + weight(m), 0);
    let r = rand() * total;
    for (const m of from) { r -= weight(m); if (r <= 0) return m; }
    return from[from.length - 1];
  }

  /**
   * The critic's dish: the hardest the counter may ask for right now — most
   * changes, then the highest price — and never one already on the counter.
   * Among the top three, at random, so the critic is not always the same dish.
   */
  function pickHard(forStation) {
    const spec = levelSpec(S.level);
    const tier = shapesAt(spec, S.level);
    const busy = new Set(S.stations.filter((s) => s.order && s !== forStation).map((s) => s.order.id));
    const pool = menu
      .filter((m) => m.steps.length <= (spec.maxSteps || 4) && (m.level === undefined || m.level <= tier) && !busy.has(m.id))
      .sort((a, b) => (changes(b) - changes(a)) || (b.price - a.price));
    if (!pool.length) return null;
    return pool[Math.floor(rand() * Math.min(3, pool.length)) % Math.min(3, pool.length)];
  }

  function seat(st) {
    const spec = levelSpec(S.level);
    const tier = shapesAt(spec, S.level);
    /* Now and then, the critic: see `CRITIC`. Not before the second service,
     * never two at once, and with a dish of their own choosing. */
    const critic = R.CRITIC && !R.LOOP && S.level >= 2
      && !S.stations.some((s) => s.who && s.who.critic)
      && rand() < R.CRITIC_CHANCE;
    let dish = critic ? pickHard(st) : pickDish(st);
    if (!dish) return;
    /* Dealt in a key of its own: see `voice`. A LOOP service keeps the one
     * recipe it drills; a critic's dish is voiced like any other. */
    if (!R.LOOP) dish = voice(dish, tier, rand);
    fillQueue();
    st.who = critic ? { name: 'THE CRITIC', face: R.CRITIC_FACE, critic: true } : S.queue.shift();
    fillQueue();
    st.order = dish;
    st.step = 0;
    st.heat = R.HEAT_FULL;
    st.soot = 0;
    st.seatAt = S.t;
    S.seated++;
    emit('seat', { station: st.i, dish: st.order, who: st.who });
  }

  function clearStation(st, served) {
    st.order = null;
    st.who = null;
    st.step = 0;
    st.heat = 0;
    st.soot = 0;
    st.seatAt = S.t + (served ? R.SEAT_DELAY_MS : R.SEAT_DELAY_LOST_MS);
  }

  function serve(st) {
    const tip = st.soot === 0 ? R.TIP : 1;
    const critic = st.who && st.who.critic ? R.CRITIC_PAY : 1;
    const money = Math.round(st.order.price * S.chain * tip * critic);
    S.cash += money;
    S.levelCash += money;
    S.served++;
    S.servedThisLevel++;
    emit('serve', {
      station: st.i, dish: st.order, who: st.who, money, tip: tip > 1, critic: critic > 1,
      chain: S.chain, combo: S.combo, stars: stars(st),
    });
    /* The run of clean dishes, and what it buys: see `REDEEM_TIPS`. A dish
     * that lost a star breaks it; a run long enough while a customer is lost
     * brings that customer back. The event is what lights the ticket again. */
    if (tip > 1) {
      S.tipRun++;
      if (S.strikes > 0 && S.tipRun >= R.REDEEM_TIPS) {
        S.strikes--;
        S.tipRun = 0;
        emit('redeem', { station: st.i, strikes: S.strikes });
      }
    } else {
      S.tipRun = 0;
    }
    clearStation(st, true);
  }

  function ruin(st) {
    S.strikes++;
    S.ruined++;
    S.chain = 1;
    S.combo = 0;
    S.tipRun = 0;          // the run towards winning somebody back starts over
    S.lostThisLevel++;

    emit('ruin', { station: st.i, dish: st.order, who: st.who, strikes: S.strikes });
    clearStation(st, false);
    if (S.strikes >= R.STRIKES) end('strikes');
  }

  function end(why) {
    if (S.over) return;
    S.over = true;
    S.running = false;
    emit('over', {
      why, cash: S.cash, served: S.served, ruined: S.ruined, level: S.level,
      levelName: S.levelName, cycles: S.cycles, comboBest: S.comboBest, t: S.t,
    });
  }

  /* ── the input: one strum ──────────────────────────────────────────── */
  function strum(chord, quality) {
    if (!S.running) return { ok: false, why: 'closed' };
    // The first chord of the service opens the kitchen. A bleed (`null`, or
    // the bench's ' ') is not a chord and opens nothing: nobody has played yet.
    if (chord !== null && chord !== undefined && chord !== ' ') open();
    const q = quality === undefined ? 1 : quality;
    const targets = S.stations.filter((st) => st.order && wants(st) === chord);

    if (!targets.length) {
      S.misses++;
      S.badRun++;
      S.hand = chord || S.hand;
      S.lastChord = null;
      S.lastHitAt = S.t;
      S.lastEventAt = S.t;
      if (S.badRun >= 3) {
        S.chain = 1;
        S.combo = 0;
        S.badRun = 0;
        emit('chainLost', { why: 'ingredient' });
      }
      emit('miss', { chord });
      return { ok: false, why: 'nobody wants it' };
    }

    S.hits++;
    S.badRun = 0;
    const changing = S.lastChord !== chord;
    // How long the hand took from the last chord that landed to this one, for
    // the practice mode's readout. A repeat is not a change and has no time.
    const changeMs = changing && S.lastChord !== null && S.lastHitAt > -1e8 ? S.t - S.lastHitAt : null;

    /*
     * ─────────────────────────────────────────────────────────────────────
     * ONE CHORD HEARD IS ONE STEP COOKED, and the reason is the microphone.
     * ─────────────────────────────────────────────────────────────────────
     *
     * The step used to want a BAR of strums — two, then whatever the dish
     * asked for — and a beat of silence after it. That is a good rule for a
     * game with buttons and an impossible one for a game with a guitar in
     * front of it, because COUNTING STRUMS IS NOT A MEASUREMENT THIS INPUT
     * CAN MAKE. `input/engine.js` re-arms its onset detector after 180 ms
     * whether the level has fallen back or not, and it has to: the gate that
     * waits for the sound to die was throwing away the second strum of every
     * pair. So one slow sweep across six strings fires again at 180, 360 and
     * 540 ms, and the first person to play a four-strum bar reported that a
     * single long strum filled it — which is not a bug to be fixed, it is the
     * shape of the information. Anything built on the count of strums is built
     * on a number the ear invents.
     *
     * What the ear DOES know is which chord is sounding: that is
     * `scoreChord`, it is a state and not an event, and it is reliable. So the
     * whole game is built on it. Play the chord the ticket wants and the step
     * is cooked, at once, and the card turns over to the next one. The rhythm
     * is no longer counted at all — it is TIMED, by the one clock that was
     * always on the screen.
     *
     * WHAT MAKES IT HARD, then. The pot is filled by the step it just cooked
     * and drains from there: above `READY` the next step comes out clean,
     * under it the step still cooks but the dish is spoiled a little, and at
     * zero the customer leaves. So the game asks the only question a
     * chord-change drill asks — how fast can you get there — and it asks it
     * with the fingers in mind, because `FINGER_GRACE` gives a change of four
     * fingers four times the room of a change of one.
     *
     * And one chord still feeds EVERY pot that wants it, which is the greedy
     * play and the reason two tickets on the same chord is the move worth
     * waiting for. It is more legible than it has ever been: both cards turn
     * over on the same strum.
     */
    const cooked = [];
    const lateOnes = [];
    for (const st of targets) {
      /* A pot does not cook the SAME chord twice inside the floor: see
       * `STEP_GAP_MS`. The strum is not a miss — it found a pot that wanted it
       * — it simply does not advance this one, and it still cooks every other
       * pot that has been waiting. */
      if (st.cookedChord === chord && S.t - (st.cookedAt || -1e9) < R.STEP_GAP_MS) continue;
      const line = Math.max(0, R.READY - handCost(S.hand, chord) * R.FINGER_GRACE);
      const late = st.heat < line;
      if (late || q < 0.8) st.soot = Math.min(R.SOOT_MAX, st.soot + 1);
      else if (st.soot > 0) st.soot--;
      if (late) { S.spoiled++; lateOnes.push(st.i); }
      st.heat = R.HEAT_FULL;
      st.cookedAt = S.t;
      st.cookedChord = chord;
      cooked.push(st);
    }

    /* The touch on the other plates: see `SPIN_BONUS`. Only when something
     * cooked, and never for the pots this strum fed. */
    if (cooked.length && R.SPIN_BONUS > 0) {
      const others = S.stations.filter((st) => st.order && !targets.includes(st));
      const share = (R.SPIN_BONUS * R.HEAT_FULL) / (R.SPIN_SHARED ? Math.max(1, others.length) : 1);
      for (const st of others) st.heat = Math.min(R.HEAT_FULL, st.heat + share);
    }

    S.runOn = changing ? 1 : S.runOn + 1;
    S.hand = chord;
    S.lastChord = chord;
    S.lastHitAt = S.t;
    S.lastEventAt = S.t;
    const dirty = cooked.some((st) => st.soot > 0 && st.heat === R.HEAT_FULL && q < 0.8);
    emit('strum', { chord, stations: targets.map((s) => s.i), dirty, together: targets.length });

    if (cooked.length) {
      S.chain = Math.min(R.CHAIN_MAX, S.chain + 1);
      S.cycles++;
      // The streak counts every pot that cooked, so the two-pot play is worth
      // double on the board as well as in the till.
      S.combo += cooked.length;
      if (S.combo > S.comboBest) S.comboBest = S.combo;
      // `late` names the pots that cooked under the line: the screen says so
      // where it happened, instead of leaving the player to find a star gone.
      emit('cycle', { chord, chain: S.chain, combo: S.combo, stations: cooked.map((s) => s.i), late: lateOnes, changeMs });
    }
    for (const st of cooked) {
      st.step++;
      if (st.step >= st.order.steps.length) serve(st);
      else emit('step', { station: st.i, step: st.step, next: wants(st), dish: st.order });
    }
    return { ok: true, dirty, together: targets.length };
  }

  /* ── time ──────────────────────────────────────────────────────────── */
  function tick(dtMs) {
    if (!S.running) return;
    const dt = Math.max(0, dtMs) / 1000;
    S.t += Math.max(0, dtMs);

    /* Before the first chord the kitchen is set but not lit: the first
     * customer takes a seat so there is something to read, and that is all.
     * No heat is lost, no flame climbs, no clock runs. The time itself still
     * passes — the bench schedules its strums on it — but `open()` re-bases
     * every schedule on the moment the first chord arrives. */
    if (!S.started) {
      for (const st of S.stations) if (!st.order && S.t >= st.seatAt) seat(st);
      return;
    }

    const since = S.t - S.lastHitAt;
    const silent = since >= R.BEAT_MS * R.SILENCE_BEATS;
    if (S.chain > 1 && since > R.BEAT_MS * R.CHAIN_IDLE_BEATS) {
      S.chain = 1;
      emit('chainLost', { why: 'idle' });
    }

    for (const st of S.stations) {
      // The burner heats up regardless: it is the kitchen coming up to
      // temperature, not the pot. Otherwise losing a customer would be a way to
      // cool the fire down, which is a reward for getting it wrong.
      st.burner += R.GROW_PER_S * dt;
      if (!st.order) {
        if (S.running && S.t >= st.seatAt) seat(st);
        continue;
      }
      const rate = (st.burner + st.soot) * R.COOL * (silent ? 2 : 1);
      st.heat -= rate * dt;
      if (st.heat <= 0) { st.heat = 0; ruin(st); }
    }

    /* The sprint's bell: a timed service closes when its time is up, whatever
     * the strikes say, and `why` says so. */
    if (R.TIME_LIMIT_MS && S.running && S.t - S.openedAt >= R.TIME_LIMIT_MS) {
      end('time');
      return;
    }

    if (S.t >= S.nextLevelAt && S.running) {
      /* A perfect service pays before the bell rings: something went out and
       * nobody was lost in the level that is ending. See `PERFECT_SHARE`. */
      const perfect = S.servedThisLevel > 0 && S.lostThisLevel === 0
        ? Math.max(R.PERFECT_MIN, Math.round(S.levelCash * R.PERFECT_SHARE)) : 0;
      if (perfect) {
        S.cash += perfect;
        emit('perfect', { level: S.level, bonus: perfect });
      }
      S.nextLevelAt += R.LEVEL_MS;
      const before = levelSpec(S.level);
      S.level++;
      const spec = levelSpec(S.level);
      S.levelName = spec.name || 'Service';
      S.levelCash = 0;
      S.servedThisLevel = 0;
      S.lostThisLevel = 0;
      /* A tier of shapes arriving cools the kitchen; a place opening heats
       * it. See `TIER_RELIEF` — the two never happen at one bell, which the
       * level table has a test of its own for. */
      const relief = (spec.shapes || 0) > (before.shapes || 0) ? R.TIER_RELIEF : 0;
      for (const st of S.stations) {
        st.burner = Math.max(R.BURNER_FLOOR, st.burner + (relief ? -relief : (spec.step || 0)));
      }
      emit('level', { level: S.level, name: spec.name, stations: S.stations.length, perfect, relief });
    }

    /* The counter grows one place at a time and between the bells, not at
     * them. A level that opened two burners at once used to do it in the same
     * frame as the banner, the new dishes and the burner step, and a player
     * who looked away for a second came back to a different game. */
    const spec = levelSpec(S.level);
    if (S.running && S.stations.length < (spec.stations || 3) && S.t >= S.nextPlaceAt) {
      addStation();
      S.nextPlaceAt = S.t + R.OPEN_MS;
      emit('place', { station: S.stations.length - 1, stations: S.stations.length });
    }
  }

  /**
   * What the dish is worth out of five, and it is the soot and nothing else.
   *
   * Not progress through the recipe: that is already on the ticket, and putting
   * it in two places wastes the one spot a player looks for quality. Five stars
   * means no dirty strum ever touched this pot, which is exactly the condition
   * for the tip, so the stars and the money always agree.
   */
  function stars(st) {
    if (!st.order) return 0;
    return Math.max(R.STARS - R.SOOT_MAX, R.STARS - st.soot);
  }

  /* How many seconds a station has left at the current rate. It is the number
   * the player actually reads: "dies in 6" is a decision, "35%" is not. */
  function life(st, silent) {
    if (!st.order) return 0;
    const rate = (st.burner + st.soot) * R.COOL * (silent ? 2 : 1);
    return st.heat / Math.max(0.1, rate);
  }

  const game = {
    rules: R,
    get state() { return S; },
    strum,
    tick,
    setRules,
    life,
    stars,
    wants,
    end,
    open,
    // A kitchen that has not opened is not silent: nobody has been asked to play yet.
    silent: () => S.started && (S.t - S.lastHitAt) >= R.BEAT_MS * R.SILENCE_BEATS,
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    /** A flat photograph, for the screen and for the tests. */
    snapshot() {
      const silent = game.silent();
      const stations = S.stations.map((st) => ({
        i: st.i,
        dish: st.order ? st.order.dish : null,
        id: st.order ? st.order.id : null,
        name: st.who ? st.who.name : null,
        face: st.who ? st.who.face : -1,
        stars: stars(st),
        steps: st.order ? st.order.steps : [],
        rn: st.order ? st.order.rn : '',
        price: st.order ? st.order.price : 0,
        /* What the dish PAYS if it goes out now: the list price times the
         * multiplier, and the tip while the pot is still clean. The tag on
         * the stove front used to print the list price, a number nothing on
         * the screen ever paid out; this one falls when a star is lost and
         * climbs with the chain, so the tag and the till always agree. */
        worth: st.order
          ? Math.round(st.order.price * S.chain * (st.soot === 0 ? R.TIP : 1) * (st.who && st.who.critic ? R.CRITIC_PAY : 1))
          : 0,
        critic: !!(st.who && st.who.critic),
        key: st.order ? st.order.key || null : null,
        step: st.step,
        /* The pan and what is in it. One ingredient per cooked step, so the pan
         * fills as the progression advances and a glance says how far the order
         * has come. `inPan` is what has already gone in, `nextIn` is what the
         * current chord will drop when it cooks. The drawing needs no arithmetic
         * and no access to the menu. */
        pan: st.order ? st.order.pan || null : null,
        ingredients: st.order && st.order.ingredients ? st.order.ingredients : [],
        inPan: st.order && st.order.ingredients ? st.order.ingredients.slice(0, st.step) : [],
        nextIn: st.order && st.order.ingredients ? st.order.ingredients[st.step] || null : null,
        wants: wants(st),
        heat: st.heat,
        // The bar the player watches, and the mark it has to clear, in the same
        // units, so the drawing never has to work the threshold out again.
        heatPct: Math.max(0, Math.min(100, st.heat)),
        readyPct: R.READY,
        ready: st.heat >= R.READY,
        soot: st.soot,
        burner: st.burner,
        life: life(st, silent),
      }));
      return {
        t: S.t, cash: S.cash, chain: S.chain, served: S.served, ruined: S.ruined,
        strikes: S.strikes, level: S.level, cycles: S.cycles, spoiled: S.spoiled,
        hits: S.hits, misses: S.misses, over: S.over, silent,
        /* Whether the first chord has been heard, and the two clocks the bar
         * prints: time since the kitchen opened, and time to the next level.
         * `t` keeps counting from the mount, which is the bench's time and
         * not the player's. */
        started: S.started,
        clock: S.started ? S.t - S.openedAt : 0,
        nextLevelIn: S.started ? Math.max(0, S.nextLevelAt - S.t) : R.LEVEL_MS,
        /* How many clean dishes in a row are still needed to win a lost
         * customer back, and `null` when nobody is lost: the strip reads it. */
        redeemIn: S.strikes > 0 ? Math.max(0, R.REDEEM_TIPS - S.tipRun) : null,
        // The counter's ceiling, so a closed card past it can say so.
        maxStations: R.MAX_STATIONS || 5,
        // The sprint's clock, counting down from the first chord; `null` for a service.
        timeLeft: R.TIME_LIMIT_MS ? Math.max(0, R.TIME_LIMIT_MS - (S.started ? S.t - S.openedAt : 0)) : null,
        /* The rest, as three numbers the screen can draw.
         *
         * The rule of this game is the step's own bar of strums and then a beat
         * of silence, and until now the beat was the one part a player had
         * to count in their head: the pots were judged at a moment nothing on
         * the screen mentioned. These say how many strums are stacked up
         * (`runOn`), whether one is waiting to be judged (`restArmed`) and how
         * much of the silence is left to run (`restIn`). They add no rule and
         * change none: they are what `tick()` is already about to do. */
        /* When the counter grows again, so the closed place can say so.
         * `null` once this level has opened everything it is going to: the
         * card then names the level that opens the next one instead. */
        /* Frozen at the full wait until the first chord: `nextPlaceAt` is
         * re-based when the kitchen opens, but `t` runs from the mount, so
         * the count on the closed card used to tick down to `0 SEC` while the
         * player was still reading the first fingering — a place that opened
         * itself, as far as the screen could tell. */
        placeIn: S.stations.length < (levelSpec(S.level).stations || 3)
          ? (S.started ? Math.max(0, S.nextPlaceAt - S.t) : R.OPEN_MS) : null,
        /* How many places this level allows, and how far apart they open: a
         * closed card the level already allows can say WHEN it opens rather
         * than name a level that has already rung. */
        allowed: levelSpec(S.level).stations || 3,
        openEvery: R.OPEN_MS,
        runOn: S.runOn,
        /* The shape the hand is holding, so the screen can say how long the bar
         * in front of it is: two pots on the same chord can be asking for three
         * strums and four, and the instruction has to name the count that will
         * actually cook something. */
        hand: S.hand,
        beatMs: R.BEAT_MS,
        levelName: S.levelName,
        levelCash: S.levelCash,
        combo: S.combo, comboBest: S.comboBest,
        // Who is at the door. Names and faces only: what they order is decided
        // when they sit down, and that depends on what is already cooking.
        queue: S.queue.map((q) => ({ name: q.name, face: q.face })),
        // The chords somebody wants right now: the detector reads this to know
        // what to listen for, and the automatic player to decide what to play.
        wants: [...new Set(stations.map((s) => s.wants).filter(Boolean))].sort(),
        stations,
      };
    },
  };

  const first = levelSpec(1);
  S.levelName = first.name || 'Service';
  fillQueue();
  // The service opens with one place; the rest arrive on the clock above.
  addStation();
  S.stations.forEach((st, i) => { st.seatAt = i * 900; });
  return game;
}
