# Changelog

All notable changes to `@zakkster/lite-ambient-fx` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] -- 2026-07-21

Runtime hardening: frame-budget auto-degrade + six new atmospheres.

### Added

- **`createFrameBudget(opts?)`** -- exported. Rolling-p90 frame-time watcher that
  steps `count` down under load and restores toward the base count when
  headroom returns. Fixed 32-slot `Float32Array` ring with bitmask indexing;
  transition callback fires only on adjustments so steady state is zero
  allocations.

- **`AmbientOptions.frameBudget`** -- `boolean | FrameBudgetOptions | null`.
  `false`/`null`/omitted is off (no behavior change from v1.3.0). `true`
  turns on defaults (targetMs 20 ms, restoreMs 14 ms, cooldown 60 frames,
  minCount 20, stepFrac 0.10). An object customises thresholds and adds an
  `onDegrade({from, to, reason, p90})` callback.

  ```js
  const fx = createAmbientFX(canvas, {
      theme: 'Aurora',
      frameBudget: {
          targetMs: 20,
          onDegrade: e => console.log('ambient-fx', e.reason, e.from, '->', e.to),
      },
  });
  ```

- **`instance.frameBudget`** -- read-only accessor for the running budget or `null`.
- **`instance.setFrameBudget(spec)`** -- swap the policy live.

- **Six new built-in atmospheres** (17 total now):
  - **Sakura** -- pink FALL petals with gentle sway and low turbulence.
  - **Fireflies** -- warm yellow FLOAT with heavy alpha pulse; sparse and meandering.
  - **Meteor Shower** -- ice-white -> orange -> deep red FALL streaks with stretch 4.5.
  - **Cosmic Drift** -- slow purple/violet EMBER with starry sparks.
  - **Sandstorm** -- horizontal tan/ochre MIST driven by heavy wind (wind.x = 2.4).
  - **Bioluminescence** -- deep aquamarine CHAOS with cyan sparks and downward pull.

- **Styled dropdown theme picker** in the demo. The 17 themes no longer fit as a
  wrapped button row -- replaced with an accessible listbox (`role="listbox"`,
  `aria-expanded`, keyboard-close via Escape, outside-click closes) that shows
  each theme's name and behavior badge.

- **Frame-budget HUD line** in the demo -- `budget: <curr>/<base>` with
  transient color highlight (green on restore, yellow on over-budget) so the
  degrader's decisions are visible under load.

### Changed

- `BuiltInTheme` union in the type declarations expanded to all 17 themes.
- Test file `test/01-config_test.mjs` updated: NAMES list and both
  "eleven themes" assertions bumped to "seventeen".
- `package.json` version -> 1.4.0. Keywords extended with
  `frame-budget`, `auto-degrade`, and the six new atmosphere names.
- `devDependencies` add `@zakkster/lite-gc-profiler`, `@zakkster/lite-leak`,
  and `@zakkster/lite-signal@^1.5.0-beta.3` (peer of lite-leak) to power
  the hardened test suite.

### Tests

- **`test/05-frame-budget_test.mjs`** -- 15 tests: construction guardrails,
  window-fill no-op, healthy-frames no-op, degrade-to-floor, cooldown spacing,
  restore-to-base, restore-ceiling, `setBaseCount` live update, `reset` wipe,
  10 000-sample zero-alloc soft check.
- **`test/07-gc-tick-hotpath_test.mjs`** -- per-behavior GC hot-path gate.
  For each of EMBER, MIST, FLOAT, CHAOS, FALL: 5000 ticks against a 500-particle
  preallocated pool under `lite-gc-profiler`; asserts `maxMajor: 0`.
- **`test/08-leak-lifecycle_test.mjs`** -- 100 mount/destroy cycles under
  `lite-leak`'s timer + listener + observer + async-retention kernels.
  Asserts both `tracker.audit()` empty and `domSnapshot()` returns to
  baseline. Catches forgotten `disconnect()` / `removeEventListener` /
  `cancelAnimationFrame`.
- **`test/09-color-pipeline-gc_test.mjs`** -- v1.3.0 color pipeline zero-alloc
  audit: `lerpTheme(a, b, t, scratch)` x 10 000, `parseColor(hex, out)` x 100 000,
  `lerpOklch(a, b, t, out)` x 100 000. All bounded to a tight minor budget.
- **`test/10-audit-differential_test.mjs`** -- differential sanity: a pooled
  tick vs a leaky tick through the same profiler; leaky must produce strictly
  more GC. Proves the audit environment itself is working before you trust
  `07`-`09`.
- **DOM stub helpers** in `test/_helpers/dom-stub.mjs`: minimal shim so the
  leak-lifecycle test runs without jsdom. Extended in v1.4.0 for
  `ctx.setTransform`, `document.createElement`.

### Bundle

- **209 tests / 35 suites, 100% pass** on Node 20+.
- `AmbientFX.js` grew to accommodate frame-budget (still one file, still zero
  runtime dependencies -- profilers are `devDependencies`, not `dependencies`).

### Not in this release

- **Worker mode (`/worker` entry)** deferred to v1.5.0. Requires syncing the
  built-in behavior bodies into a self-contained worker body and pairing with
  a conformance test to guard drift.

- **`COOKBOOK.md`** ships alongside v1.4.0 with recipes (see `COOKBOOK.md`
  at repo root).

## v1.3.0

Color pipeline pass. Identity constraint preserved: one file, zero dependencies.
OKLCH math is vendored inline (Björn Ottosson's matrices) — no import from
`@zakkster/lite-hueforge` or `@zakkster/lite-color-lerp`. Those packages remain
tree-shakeable neighbors, not runtime deps of the core file.

### Added

- **`parseColor(input, out?)`** — accepts `#rgb`, `#rrggbb`, or `oklch(L C H)`
  (with `%` on L, comma / slash separators, alpha ignored). Writes into `out`
  when supplied; otherwise allocates a `Float64Array(3)`. Aliased as
  `oklchFromHex`.

- **`formatColor(L, C, H)`** — gamut-clamped `#rrggbb`. One string allocation
  per call. Aliased as `hexFromOklch`.

- **`lerpOklch(a, b, t, out)`** — element-wise OKLCH interpolation with
  shortest-arc hue. Zero-alloc; returns `out`.

- **`colorsFromPalette(stops, opts?)`** — normalize a palette specification
  into `AmbientConfig.colors`-shaped hex[]. Duck-typed input: `string`,
  `{l, c, h}` (hueforge `ScaleStep` shape), `{L, C, H}`, `{offset, l, c, h}`,
  `{color}` wrapper, and `[position, colorOrObj]` CSS-style tuples. Optional
  `count` resamples the stops.

  ```js
  import { createScale } from '@zakkster/lite-hueforge';
  const primary = createScale({ name: 'P', base: {l: 0.55, c: 0.22, h: 268}, curve: 'ease-in-out-quad' });
  fx.updateConfig({ colors: colorsFromPalette(primary.steps()) });
  ```

- **`lerpTheme(a, b, t, out?)`** — interpolate two `AmbientConfig`s. Colors
  lerp channel-wise in OKLCH; scalars linearly; `wind` as a vector; discrete
  fields (`behavior`, `depthBands`, `stretch`) step at `t = 0.5`. When `out`
  is supplied, its `colors` array and `wind` object are reused — safe for a
  10 Hz driver.

  ```js
  const scratch = { colors: [], wind: { x: 0, y: 0 } };
  effect(() => {
    fx.updateConfig(lerpTheme(THEMES.Night, THEMES.Fire, dayCycle(), scratch));
  });
  ```

### Design notes

- **Why vendor OKLCH.** Two matrices, ~40 lines total. The "one file, zero
  dep" badge is the pitch against tsparticles; letting a Fire ↔ Frost demo
  drag in a color package would erode the moat. Confetti (its own release)
  rebases on `lite-particles` because a shared SoA layer wins there;
  ambient-fx vendors because standalone is the moat here.

- **Why 8-bit hex, not `oklch()` output strings.** Sprite cache is keyed
  by color string. Hex is the natural quantization step — same OKLCH
  triple → same hex → same cached sprite.

- **Sprite cache under long transitions.** For a wide OKLCH sweep at 60 Hz
  over 10 s the cache can grow to ≈ 400 unique hex per palette slot. At
  10 Hz over 5 s it's ≈ 50 per slot — the intended workload and no cleanup
  required. `clearAmbientSpriteCache()` is available for post-transition
  reclamation if needed.

- **Behavior transitions.** `lerpTheme` on `EMBER → MIST` steps at `t = 0.5`
  rather than blending — MIST at half-EMBER speed with EMBER's sprite size is
  not a rendering worth defining. Same-behavior transitions are the smooth
  case, and are the recommended pattern.

### Package-specific gates (green)

- 40-test v1.3.0 suite in `test/04-color-pipeline_test.mjs`.
- Round-trip: `hex → OKLCH → hex` byte-identical for the shipped palettes.
- Endpoint invariant: `lerpTheme(a, b, 0)` and `lerpTheme(a, b, 1)` scalars
  match `a` and `b` exactly.
- Determinism: same `(a, b, t)` triple → byte-identical colors, spark, wind.
- Scratch reuse: `colors` array and `wind` object are the same reference
  across successive `lerpTheme` calls.
- Every intermediate `lerpTheme` output passes `validateConfig`.
- Hueforge `ScaleStep` shape (`{step, l, c, h}`) plugs into
  `colorsFromPalette` without adaptation.

### Not in this release

- No `lite-hueforge` runtime import — deferred indefinitely, see design note.
- No CSS Color 4 chroma-direction gamut mapping — the extra 30 lines don't
  pay their way for a sprite-blurred particle.
- No `oklch()` output format — see design note above.
- Web Worker / OffscreenCanvas mode — deferred to v1.4.0 (per roadmap).

## [1.2.0] — 2026-07-14

### Added
- **`FALL` behavior** — the fifth built-in, and the gap the original four left: EMBER rises, FLOAT rises with sway, MIST drifts laterally, CHAOS goes everywhere, and nothing fell. Per-particle terminal velocity scaled by depth, plus phase/speed/amplitude sway advanced per frame (no wall-clock reference, so it cannot drift out of integer range). Widens the spawn band into the wind so a strong `wind.x` doesn't starve the upwind edge.
- **`Snow` and `Rain` presets**, both on FALL with 3 depth bands.
- **`cfg.stretch`** (FALL, optional) — elongates the sprite along the fall vector. A round blob becomes a streak; that is the entire difference between Snow and Rain.
- **`cfg.depthBands`** (`0 | 2 | 3`, optional) — parallax depth bands. Every behavior already scales size, alpha, and per-frame movement by `z`, so quantizing `z` at spawn *is* the parallax: no extra draw pass, no per-frame cost. Absent means the original continuous ramp, so every pre-1.2 preset is pixel-identical.
- **`sampleDepth(bands)`** — the pure depth sampler, exported.
- **Pointer reactivity** — `createAmbientFX(canvas, { pointer: { mode: 'repel' | 'attract' | 'off', radius, strength } })`, plus `instance.setPointer(partial)` and `instance.pointer`. Force falls off on a precomputed 64-entry cosine LUT (bitmask-indexed, same trick as `sinLut`) and is scaled by particle depth, so near particles shove hard and far ones barely move — which is what makes the depth bands read as actual distance.
  - Implemented as **one pass over the pool in the instance loop, before `behavior.tick`** — not inside any tick loop. Every behavior therefore gets pointer reactivity for free, *including third-party ones registered via `registerBehavior`*, which never learn the feature exists. Costs one branch per frame when off.
  - Listeners bind to `window`, not the canvas: an ambient backdrop is typically behind the UI or under `pointer-events: none`, so canvas-local events would never fire. The canvas origin is cached at resize — calling `getBoundingClientRect()` inside a `pointermove` handler would force a layout on every mouse move.
  - Disabled under `prefers-reduced-motion`. WCAG 2.3.3 is literally titled *Animation from Interactions*.
- **`resolvePointer(spec)`** — the pure pointer-spec normalizer/validator, exported.

### Changed
- `makeParticle` gains four fields (`terminal`, `driftPhase`, `driftSpeed`, `driftAmp`) so the monomorphic shape still covers the union of all behaviors. Every existing spawn zeroes them, per the contract. The shape test caught this immediately, as designed.
- `validateConfig` accepts `depthBands` and `stretch` as **optional** — absent means off — so every pre-1.2 preset and every already-registered custom theme keeps validating unchanged.
- Test suite: 106 → 136. The FALL physics are tested against the `{spawn, tick}` contract directly (terminal-velocity clamp, depth correlation, sway on/off, edge recycle, streak geometry) rather than through the closed pool.

### Notes
- **`FALL` does not replace `@zakkster/lite-snow` or `@zakkster/lite-rain`.** Those are weather *simulations* — SoA `Float32Array` pools, seconds-based integration, ground accumulation and melt, splash and bounce, 8–10k particles, path-batched rendering — and they depend on `@zakkster/lite-color`. This is an ambient *backdrop*: AoS monomorphic particles, per-frame units, no ground, a fixed recycled pool, sprite-cached `drawImage`, zero dependencies. The physics ideas were ported; the code could not be. See "Ecosystem positioning" in the README.
- Still **one file, zero dependencies**.

## [1.1.0] — 2026-07-14

### Added
- **`registerTheme(name, config, meta?)`** — `THEMES` is now a runtime-extensible registry, like `BEHAVIORS`. A registered theme is instantly usable via `createAmbientFX({ theme })` and `setTheme()`, and is mirrored into `THEME_META`, so playgrounds and theme pickers built against `THEME_META` keep working with no code change. Optional `meta` sets the display name and icon; overriding a built-in preserves its curated meta unless you replace it. Returns the validated config.
- **Three new presets on existing behaviors**: `Dust` (FLOAT — earthy tan motes on a slow draft), `Aurora` (MIST — wide cyan/green/violet curtains at very low alpha), `Abyss` (CHAOS — deep indigo flicker with cyan sparks). `Snow`, and the `FALL` behavior it needs, are deferred to v1.2.0.
- **`prefers-reduced-motion` support**, on by default, zero developer effort. When the query matches, the instance renders a degraded config — count clamped to `8..40`, speed `×0.35`, turbulence `×0.6` — with palette, spark, and behavior preserved so the atmosphere stays recognizable. Opt out with `reducedMotion: false`. Follows the lite-confetti ecosystem precedent.
  - Tracked **live** via a `matchMedia` `change` listener, torn down in `destroy()`. Flipping the OS setting mid-session degrades or restores without a reload; a construction-time snapshot would have left the user stuck until reload.
  - The degrade is re-applied after `setTheme()` **and** `updateConfig()`. A user's accessibility preference outranks a developer's `count` knob; `reducedMotion: false` is the escape hatch.
- **`instance.baseConfig`** — the config as requested, before any degrade. `instance.config` continues to report what is actually rendering.
- **`instance.reducedMotion`** — live boolean, true while the degrade is active.
- **`degradeForReducedMotion(cfg)`** — the pure transform, exported for tests and reuse.

### Fixed
- **`THEMES` is now null-prototype**, matching `BEHAVIORS`. As a plain object literal it inherited from `Object.prototype`, so `THEMES['constructor']` and `THEMES['toString']` were truthy — enough to slip past the `if (!themeBase)` guard in `createAmbientFX` and reach `mergeThemeConfig` with a function. Worse, once `registerTheme` existed, `registerTheme('__proto__', cfg)` would have hit the inherited `__proto__` setter and reassigned the registry's prototype instead of storing a theme. Latent in v1.0.0; a live hazard the moment `THEMES` became writable by callers. `Object.keys`, spread, and `JSON.stringify` are unaffected; only `THEMES.hasOwnProperty(...)` changes (use `Object.hasOwn`).
- **`validateConfig` now guards the fields the tick loops read raw** — `wind.x`/`wind.y`, `decay`, `speed`, `size`, `turbulence`, and `spark` were never checked. A config missing any of them passed validation, then produced `undefined` in the hot loop → `NaN` positions → every particle silently vanished, with no throw and no warning. Harmless while `THEMES` was a closed set of complete presets; a real hole the moment `registerTheme` started accepting third-party configs. Non-finite and negative values are rejected too.

### Changed
- `setTheme()` and `updateConfig()` now re-derive the render config from a single `baseCfg` source of truth instead of mutating `cfg` in place. Behavior is identical when reduced-motion is inactive.
- Unknown-theme errors now list the registered theme names, matching `resolveBehavior`'s error shape.
- `ThemeName` in `.d.ts` widened to `BuiltInTheme | (string & {})` for runtime-registered themes; `AmbientOptions` documents `reducedMotion`.
- Test suite: 70 → 106.

### Notes
- All v1.0.0 APIs and runtime behavior are preserved. The `validateConfig` tightening is the one semantic change: configs that used to be silently accepted and then render nothing now throw. Every built-in preset still validates.
- Still **one file, zero dependencies**.

## [1.0.0] — 2026-07-11

Initial public release. Extracted, cleaned up, and hardened from a private
scratch-card game where the atmosphere layer had to render behind live UI
at 60fps without touching the reactive graph.

### Added
- `createAmbientFX(canvas, options)` -- mount an atmosphere on any canvas.
- Six shipped presets: `Fire`, `Night`, `Ice`, `Frost`, `Toxic`, `Void`.
- Four particle behaviors: `EMBER`, `MIST`, `FLOAT`, `CHAOS`.
- `BEHAVIORS` registry + `registerBehavior(name, def)` for adding custom
  behaviors without touching the core.
- Pooled per-frame `FrameContext` (`{ cfg, W, H, dt, ds, timestamp,
  isInit, getSprite, respawn }`) passed to every spawn/tick call; owned
  by the instance and mutated in place, zero allocation per frame.
- Live-tweakable knobs via `updateConfig` -- count, alpha, size, speed,
  decay, turbulence, wind (shallow-merged), colors, spark, behavior.
- `setTheme(name)` -- instant preset swap with sprite-cache eviction.
- `pause()` / `resume()` -- manual RAF control (visibility auto-pause remains).
- `destroy()` -- releases RAF handle, visibility listener, ResizeObserver,
  and evicts sprites owned by the instance.
- Full TypeScript declarations in `AmbientFX.d.ts`, including
  `BehaviorDefinition`, `FrameContext`, and `Particle` interfaces.
- 70-test suite across `test/01-config_test.mjs`,
  `test/02-runtime_test.mjs`, and `test/03-registry_test.mjs`.
- Playground demo under `demo/index.html` with theme picker, live slider
  panel, and CRT-phosphor aesthetic.

### Performance
- **Zero string allocation in the sprite cache** -- switched to a nested
  `Map<color, Map<physicalSize, canvas>>` instead of concatenating a
  `${color}:${size}` key on every lookup.
- **`spriteCanvas` cached on the particle at spawn time** -- the render
  loop reads `p.spriteCanvas` directly, so `getSprite` is only called at
  spawn (rare) rather than per particle per frame (18k times/sec for a
  Fire preset before this fix).
- **Monomorphic particle shape** -- every particle carries the union of
  all behavior-specific fields from the moment it's pushed to the pool.
  No property is added or removed at runtime; V8's hidden class stays
  stable across theme/behavior swaps.
- **Behavior dispatch hoisted out of the render loop** -- one lookup per
  frame instead of one branch per particle per frame. Each behavior owns
  a dedicated tick loop; the branch predictor sees a single path.
- **`Math.trunc` for the CHAOS flicker phase** -- avoids the 32-bit
  signed cast in `timestamp >> 7` that would wrap negative after
  ~24 days of `performance.now()` accumulation.
- **Div-to-mul strength reduction on alpha envelopes** -- `p.life / 0.2`,
  `/ 0.8`, `/ 0.1` in EMBER/FLOAT hot loops replaced with multiplications
  by pre-computed reciprocals (`EMBER_FADE_IN_INV`, `EMBER_FADE_OUT_INV`,
  `FLOAT_FADE_INV`). Same math, cheaper op per particle per frame.
- **Named module constants for repeat literals** -- `DEG_TO_RAD` for the
  LUT init, `MIST_LIFE_WRAP_MS` for the MIST accumulator wrap,
  `RESPAWN_MARGIN_Y` for the EMBER/FLOAT top-edge margin. No hot-path
  wins on their own (JITs fold these), but they make intent obvious and
  prevent drift.
- **Dead `const cfg = frame.cfg` removed from CHAOS tick** -- CHAOS
  doesn't read cfg during the loop; the destructure was pure noise.
- **MIST margin collapse** -- `marginX` and `marginY` were always equal
  (`cfg.size + 100`); collapsed to a single `margin` local.

### Notes
- Zero runtime dependencies. Single-file ESM.
- `sideEffects: false` in `package.json` for tree-shaking.
- Copyright: Zahary Shinikchiev.
- First-frame primed via a `lastTime = -1` sentinel; `timestamp === 0`
  is now a valid raf callback (matters only for tests / non-browser
  drivers -- real `performance.now()` is always > 0 at raf time).
