import { memoryStorage } from './helpers.js';

// The game code expects a browser; give it just enough of one.
globalThis.window = globalThis.window || {};
globalThis.localStorage = memoryStorage();
