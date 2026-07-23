# @zakkster/lite-ambient-fx

> Fullscreen ambient particle atmospheres. Six themed presets across four behaviors. Sprite-cached, DPR-aware, resize-preserving, visibility-paused. One file. Zero dependencies.

[![npm version](https://img.shields.io/npm/v/@zakkster/lite-ambient-fx.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/@zakkster/lite-ambient-fx)
![Zero-GC](https://img.shields.io/badge/Zero--GC-Hot%20path-00C853?style=for-the-badge&logo=leaf&logoColor=white)
[![sponsor](https://img.shields.io/badge/sponsor-PeshoVurtoleta-ea4aaa.svg?logo=github)](https://github.com/sponsors/PeshoVurtoleta)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@zakkster/lite-ambient-fx?style=for-the-badge)](https://bundlephobia.com/result?p=@zakkster/lite-ambient-fx)
[![npm downloads](https://img.shields.io/npm/dm/@zakkster/lite-ambient-fx?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-ambient-fx)
[![npm total downloads](https://img.shields.io/npm/dt/@zakkster/lite-ambient-fx?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-ambient-fx)
![Tree-Shakeable](https://img.shields.io/badge/tree--shakeable-yes-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-Types-informational)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)


Extracted from a scratch-card game where the atmosphere layer had to render behind live UI at 60fps without touching the reactive graph. Six presets ship out of the box; every knob is live-tweakable; the whole thing fits in one `<script type="module">` and one `<canvas>` tag.

```
npm install @zakkster/lite-ambient-fx
```

```js
import { createAmbientFX } from "@zakkster/lite-ambient-fx";

const canvas = document.getElementById("bg");
const fx = createAmbientFX(canvas, { theme: "Void" });

// live-tweak later
fx.updateConfig({ count: 250, alpha: 0.85 });

// or swap the whole preset
fx.setTheme("Fire");
```

That's the whole surface for the common case. Full API below.

---

## Worker mode (v1.7.0)

Run the whole atmosphere off the main thread on an `OffscreenCanvas`:

```js
import { createAmbientFXWorker } from '@zakkster/lite-ambient-fx/worker';

const fx = createAmbientFXWorker(canvas, { theme: 'Aurora' });
await fx.ready;
```

This is a **separate export path**. The core file stays zero-dependency and
single-file; `@zakkster/lite-worker` is an optional peer that is only resolved
if you import `/worker`. When the environment cannot do worker mode,
`createAmbientFXWorker` transparently returns a main-thread instance behind the
same interface (`fx.mode` tells you which), so there is one code path either
way. See COOKBOOK recipe 17.

## Table of contents

- [What it looks like](#what-it-looks-like)
- [Why this exists](#why-this-exists)
- [What you get](#what-you-get)
- [The six shipped presets](#the-six-shipped-presets)
- [The four behaviors](#the-four-behaviors)
- [API reference](#api-reference)
- [Configuration knobs](#configuration-knobs)
- [Sizing, DPR, and resize](#sizing-dpr-and-resize)
- [Performance notes](#performance-notes)
- [Browser and runtime support](#browser-and-runtime-support)
- [Integration recipes](#integration-recipes)
- [Testing](#testing)
- [Ecosystem](#ecosystem)
- [FAQ](#faq)
- [License](#license)

---

## What it looks like

Run the playground locally:

```
git clone https://github.com/PeshoVurtoleta/lite-ambient-fx
cd lite-ambient-fx
npx serve .
# open http://localhost:3000/demo/
```

The playground includes a theme picker, a live slider panel, and an FPS/count HUD, over a CRT phosphor-grid backdrop.

---

## Why this exists

Landing pages, game menus, splash screens, and dashboards want an atmosphere. The two available paths were both bad:

1. **Ship a general-purpose particle engine** — [tsparticles](https://github.com/tsparticles/tsparticles) covers everything, but it's ~200KB gzipped and its config surface is a small language. You spend an hour picking values before you see anything.
2. **Hand-roll it** — twenty times, badly, every time. The DPR gets forgotten, the resize handler resets the whole simulation, the sprite cache is a memory leak, the `visibilitychange` handler is missing, and the frame delta is unclamped so a tab wake-up nukes the sim.

`lite-ambient-fx` is the middle path: **six curated presets** you drop in with one line, **four particle behaviors** underneath them, and **one file** of code. Every hard-earned lesson from re-writing the same 400 lines is baked in.

Constraints it was built under:

1. **One file, one dep-free import.** Nothing to configure, nothing to bundle, nothing to keep in sync.
2. **Presets are the API.** Users pick a name, not a config tree.
3. **Live-tweakable.** `updateConfig({ count: 200 })` works mid-run without a re-init.
4. **Well-behaved.** DPR-aware, resize-preserving, visibility-paused, delta-time clamped.

---

## What you get

- **`createAmbientFX(canvas, options)`** — mount an atmosphere on any canvas element.
- **`setTheme(name)`** — swap to a preset.
- **`updateConfig(overrides)`** — change any knob live (count, alpha, size, speed, decay, turbulence, wind, colors).
- **`pause()` / `resume()`** — manual control over the RAF loop (visibility already handles auto-pause).
- **`destroy()`** — release everything: RAF handle, visibility listener, ResizeObserver, sprite cache.
- **`config`** — a defensive-copy read of the current settings.
- **`THEMES` / `THEME_META`** — the preset table plus UI-builder metadata.
- **`clearAmbientSpriteCache()`** — targeted or full sprite eviction.
- **Pure helpers** — `mergeThemeConfig`, `validateConfig`, `envelopeAlpha`, `sinLut`, `deltaScale` — exported so tests and downstream consumers can share the math.

Full types in [`AmbientFX.d.ts`](./AmbientFX.d.ts).

---

## Ecosystem positioning

`lite-ambient-fx` FALL is **not** a replacement for [`@zakkster/lite-snow`](https://github.com/PeshoVurtoleta/lite-snow) or [`@zakkster/lite-rain`](https://github.com/PeshoVurtoleta/lite-rain). They solve different problems and are built on opposite architectures:

| | `lite-snow` / `lite-rain` | `lite-ambient-fx` (FALL) |
| --- | --- | --- |
| **Job** | Weather *simulation* | Ambient *backdrop* |
| Ground | Accumulation + melt / splash + bounce | None — particles recycle at the edges |
| Pool | Density emission into 8–10k slots | Fixed `count`, recycled |
| Memory | SoA (parallel `Float32Array`s) | AoS, monomorphic particle objects |
| Render | Path batching (`beginPath` → N arcs → one `fill`) | Sprite-cached gradients, `drawImage` |
| Deps | `@zakkster/lite-color` | **Zero** |

Reach for **`lite-snow` / `lite-rain`** when the weather *is* the thing — when you need drops that splash, flakes that settle and melt, and thousands of particles under a real seconds-based integrator.

Reach for **`lite-ambient-fx`** when the weather is *behind* the thing — an atmosphere layer that sits under live UI at 60fps, next to Fire and Aurora, sharing one theme picker, one sprite cache, and one zero-dependency file.

The `Snow` and `Rain` presets here are backdrops. They are the cheap cousin, and that is on purpose.

---

## The twenty-three shipped presets

| Preset   | Behavior | Vibe                                                        |
| -------- | -------- | ----------------------------------------------------------- |
| `Fire`   | EMBER    | Orange-yellow embers rising with mild leftward wind          |
| `Night`  | EMBER    | Cooler gold sparks with rightward drift; fewer particles     |
| `Ice`    | MIST     | Large breathing blue-white fog blobs drifting horizontally   |
| `Frost`  | MIST     | Pale off-white lavender fog, slower drift                    |
| `Toxic`  | FLOAT    | Neon green particles rising with sine-wave horizontal sway   |
| `Void`   | CHAOS    | Fast omnidirectional purple particles with 8Hz flicker       |
| `Dust`   | FLOAT    | Earthy tan motes on a slow rightward draft *(v1.1)*          |
| `Aurora` | MIST     | Wide cyan-green-violet curtains, very low alpha *(v1.1)*     |
| `Abyss`  | CHAOS    | Deep indigo flicker with cyan sparks *(v1.1)*                |
| `Snow`   | FALL     | Banded snowfall, per-flake terminal velocity + sway *(v1.2)* |
| `Rain`   | FALL     | Fast stretched streaks on a hard sidewind *(v1.2)*           |
| `Sakura`          | FALL     | Pink petals with gentle sway and low turbulence *(v1.4)*   |
| `Fireflies`       | FLOAT    | Warm yellow float with heavy alpha pulse; sparse *(v1.4)*  |
| `Meteor`          | FALL     | White->orange->red streaks with heavy stretch *(v1.4)*     |
| `Cosmic`          | EMBER    | Slow purple/violet rise with starry sparks *(v1.4)*        |
| `Sandstorm`       | MIST     | Horizontal tan/ochre driven by a heavy wind *(v1.4)*       |
| `Bioluminescence` | CHAOS    | Deep aquamarine CHAOS with cyan sparks *(v1.4)*            |
| `MoltenGold`      | EMBER    | Gold droplets rising with warm screen glow *(v1.5)*        |
| `ShadowWisp`      | MIST     | Deep-purple wisps drifting in the dark *(v1.5)*            |
| `Stardust`        | FLOAT    | Twinkling blue-white float with screen glow *(v1.5)*       |
| `NeonGlitch`      | CHAOS    | Fast cyan/magenta electric flashes, lighter blend *(v1.5)* |
| `SolarFlare`      | EMBER    | Intense white-to-red flare, dense count, lighter *(v1.5)*  |
| `ToxicBubble`     | FLOAT    | Big rising green bubbles with screen glow *(v1.5)*         |

Every preset is a full `AmbientConfig`; you can inspect them at `THEMES[name]` and copy any field into `overrides`. Add your own with [`registerTheme`](#adding-a-custom-theme).

---

## The five behaviors

| Behavior  | Motion                                              | Life model                                              | Best for                             |
| --------- | --------------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| **EMBER** | Rise with wind + turbulence; ~15% "super" sparks    | 0 → 1 progress; fade-in 0–0.2, fade-out 0.2–1           | Fire, sparks, dust motes             |
| **MIST**  | Slow horizontal drift; wrap at edges; sine breathe  | ms accumulator; wraps at 72s to avoid Float32 drift     | Fog, clouds, dense atmosphere        |
| **FLOAT** | Rise with sine-wave horizontal sway (no turbulence) | 0 → 1 progress; fade-in 0–0.1, sustain, fade-out 0.9–1  | Bubbles, spores, gentle rain of dust |
| **CHAOS** | Random omnidirectional velocity, straight lines    | 0 → 1 progress; ~7.8Hz bit-flicker on alpha             | Void energy, static, glitch fields   |

All four share:

- Delta-time scaling to `dt / 16` (60fps reference).
- Per-particle depth `z ∈ [0.2, 1.0]` that modulates size, velocity, and max alpha for a parallax feel.
- A shared 360-entry sine LUT (`Float32Array`) for turbulence and MIST breathing.

---

## API reference

### `createAmbientFX(canvas, options?)`

Mount an atmosphere on a canvas. The canvas is expected to be a fullscreen overlay (see [Sizing, DPR, and resize](#sizing-dpr-and-resize)).

```js
const fx = createAmbientFX(canvas, {
    theme: "Fire",                                // preset name (default: "Fire")
    overrides: { count: 400, alpha: 0.9 },        // partial config, merged over theme
    autoStart: true,                              // start the RAF loop (default: true)
    reducedMotion: true,                          // respect prefers-reduced-motion (default: true)
    pointer: { mode: "repel", radius: 140, strength: 8 },   // default: { mode: "off" }
});
```

Returns an `AmbientInstance`.

### `AmbientInstance`

```ts
interface AmbientInstance {
    setTheme(name): void;               // swap to another preset
    updateConfig(overrides): void;      // change any knob live
    readonly config: AmbientConfig;     // what is actually rendering (post-degrade)
    readonly baseConfig: AmbientConfig; // what you asked for (pre-degrade)
    readonly reducedMotion: boolean;    // is the degrade currently active
    readonly theme: ThemeName;          // current theme name
    readonly pointer: ResolvedPointer;  // { mode, radius, strength }
    setPointer(next): void;             // change pointer reactivity live
    readonly count: number;             // live particle count
    readonly running: boolean;          // RAF loop state
    pause(): void;                      // stop RAF (idempotent)
    resume(): void;                     // restart RAF (idempotent)
    destroy(): void;                    // release everything (idempotent)
}
```

### Named exports

- `THEMES` — the theme registry, keyed by name. Nine built-in entries at module load. Null-prototype.
- `THEME_META` — `Array<{ id, name, icon, behavior }>` for UI builders. `registerTheme` keeps it in sync.
- `registerTheme(name, config, meta?)` — install a custom theme or replace a built-in.
- `BEHAVIORS` — the behavior registry, keyed by name. Four built-in entries at module load.
- `registerBehavior(name, def)` — install a custom behavior or replace a built-in.
- `degradeForReducedMotion(cfg)` — the pure reduced-motion transform, exported for reuse.
- `sampleDepth(bands)` — the parallax depth sampler. `2` or `3` bands, or the continuous ramp.
- `resolvePointer(spec)` — normalize + validate a pointer spec, filling in defaults.
- `VERSION` — the package version string.
- `mergeThemeConfig(base, overrides)` — pure config merge; shallow-merges the `wind` vector.
- `validateConfig(cfg)` — throws on the first structural violation, returns the input on success.
- `envelopeAlpha(mode, life, maxAlpha)` — the fade curve per built-in behavior.
- `sinLut(index)` — sign-safe LUT access.
- `deltaScale(dtMs)` — `dtMs / 16`.
- `clearAmbientSpriteCache(colors?)` — evict sprites by color, or the whole cache.

---

## Parallax depth bands

Every behavior already multiplies size, alpha, and per-frame movement by a particle's `z`. So `z` is the correlation hub — and quantizing it into discrete layers *is* the parallax. No second draw pass, no per-frame cost, nothing but a different number picked at spawn.

```js
createAmbientFX(canvas, { theme: "Fire", overrides: { depthBands: 3 } });
```

| `depthBands` | Effect |
| --- | --- |
| omitted / `0` | Continuous `z` ramp — the original v1.0 look. Every pre-1.2 preset. |
| `2` | Two layers at `z ≈ 0.3` / `0.9`. Maximum separation, strongest depth read. |
| `3` | Three layers at `z ≈ 0.3` / `0.6` / `0.9`. What `Snow` and `Rain` ship with. |

Because it's spawn-time only, turning it on costs nothing at runtime — and turning it *off* is the default, so no existing preset changed.

---

## Pointer reactivity

```js
const fx = createAmbientFX(canvas, {
    theme: "Snow",
    pointer: { mode: "repel", radius: 160, strength: 12 },
});

fx.setPointer({ mode: "attract" });   // live, partial — radius/strength persist
fx.setPointer({ mode: "off" });       // detaches the listeners entirely
```

The force falls off on a precomputed cosine curve (a 64-entry LUT, indexed with a bitmask — the same trick as `sinLut`) and is **scaled by particle depth**, so near particles shove hard and far ones barely register. That depth scaling is what makes the parallax bands read as actual distance rather than just size variation.

Three things worth knowing about how it's built:

1. **It is not in any tick loop.** It's a single pass over the pool in the instance loop, *before* the behavior ticks. That means every behavior gets pointer reactivity for free — including a custom one you register via `registerBehavior`, which never learns this feature exists. When the pointer is off, the cost is one branch per frame.
2. **Listeners go on `window`, not the canvas.** An ambient backdrop usually sits behind the UI or under `pointer-events: none`, so canvas-local events would never fire. The canvas origin is cached at resize — reading `getBoundingClientRect()` inside a `pointermove` handler would force a layout on every mouse move.
3. **It's off under reduced motion.** WCAG 2.3.3 is literally titled *Animation from Interactions*; a user who asked for less motion did not ask for particles to chase their cursor.

---

## Reduced motion

A fullscreen animated background is precisely what [WCAG 2.3.3 / `prefers-reduced-motion`](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html) is aimed at. So this is **on by default and costs you nothing**:

```js
createAmbientFX(canvas, { theme: "Fire" });   // already respects the preference
```

When `prefers-reduced-motion: reduce` matches, the instance renders a degraded config — particle count clamped to `8..40`, speed at `0.35×`, turbulence at `0.6×`. The palette, spark, and behavior are untouched, so the atmosphere still *reads* as Fire or Aurora; it just stops moving much.

Three details worth knowing:

1. **It's tracked live.** Flip the OS setting mid-session and the instance degrades or restores without a reload. The listener is torn down in `destroy()`.
2. **The preference outranks your knobs.** While reduced, `setTheme()` and `updateConfig({ count: 500 })` are still degraded — `baseConfig` remembers what you asked for, `config` reports what's actually rendering. This is deliberate: a user's accessibility setting should not be overridable by a `count` slider.
3. **Opt out explicitly** with `reducedMotion: false` if you need full control (e.g. you're already gating the whole canvas yourself).

For a fully static single frame, pause immediately after mounting:

```js
const fx = createAmbientFX(canvas, { theme: "Frost" });
if (fx.reducedMotion) fx.pause();   // one composed frame, then nothing moves
```

---

## Frame budget (v1.4.0)

Opt-in auto-degrade. The tick loop tracks a rolling 32-sample window of frame
times and steps `count` down when p90 exceeds `targetMs`, restoring toward the
base when headroom returns. Zero allocations in steady state -- the callback
fires only on transitions.

```js
const fx = createAmbientFX(canvas, {
    theme: 'Aurora',
    frameBudget: {
        targetMs: 20,        // p90 above 20 ms -> degrade
        onDegrade: (e) => console.log(e.reason, e.from, '->', e.to),
    },
});

fx.frameBudget.currentCount;     // what's actually rendering
fx.frameBudget.baseCount;        // the current ceiling for restore
fx.setFrameBudget({ targetMs: 16 });   // swap the policy live
fx.setFrameBudget(null);         // disable
```

Full options: `targetMs` (default 20), `restoreMs` (default `targetMs * 0.7`),
`cooldown` (default 60 frames), `stepFrac` (default 0.10), `minCount`
(default 20), `onDegrade`. `createFrameBudget(opts)` is also exported for
standalone use with a custom render loop.

Compatible with reduced-motion -- the restore ceiling tracks the effective
`cfg.count`, so restore never blows through the accessibility floor. See
`COOKBOOK.md` recipe 7 for a fuller walkthrough.

---

## Blend modes (v1.5.0)

Optional `blendMode` field on the config. Sets `ctx.globalCompositeOperation`
before the tick draws. Six shipped themes use this: `MoltenGold`, `Stardust`,
`ToxicBubble` on `'screen'`; `NeonGlitch`, `SolarFlare` on `'lighter'`;
`ShadowWisp` on plain `'source-over'`.

```js
fx.updateConfig({ blendMode: 'lighter' });   // additive glow
```

Every canvas 2D composite mode is accepted; `validateConfig` catches typos.
Default when omitted is `'source-over'` (backward-compatible with earlier
themes, none of which shipped a blend mode).

---

## Curves (v1.6.0)

Two optional fields, `alphaCurve` and `sizeCurve`, sample a piecewise-linear
curve at `life` (0 -> 1) and multiply the behavior's alpha and size outputs.
Six shipped themes use these to match their `@zakkster/lite-fx-pro` parent
presets:

```js
fx.updateConfig({
    alphaCurve: [0, 1, 0],    // 3-point: fade in and out
    sizeCurve:  [1, 3],       // 2-point: grow to 3x by end of life
});
```

Curves are arrays of `>= 2` finite numbers. `[a, b]` linear, `[a, b, c]`
piecewise via midpoint, `[k0..kN]` piecewise across N segments. The exported
`sampleCurve(curve, t)` is available if you need it in a custom loop.

Backward-compatible: absent curves mean identical rendering to v1.5.0.
Present curves compound with the behavior's built-in alpha shape.

---

## Adding a custom theme

`THEMES` is a registry, not a constant. Register a complete `AmbientConfig` and it becomes immediately available to `createAmbientFX({ theme })` and `setTheme()` — and appears in `THEME_META`, so an existing theme picker shows it with no code change.

```js
import { registerTheme, createAmbientFX } from "@zakkster/lite-ambient-fx";

registerTheme("Rust", {
    behavior: "FLOAT",
    colors: ["#b7410e", "#8b4513", "#cd853f"],
    spark: "#ffd7a0",
    count: 90,
    wind: { x: 0.2, y: -0.05 },
    decay: 0.001,
    speed: 0.5,
    size: 7,
    alpha: 0.55,
    turbulence: 0.35,
}, { name: "Rust Belt", icon: "wind" });   // meta is optional

createAmbientFX(canvas, { theme: "Rust" });
```

The config must be **complete** — `registerTheme` runs it through `validateConfig`, which rejects a missing `wind`, `size`, `speed`, `decay`, or `turbulence` rather than letting them reach the tick loop as `undefined` and silently NaN out every particle position.

Overriding a built-in keeps its curated `THEME_META` name and icon unless you pass new ones:

```js
registerTheme("Fire", { ...THEMES.Fire, count: 80 });   // still "Inferno" in the picker
```

---

## Adding a custom behavior

The four shipped behaviors are just entries in the `BEHAVIORS` registry. Adding a fifth is a two-file change: register it, then reference it from a config.

```js
import { registerBehavior, createAmbientFX } from "@zakkster/lite-ambient-fx";

registerBehavior("SNOW", {
    spriteLogical: 64,     // CSS-pixel sprite size for this behavior
    spawn(p, frame) {
        // Populate every field of `p`. NEVER add new fields.
        const cfg = frame.cfg;
        p.z = Math.random() * 0.8 + 0.2;
        p.color = cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, 64);
        p.life = 0;
        p.x = Math.random() * frame.W;
        p.y = frame.isInit ? Math.random() * frame.H : -20;
        p.size = (Math.random() * cfg.size + 4) * p.z;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = cfg.speed * (0.5 + Math.random() * 0.5);
        p.decay = cfg.decay;
        p.maxAlpha = cfg.alpha * p.z;
        // Zero the MIST-only slots to keep the monomorphic shape stable.
        p.anchorX = 0; p.anchorY = 0; p.pulseOffset = 0;
    },
    tick(particles, ctx, frame) {
        const ds = frame.ds;
        const respawn = frame.respawn;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.y += (p.vy + frame.cfg.wind.y) * p.z * ds;
            p.x += (p.vx + frame.cfg.wind.x) * p.z * ds + Math.sin(p.y * 0.02) * 0.3;
            p.life += p.decay * ds;
            if (p.y > frame.H + 20 || p.life >= 1) { respawn(p, false); continue; }
            ctx.globalAlpha = p.maxAlpha;
            const half = p.size * 0.5;
            ctx.drawImage(p.spriteCanvas,
                (p.x - half) | 0, (p.y - half) | 0,
                p.size | 0, p.size | 0);
        }
    },
});

// Then wire it up with any theme:
createAmbientFX(canvas, {
    theme: "Ice",
    overrides: { behavior: "SNOW" }, // switches behavior, keeps Ice's palette
});
```

**Rules the registry enforces on you**:

1. `spawn` must populate **every** field of `p`. Do not add new fields — `p` is a monomorphic object initialized with the union of all built-in behavior fields; V8 uses a stable hidden class for it, and adding a property mid-run causes a deopt.
2. `spawn` must set `p.spriteCanvas` via `frame.getSprite(color, spriteLogical)` — this is the DPR-aware path, and it caches the resolved canvas on the particle so the hot loop pays no lookup cost.
3. `tick` may call `frame.respawn(p, false)` on dead particles to recycle them in place.
4. `frame` is pooled — do not retain references to it or its slots past the current call.

The `Particle` and `FrameContext` interfaces are exported from `AmbientFX.d.ts` for TS consumers.

---

## Configuration knobs

Every preset is an `AmbientConfig`:

| Key          | Type          | Meaning                                                                                 |
| ------------ | ------------- | --------------------------------------------------------------------------------------- |
| `behavior`   | `Behavior`    | `"EMBER" \| "MIST" \| "FLOAT" \| "CHAOS"`                                               |
| `colors`     | `string[]`    | Base palette; particles pick uniformly at random                                        |
| `spark`      | `string`      | Rarer highlight color (~10% chance per spawn)                                           |
| `count`      | `number`      | Live particle count                                                                     |
| `wind`       | `{ x, y }`    | Constant advection vector per frame                                                     |
| `decay`      | `number`      | Per-frame life increment (smaller = longer-lived)                                       |
| `speed`      | `number`      | Base velocity magnitude                                                                 |
| `size`       | `number`      | Sprite draw size; small (2–30) for EMBER/FLOAT/CHAOS, large (50–500) for MIST           |
| `alpha`      | `number`      | Alpha cap, clamped to `[0, 1]`; multiplied by per-particle `z` for depth                |
| `turbulence` | `number`      | Amplitude of the sin-LUT lateral turbulence                                             |

**Live-update semantics:** `updateConfig` changes take effect for **new spawns**; particles alive at the moment of the change keep the values they were spawned with until they die and respawn. This is intentional — it lets a knob slide look smooth instead of snapping the whole atmosphere. If you want an immediate hard reset, call `updateConfig({ count: same })` — it re-initialises the pool.

---

## Sizing, DPR, and resize

The canvas is expected to be positioned as a fullscreen overlay via CSS. Recommended baseline:

```css
canvas#fx {
    position: fixed;
    inset: 0;
    width: 100dvw;
    height: 100dvh;
    z-index: 0;
    mix-blend-mode: screen;
    pointer-events: none;
}
```

Inside the library:

- **DPR handling** — sprites are cached at physical pixel size (`logicalSize × devicePixelRatio`), keyed on that physical size so a retina render doesn't reuse a blurry 1× sprite.
- **Resize handling** — a `ResizeObserver` on the canvas's parent element coalesces bursts to one `requestAnimationFrame`. On resize, particle positions are **rescaled proportionally** rather than re-spawned, so a window drag or orientation change doesn't restart the atmosphere.
- **Visibility handling** — when the tab becomes visible again, `lastTime` is reset so the next frame doesn't compute a huge delta and teleport every particle.
- **Delta-time clamping** — every frame's `dt` is clamped to 50ms. A tab wake-up produces one flat step, not a spike.

---

## Performance notes

- **Zero string allocation in the sprite cache** — sprites are indexed as `Map<color, Map<physicalSize, canvas>>`. No template-literal key on the hot path.
- **`spriteCanvas` cached on the particle at spawn time** — the render loop reads `p.spriteCanvas` directly and calls `getSprite` zero times per frame. Sprite resolution happens only when a particle spawns (rare) or the theme changes (very rare).
- **Monomorphic particle shape** — every particle carries the union of behavior-specific fields (`anchorX`, `anchorY`, `pulseOffset` for MIST; unused-but-zeroed for other behaviors) from the moment it's pushed to the pool. V8's hidden class stays stable across theme/behavior swaps.
- **Behavior dispatch hoisted out of the render loop** — one registry lookup per frame, then a dedicated per-behavior tick loop. The branch predictor sees one path per behavior instead of a mode-check per particle.
- **`Math.trunc` for the CHAOS flicker phase** — avoids the 32-bit signed cast that `timestamp >> 7` does, which would wrap negative after ~24 days of `performance.now()`.
- **Zero-alloc pooled `FrameContext`** — the object passed to `spawn`/`tick` is allocated once at instance creation and mutated in place per frame.
- **Delta-time clamping** — every frame's `dt` is capped at 50ms so a tab wake-up produces one flat step, not a spike.

If you need to render **10,000+ particles**, this is not the package — reach for an SoA GPU pipeline instead. `lite-ambient-fx` is tuned for 40–500 particles as an atmosphere layer behind normal UI.

---

## Browser and runtime support

Pure ES2020 + Canvas 2D. Runs anywhere with a modern browser and a `<canvas>`.

| Target                        | Supported |
| ----------------------------- | --------- |
| Chrome / Edge (last 2 majors) | yes       |
| Firefox (last 2 majors)       | yes       |
| Safari 14+                    | yes       |
| Twitch Extensions             | yes       |
| Node.js 18+ (for tests)       | yes       |
| SSR                           | N/A       |

The module doesn't touch `document` or `window` at the top level — DOM access is deferred to `createAmbientFX` — so a bundler picking it up in an SSR context won't crash at import time.

ESM-only. Modern bundlers handle this; legacy consumers can use a wrapper.

---

## Integration recipes

### As a hero-section background

```html
<canvas id="bg" style="position:fixed;inset:0;z-index:0;mix-blend-mode:screen"></canvas>
<main style="position:relative;z-index:1"> ... </main>

<script type="module">
    import { createAmbientFX } from "@zakkster/lite-ambient-fx";
    createAmbientFX(document.getElementById("bg"), { theme: "Toxic" });
</script>
```

### Theme-follows-app-mode

```js
import { createAmbientFX } from "@zakkster/lite-ambient-fx";

const fx = createAmbientFX(canvas, { theme: "Frost" });

const media = matchMedia("(prefers-color-scheme: dark)");
function applyMode() {
    fx.setTheme(media.matches ? "Void" : "Frost");
}
media.addEventListener("change", applyMode);
applyMode();
```

### Driven by lite-signal

```js
import { signal, effect } from "@zakkster/lite-signal";
import { createAmbientFX } from "@zakkster/lite-ambient-fx";

const intensity = signal(1.0);
const fx = createAmbientFX(canvas, { theme: "Fire" });

effect(() => {
    fx.updateConfig({ alpha: intensity(), count: (200 + intensity() * 200) | 0 });
});

// somewhere else in the app:
intensity.set(0.4);
```

### Pause on modal open

```js
const fx = createAmbientFX(canvas, { theme: "Void" });
dialog.addEventListener("open", () => fx.pause());
dialog.addEventListener("close", () => fx.resume());
```

---

## Testing

Three test files under `test/`:

- **`01-config_test.mjs`** — DOM-free pure-helper tests. THEMES surface, `mergeThemeConfig` semantics, `validateConfig` throws, sine LUT wrap, `envelopeAlpha` curves per behavior, VERSION parity with `package.json`.
- **`02-runtime_test.mjs`** — full lifecycle under a minimal DOM shim (mocked canvas 2D context, `requestAnimationFrame`, `document`). Boot, theme swap, config update, pause/resume, destroy, dt clamping across a simulated 10-second tab freeze.
- **`03-registry_test.mjs`** — `BEHAVIORS` surface, `registerBehavior` argument validation, end-to-end custom behavior use, particle shape monomorphism, and the `FrameContext` spawn/respawn contract.

70 tests across all three files.

```
npm test
```

The DOM shim is intentionally minimal — this is a canvas-only package, and unit-level canvas fidelity would be a maintenance sink. Visual regressions are caught by the demo.

---

## Ecosystem

Part of the [`@zakkster`](https://www.npmjs.com/~zakkster) zero-GC stack: **[`lite-signal`](https://www.npmjs.com/package/@zakkster/lite-signal)** &middot; **[`lite-gl`](https://www.npmjs.com/package/@zakkster/lite-gl)** &middot; **[`lite-scene`](https://www.npmjs.com/package/@zakkster/lite-scene)** &middot; **[`lite-color`](https://www.npmjs.com/package/@zakkster/lite-color)** &middot; **[`lite-raf`](https://www.npmjs.com/package/@zakkster/lite-raf)** &middot; **[`lite-time`](https://www.npmjs.com/package/@zakkster/lite-time)**

`lite-ambient-fx` deliberately does **not** import from these — it's the "drop it on any page" tier of the stack. If you're already using `lite-signal` and `lite-raf` in your app, feed values into `updateConfig` from a `rafEffect` for smooth parameter automation. If you need seeded reproducibility, wire in `@zakkster/lite-random` upstream and pass the values through `overrides`.

---

## FAQ

**Why single-file with no dependencies?** Because that's what makes the package trivial to drop into anything — a landing page, an Astro island, a Vue app, a Twitch extension, a Codepen. Bundlers can tree-shake nothing away since it's already one file, but they also can't accidentally pull in a duplicate of another package.

**Can I use my own palette instead of one of the six presets?** Yes — pass `overrides: { colors: [...], spark: "..." }` at construction, or call `fx.updateConfig({ colors: [...] })` later. Any valid CSS color string works (hex, rgb, hsl, oklch on modern browsers).

**Do I need `lite-viewport` or a shared ticker?** No — this package handles DPR, resize, and its own RAF loop internally. If you want one shared RAF across multiple ambient layers, use `pause()` and drive `_tickManually` yourself (roadmap for v1.1).

**Why is my MIST theme rendering as solid squares?** You forgot `mix-blend-mode: screen` on the canvas CSS. MIST relies on additive blending to look like fog.

**What happens if `devicePixelRatio` changes at runtime (drag between monitors)?** The `ResizeObserver` fires on the size change; the next frame re-primes sprites at the new physical size. There's a one-frame flash of the old sprites; imperceptible in practice.

**Is `lite-ambient-fx` a `tsparticles` replacement?** No. `tsparticles` is a general-purpose particle engine with dozens of shape/interaction modules. `lite-ambient-fx` is six curated atmospheres, one file, no config language. Different tier.

**Can I run it in a Web Worker with OffscreenCanvas?** Not out of the box — the module reads `window.devicePixelRatio` and `document.hidden` directly. Porting is straightforward if you want to try it; PRs welcome.

---

## License

MIT © Zahary Shinikchiev

---

> Part of the **@zakkster** zero-GC stack.
