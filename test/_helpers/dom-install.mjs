// test/_helpers/dom-install.mjs
// Side-effect module. Import this FIRST (before any code that touches
// DOM globals) to install the DOM stubs.
//
// Usage:
//   import './_helpers/dom-install.mjs';         // must be first
//   import { createLeakTracker } from '@zakkster/lite-leak';
//   import { createAmbientFX } from '../AmbientFX.js';

import { installDomStubs } from './dom-stub.mjs';
installDomStubs();
