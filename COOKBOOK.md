# COOKBOOK

Recipes for `@zakkster/lite-ambient-fx`. Each is standalone, copy-paste-friendly,
and small enough to reason about at a glance.

Contents:

1. [Basic mount](#1-basic-mount)
2. [Switch themes](#2-switch-themes)
3. [Tweak a shipped theme without re-registering](#3-tweak-a-shipped-theme-without-re-registering)
4. [Register a custom theme](#4-register-a-custom-theme)
5. [Day/night cycle via `lerpTheme`](#5-daynight-cycle-via-lerptheme)
6. [Palette from `lite-hueforge`](#6-palette-from-lite-hueforge)
7. [Frame-budget auto-degrade](#7-frame-budget-auto-degrade)
8. [Pointer reactivity](#8-pointer-reactivity)
9. [Reduced-motion opt-out](#9-reduced-motion-opt-out)
10. [Layer two atmospheres](#10-layer-two-atmospheres)
11. [React integration](#11-react-integration)
12. [Vue 3 integration](#12-vue-3-integration)
13. [Custom behavior](#13-custom-behavior)
14. [Sprite-cache maintenance](#14-sprite-cache-maintenance)

---

## 1. Basic mount

The smallest working example. `createAmbientFX` mounts on any 2D-context canvas,
positions itself as a full-viewport atmosphere via CSS, and starts rendering
immediately.

```html
<canvas id="fx" style="position:fixed;inset:0;z-index:-1;"></canvas>
<script type="module">
    import { createAmbientFX } from '@zakkster/lite-ambient-fx';
    const fx = createAmbientFX(document.getElementById('fx'), { theme: 'Fire' });
    // fx.destroy() when you're done.
</script>
```

The canvas needs a physical size before mount. The instance handles DPR,
`ResizeObserver`, and `visibilitychange` internally.

---

## 2. Switch themes

Themes are just data; `setTheme` replaces the effective config and rebuilds the
sprite cache for the new palette. Live-tunable.

```js
fx.setTheme('Aurora');       // one of the 17 built-ins
fx.setTheme('Bioluminescence');
fx.setTheme('Sakura');
```

If the theme name isn't in the registry, `setTheme` throws `RangeError`. Guard
with `Object.hasOwn(THEMES, name)` if you're taking user input.

---

## 3. Tweak a shipped theme without re-registering

`updateConfig` merges a partial into the current baseConfig; unspecified fields
stay put. Reduced-motion state is preserved.

```js
fx.updateConfig({
    count: 500,             // heavier atmosphere
    wind:  { x: 0.4, y: -0.6 },
    turbulence: 0.8,
});
```

For pointer, use `setPointer` -- it's its own field.

---

## 4. Register a custom theme

`registerTheme(name, config, meta?)` appends to both `THEMES` and `THEME_META`,
so any UI built against `THEME_META` (a theme picker, a HUD) picks up the new
entry without a code change.

```js
import { registerTheme, validateConfig } from '@zakkster/lite-ambient-fx';

registerTheme('Rust', {
    behavior: 'EMBER',
    colors: ['#a44e2a', '#c8722d', '#e0a05a'],
    spark: '#ffe7b0',
    count: 220,
    wind:  { x: -0.08, y: -0.35 },
    decay: 0.004, speed: 1.4, size: 5, alpha: 0.9, turbulence: 0.4,
}, { name: 'Rust', icon: 'ember', behavior: 'EMBER' });

fx.setTheme('Rust');
```

`validateConfig` runs automatically inside `registerTheme`; malformed configs
throw before they can pollute the registry.

---

## 5. Day/night cycle via `lerpTheme`

`lerpTheme` interpolates two configs in OKLCH (perceptually smooth colors) and
lerps scalars/wind linearly. With an `out` scratch, the palette-slot hex strings
are the only per-call allocations.

```js
import { THEMES, lerpTheme } from '@zakkster/lite-ambient-fx';

const scratch = { colors: [], wind: { x: 0, y: 0 } };

let t = 0;
function step() {
    t = (t + 0.001) % 1;                    // 0 -> 1 -> 0 -> ...
    // cosine ping-pong so the endpoints hold briefly
    const s = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
    fx.updateConfig(lerpTheme(THEMES.Night, THEMES.Cosmic, s, scratch));
    requestAnimationFrame(step);
}
requestAnimationFrame(step);
```

Recommended cadence: drive at ~10 Hz for smooth-looking transitions. Full-RAF
works too but produces more unique hex strings, so the sprite cache warms up
larger.

---

## 6. Palette from `lite-hueforge`

`colorsFromPalette` duck-types the shape hueforge scales emit; no runtime import
of hueforge is needed. Ship whatever your designer produces.

```js
import { createScale } from '@zakkster/lite-hueforge';
import { colorsFromPalette } from '@zakkster/lite-ambient-fx';

const primary = createScale({
    name: 'primary',
    base: { l: 0.55, c: 0.22, h: 268 },
    curve: 'ease-in-out-quad',
});

fx.updateConfig({ colors: colorsFromPalette(primary.steps()) });
```

Accepted stop shapes: hex strings, `{l,c,h}` OKLCH triples (hueforge scale
steps), `{color: '#hex'}` wrappers, `[position, ...]` CSS-style tuples. Empty
array is allowed and produces an empty result -- guard your call sites.

---

## 7. Frame-budget auto-degrade

The v1.4.0 headline. Under load, `count` steps down; when frames recover, it
steps back up toward the base. Both the ceiling and the current effective count
are readable live.

```js
const fx = createAmbientFX(canvas, {
    theme: 'Aurora',
    frameBudget: {
        targetMs: 20,        // p90 above 20 ms -> degrade
        restoreMs: 14,       // p90 below 14 ms -> restore (defaults to targetMs * 0.7)
        cooldown: 60,        // frames between adjustments
        stepFrac: 0.10,      // each step = 10% of baseCount
        minCount: 20,        // floor -- never drop below
        onDegrade: (e) => {
            console.log(e.reason, e.from, '->', e.to, '(p90', e.p90.toFixed(1), 'ms)');
        },
    },
});

// Live introspection:
const b = fx.frameBudget;    // FrameBudget | null
b.currentCount;              // what's actually rendering
b.baseCount;                 // what would render at 100%
b.windowFilled;              // true once the 32-sample window is full
```

`fx.setFrameBudget(spec)` swaps the policy live -- pass `null` or `false` to
disable, `true` to re-enable with defaults, or a fresh options object.

Compatible with reduced-motion. The ceiling is `cfg.count` (post-reduced-motion),
so restore never blows through the accessibility floor.

---

## 8. Pointer reactivity

Attract or repel particles from the pointer position with a soft radius falloff.
Costs one distance check per particle per frame; the shipped presets tune it
so an atmosphere with ~300 particles pays for the interaction and stays smooth.

```js
fx.setPointer({ mode: 'attract', radius: 240, strength: 14 });

// Live-tune while the mouse is warm:
window.addEventListener('keydown', (e) => {
    if (e.key === 'a') fx.setPointer({ mode: 'attract' });
    if (e.key === 'r') fx.setPointer({ mode: 'repel' });
    if (e.key === 'o') fx.setPointer({ mode: 'off' });
});
```

`mode: 'off'` detaches the pointer listener entirely -- no cost when unused.

---

## 9. Reduced-motion opt-out

`prefers-reduced-motion` is honored by default: the effective `count`/`speed`/
`turbulence` are quietly degraded when the user has the OS toggle on. You can
opt out of the auto-degrade if you know your atmosphere is already gentle
enough.

```js
const fx = createAmbientFX(canvas, {
    theme: 'Fireflies',
    respectReduced: false,   // default true
});
```

Read the effective state via `fx.reducedMotion` (boolean, live). The
transformation itself is exposed as `degradeForReducedMotion(cfg) -> cfg` for
custom rendering surfaces.

---

## 10. Layer two atmospheres

Two canvases stacked, two instances. Both handle their own DPR + resize.

```html
<canvas id="fxBack"  style="position:fixed;inset:0;z-index:-2;"></canvas>
<canvas id="fxFront" style="position:fixed;inset:0;z-index:-1;"></canvas>
```

```js
const back  = createAmbientFX(document.getElementById('fxBack'),  { theme: 'Cosmic' });
const front = createAmbientFX(document.getElementById('fxFront'), {
    theme: 'Fireflies',
    overrides: { count: 30, alpha: 0.6 },
});
```

Watch total particle count -- keep the front layer sparse and the back layer
rich. The two `RequestAnimationFrame` loops share the same rAF pool; there's no
extra scheduling cost.

---

## 11. React integration

Effect-based mount, cleanup in the return. The canvas ref stays across renders;
theme changes drive through `setTheme` inside a separate effect.

```jsx
import { useEffect, useRef } from 'react';
import { createAmbientFX } from '@zakkster/lite-ambient-fx';

export function Atmosphere({ theme = 'Fire', frameBudget = true }) {
    const canvasRef = useRef(null);
    const instanceRef = useRef(null);

    useEffect(() => {
        instanceRef.current = createAmbientFX(canvasRef.current, {
            theme,
            frameBudget,
        });
        return () => instanceRef.current.destroy();
    }, []); // mount once

    useEffect(() => {
        instanceRef.current?.setTheme(theme);
    }, [theme]);

    return (
        <canvas
            ref={canvasRef}
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
        />
    );
}
```

Do NOT put `theme` in the mount effect's dependency array -- that would
re-instantiate the whole engine on every theme change, thrashing the sprite
cache.

---

## 12. Vue 3 integration

Same idea in Composition API shape. `onMounted` mounts, `onBeforeUnmount`
destroys, a `watch` on `props.theme` drives `setTheme`.

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { createAmbientFX } from '@zakkster/lite-ambient-fx';

const props = defineProps({
    theme: { type: String, default: 'Fire' },
});

const canvas = ref(null);
let fx = null;

onMounted(() => {
    fx = createAmbientFX(canvas.value, { theme: props.theme, frameBudget: true });
});
onBeforeUnmount(() => { fx?.destroy(); });
watch(() => props.theme, (t) => { fx?.setTheme(t); });
</script>

<template>
    <canvas ref="canvas" style="position:fixed;inset:0;z-index:-1;" />
</template>
```

---

## 13. Custom behavior

The five built-in behaviors are enough for most atmospheres, but you can drop
in your own. A behavior is a `{spriteLogical, spawn, tick}` triple; the frame
context is shared and reusable.

```js
import { registerBehavior, registerTheme, sampleDepth } from '@zakkster/lite-ambient-fx';

registerBehavior('SPIRAL', {
    spriteLogical: 32,

    spawn(p, frame) {
        const cfg = frame.cfg;
        p.z = sampleDepth(cfg.depthBands);
        p.color = cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, 32);
        p.life = 0;
        p.x = frame.W * 0.5;
        p.y = frame.H * 0.5;
        p.size = (cfg.size + Math.random() * cfg.size) * p.z;
        p.angle = Math.random() * Math.PI * 2;
        p.radius = 0;
        p.decay = cfg.decay;
        p.maxAlpha = cfg.alpha * p.z;
    },

    tick(particles, ctx, frame) {
        const ds = frame.ds;
        const cfg = frame.cfg;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.angle += 0.05 * cfg.speed * ds;
            p.radius += cfg.speed * ds;
            p.x = frame.W * 0.5 + Math.cos(p.angle) * p.radius;
            p.y = frame.H * 0.5 + Math.sin(p.angle) * p.radius;
            p.life += p.decay * ds;
            if (p.life >= 1 || p.radius > Math.max(frame.W, frame.H)) {
                frame.respawn(p, false);
                continue;
            }
            ctx.globalAlpha = p.maxAlpha * (1 - p.life);
            const half = p.size * 0.5;
            ctx.drawImage(p.spriteCanvas,
                (p.x - half) | 0, (p.y - half) | 0,
                p.size | 0, p.size | 0);
        }
    },
});

registerTheme('Vortex', {
    behavior: 'SPIRAL',
    colors: ['#00b4d8', '#0077b6', '#48cae4'],
    spark: '#caf0f8',
    count: 180,
    wind: { x: 0, y: 0 }, decay: 0.008, speed: 1.5, size: 6, alpha: 0.85, turbulence: 0.2,
});
```

The invariants: `spawn` populates every field of `p` you'll read in `tick`; the
frame context is pooled -- don't retain references to it or its fields past the
current call.

---

## 14. Sprite-cache maintenance

The sprite cache keys on `(color, physicalSize)`. Long-running interpolations
(`lerpTheme` over many colors) generate fresh hex strings and grow the cache
over time. It self-clears on DPR change and theme swap; for cases where you
want to release intermediate sprites explicitly:

```js
import { clearAmbientSpriteCache } from '@zakkster/lite-ambient-fx';

// Post-transition cleanup:
clearAmbientSpriteCache();

// Or targeted -- keep the current active colors, drop everything else:
clearAmbientSpriteCache(fx.config.colors);
```

Cost: next-frame re-rasterization for whatever colors are still needed, then
steady state. Practical rule: call after a wide OKLCH sweep, or on scene changes
you know are permanent.

---

## 15. Translate `@zakkster/lite-fx-pro` presets into ambient themes

`lite-fx-pro` ships burst presets (`count: N`, `rate: 0` -- one-shot bursts of
particles like `explosion.json`, `stardust.json`, `molten_gold.json`).
`lite-ambient-fx` renders **continuous** atmospheres. Direct 1:1 porting
doesn't work, but the *vibe* of many fx-pro presets translates cleanly.

The translation pattern below is what shipped six of v1.5.0's atmospheres.

### Field map

| fx-pro                          | ambient-fx                                  |
|---------------------------------|---------------------------------------------|
| `emission.count`                | scale to `count` (drop 5-10x -- continuous streams don't need burst density) |
| `emission.angle` (radians)      | `wind.y` sign (angle around -pi/2 -> upward) |
| `emission.spread`               | pick behavior: narrow spread + upward -> EMBER; full circle -> CHAOS |
| `physics.speed`, `speedVariance`| divide by ~60 -> ambient's `speed` (which is a per-16ms delta multiplier) |
| `physics.gravity`               | negative gravity -> upward `wind.y`; positive -> FALL behavior |
| `physics.drag`                  | folded into `decay` (higher drag -> lower decay) |
| `lifecycle.lifeTime`            | inverse of `decay` |
| `visuals.baseRadius`            | `size` (divide by ~2) |
| `visuals.colors` (OKLCH strings)| convert to hex, keep the 3-4 color chain |
| `visuals.blendMode`             | keep as-is on the ambient `blendMode` field (v1.5.0) |

### Behavior chooser

| fx-pro shape                                | ambient behavior |
|---------------------------------------------|------------------|
| angle = -pi/2, moderate spread, upward pull | `EMBER`          |
| angle = -pi/2, wide spread, downward gravity| `FALL`           |
| full spread (~2*pi), fast, short life       | `CHAOS`          |
| upward pull, long life, sine sway feel      | `FLOAT`          |
| slow, wide, breathing scale curve           | `MIST`           |

### Worked example: `molten_gold.json` -> `MoltenGold` theme

fx-pro preset:

```json
{
  "id": "molten_gold",
  "emission": { "count": 11, "angle": -1.5708, "spread": 1.88 },
  "physics":  { "speed": 115, "speedVariance": 65, "gravity": 600, "drag": 0.96 },
  "lifecycle":{ "lifeTime": 1.0, "lifeVariance": 0.4 },
  "visuals":  { "colors": ["oklch(0.97 0.05 60)", "oklch(0.82 0.2 70)", ...],
                "baseRadius": 12, "blendMode": "screen" }
}
```

Ambient theme:

```js
MoltenGold: {
    behavior:  'EMBER',                              // upward + narrow spread
    colors:    ['#f8ecc5', '#dfa956', '#a86f28', '#5c3d18'],   // OKLCH -> hex
    spark:     '#fff5d9',
    count:     200,                                  // continuous, so multiply
    wind:      { x: 0.0, y: -0.4 },                  // upward bias
    decay:     0.005,                                // ~ 1/lifeTime scaled
    speed:     1.8,                                  // ~ 115 / 60
    size:      6,                                    // ~ baseRadius / 2
    alpha:     0.85,
    turbulence:0.4,
    depthBands:3,
    blendMode: 'screen',                             // same as fx-pro
},
```

### When to skip the port

Presets that don't map well:

- **Pure bursts** (`explosion.json`, `fireball.json`, `crystal_shatter.json`,
  `sparkles.json`) -- one-shot flash-and-die. Ambient wants continuous life.
  Use fx-pro directly for these.
- **Presets already covered by shipped themes.** `sakura_petals.json` maps
  onto ambient's `Sakura` (v1.4.0); `firefly_swarm.json` onto `Fireflies`
  (v1.4.0); `smoke.json` fits in the `Frost`/`Sandstorm` territory.

If in doubt, mount both instances stacked and see which reads right in your
scene.
