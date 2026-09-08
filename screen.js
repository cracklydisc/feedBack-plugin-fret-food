/*
 * The entry shim, and it is one line for a precise reason.
 *
 * The host serves this file at `/api/plugins/fret-food/screen.js` whatever it is
 * called on disk. Put the game itself in here and every `import './engine.js'`
 * would resolve against `/api/plugins/fret-food/` and fall outside the route that
 * serves modules, which is `/api/plugins/fret-food/src/`. Importing from here
 * instead, the whole module graph resolves inside `src/` and the host serves it
 * without needing to know anything about it.
 */
import './src/game.js';
