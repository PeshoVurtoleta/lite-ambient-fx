# Changelog

All notable changes to `@zakkster/lite-ambient-fx` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
