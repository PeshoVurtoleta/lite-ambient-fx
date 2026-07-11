# Changelog

All notable changes to `@zakkster/lite-ambient-fx` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
