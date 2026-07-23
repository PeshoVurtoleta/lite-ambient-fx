/**
 * @zakkster/lite-ambient-fx
 *
 * Full-screen ambient particle atmospheres in one file. Eleven themed presets
 * (Fire, Night, Ice, Frost, Toxic, Void, Dust, Aurora, Abyss, Snow, Rain) across
 * five particle behaviors (EMBER, MIST, FLOAT, CHAOS, FALL), plus registry hooks
 * for custom themes (`registerTheme`) and behaviors (`registerBehavior`).
 * Parallax depth bands and zero-alloc pointer reactivity (repel / attract).
 * Sprite-cached radial gradients, zero-alloc render loop, monomorphic
 * particle shape, DPR-aware rasterization, delta-time scaled,
 * resize-preserving, visibility-paused, and `prefers-reduced-motion`
 * auto-degrade. Zero runtime dependencies. One file.
 *
 * (c) 2026 Zahary Shinikchiev. MIT.
 */

export const VERSION = '1.6.0';

// ============================================================
//  THEME PRESETS
// ============================================================

/**
 * Nine shipped presets. Each is a full config; `behavior` is a key into the
 * BEHAVIORS registry; every other field is live-tunable via updateConfig.
 *
 * Null-prototype, exactly like BEHAVIORS: THEMES is a *registry* as of v1.1.0
 * (see registerTheme), so it must not inherit `constructor`, `toString`, or a
 * `__proto__` setter from Object.prototype. A plain literal would make
 * `THEMES['constructor']` truthy -- enough to slip past the unknown-theme guard.
 */
export const THEMES = Object.assign(Object.create(null), {
    Fire: {
        behavior: 'EMBER',
        colors: ['#ff4500', '#ff7f50', '#ffd700'],
        spark: '#ffff00',
        count: 300,
        wind: { x: -0.2, y: -0.5 },
        decay: 0.004,
        speed: 2.5,
        size: 5,
        alpha: 1.0,
        turbulence: 0.5,
    },
    Night: {
        behavior: 'EMBER',
        colors: ['#ff4500', '#ffa500', '#ffd700'],
        spark: '#ffffff',
        count: 200,
        wind: { x: 0.1, y: -0.3 },
        decay: 0.004,
        speed: 2.0,
        size: 5,
        alpha: 1.0,
        turbulence: 0.5,
    },
    Ice: {
        behavior: 'MIST',
        colors: ['#00bfff', '#87ceeb', '#e0ffff'],
        spark: '#ffffff',
        count: 40,
        wind: { x: 1.5, y: 0.2 },
        decay: 0.0003,
        speed: 1.0,
        size: 200,
        alpha: 0.08,
        turbulence: 0.5,
    },
    Frost: {
        behavior: 'MIST',
        colors: ['#ffffff', '#f0f8ff', '#e6e6fa'],
        spark: '#ffffff',
        count: 40,
        wind: { x: 0.5, y: 0.1 },
        decay: 0.0003,
        speed: 1.0,
        size: 200,
        alpha: 0.08,
        turbulence: 0.5,
    },
    Toxic: {
        behavior: 'FLOAT',
        colors: ['#39ff14', '#7fff00', '#00ff00'],
        spark: '#ccff00',
        count: 150,
        wind: { x: 0, y: -0.2 },
        decay: 0.0005,
        speed: 0.6,
        size: 8,
        alpha: 0.7,
        turbulence: 0.5,
    },
    Void: {
        behavior: 'CHAOS',
        colors: ['#4b0082', '#9400d3', '#8a2be2'],
        spark: '#da70d6',
        count: 150,
        wind: { x: 0, y: 0 },
        decay: 0.02,
        speed: 1.5,
        size: 3,
        alpha: 0.9,
        turbulence: 0.5,
    },

    // ---- v1.1.0 presets (existing behaviors; Snow + FALL land in v1.2.0) ----
    Dust: {
        behavior: 'FLOAT',
        colors: ['#d2b48c', '#8b7355', '#a0522d'],
        spark: '#f5deb3',
        count: 120,
        wind: { x: 0.3, y: -0.1 },
        decay: 0.0008,
        speed: 0.4,
        size: 6,
        alpha: 0.6,
        turbulence: 0.3,
    },
    Aurora: {
        behavior: 'MIST',
        colors: ['#00ff9f', '#00bfff', '#7b2cbf'],
        spark: '#ffffff',
        count: 35,
        wind: { x: 0.8, y: 0.1 },
        decay: 0.0002,
        speed: 0.8,
        size: 180,
        alpha: 0.12,
        turbulence: 0.6,
    },
    Abyss: {
        behavior: 'CHAOS',
        colors: ['#000080', '#191970', '#4b0082'],
        spark: '#00ffff',
        count: 180,
        wind: { x: 0, y: 0 },
        decay: 0.015,
        speed: 1.2,
        size: 4,
        alpha: 0.85,
        turbulence: 0.8,
    },

    // ---- v1.2.0 presets (FALL + parallax depth bands) ----
    // These are the ambient-backdrop cousins of @zakkster/lite-snow and
    // @zakkster/lite-rain -- no ground, no accumulation, no splash. See the
    // "Ecosystem positioning" section of the README before reaching for one.
    Snow: {
        behavior: 'FALL',
        colors: ['#ffffff', '#e8f4ff', '#cfe6ff'],
        spark: '#ffffff',
        count: 220,
        wind: { x: 0.35, y: 0 },
        decay: 0.0006,
        speed: 1.1,
        size: 5,
        alpha: 0.9,
        turbulence: 0.9,
        depthBands: 3,
    },
    Rain: {
        behavior: 'FALL',
        colors: ['#a8c8e8', '#7fa8d0', '#cfe4ff'],
        spark: '#ffffff',
        count: 300,
        wind: { x: 0.9, y: 0 },
        decay: 0.002,
        speed: 6,
        size: 3,
        alpha: 0.55,
        turbulence: 0.06,
        depthBands: 3,
        stretch: 2.2,
    },

    // ---- v1.4.0 new atmospheres --------------------------------------

    // Sakura -- pink petals falling gently. FALL with high stretch and low
    // turbulence for lazy drift; sparks are near-white to catch the light.
    Sakura: {
        behavior: 'FALL',
        colors: ['#ffb7c5', '#f4b6c2', '#ffe4ec'],
        spark: '#ffffff',
        count: 240,
        wind: { x: 0.06, y: 0.0 },
        decay: 0.0018,
        speed: 0.6,
        size: 8,
        alpha: 0.75,
        turbulence: 0.05,
        depthBands: 3,
        stretch: 1.6,
    },

    // Fireflies -- warm yellow FLOAT with pronounced alpha pulse. Slow,
    // sparse, meandering. High turbulence gives the "wandering" feel.
    Fireflies: {
        behavior: 'FLOAT',
        colors: ['#f5e488', '#ffd166', '#fff2a8'],
        spark: '#fffbe6',
        count: 90,
        wind: { x: 0.0, y: -0.05 },
        decay: 0.0006,
        speed: 0.4,
        size: 3.5,
        alpha: 0.9,
        turbulence: 1.2,
        depthBands: 2,
    },

    // Meteor -- streaks against a dark sky. FALL with heavy stretch (comet
    // tails) and high speed. Colors are ice-white->orange->deep red.
    Meteor: {
        behavior: 'FALL',
        colors: ['#eaf6ff', '#ffc078', '#e63946'],
        spark: '#ffffff',
        count: 60,
        wind: { x: -0.08, y: 0.0 },
        decay: 0.007,
        speed: 5.0,
        size: 4,
        alpha: 1.0,
        turbulence: 0.15,
        depthBands: 3,
        stretch: 4.5,
    },

    // Cosmic -- deep-space rising particles, slow purple->violet EMBER with
    // starry sparks. Low turbulence so the drift is grand and steady.
    Cosmic: {
        behavior: 'EMBER',
        colors: ['#4a1a72', '#7c3aed', '#a78bfa'],
        spark: '#f5f3ff',
        count: 180,
        wind: { x: 0.0, y: -0.15 },
        decay: 0.0025,
        speed: 0.9,
        size: 4,
        alpha: 0.85,
        turbulence: 0.25,
        depthBands: 3,
    },

    // Sandstorm -- horizontal MIST driven by heavy wind, tan/ochre palette.
    // Faster than the fog-like presets, less alpha so it reads as dust rather
    // than cloud.
    Sandstorm: {
        behavior: 'MIST',
        colors: ['#a67b3a', '#c8955c', '#d9b382'],
        spark: '#f4e2b6',
        count: 140,
        wind: { x: 2.4, y: -0.1 },
        decay: 0.003,
        speed: 1.4,
        size: 42,
        alpha: 0.35,
        turbulence: 0.6,
        depthBands: 2,
    },

    // Bioluminescence -- deep aquamarine CHAOS with cyan sparks. Slow,
    // downward-biased pull like plankton in a current. Wide alpha window so
    // the "flicker" reads even at low counts.
    Bioluminescence: {
        behavior: 'CHAOS',
        colors: ['#00b4d8', '#0077b6', '#48cae4'],
        spark: '#caf0f8',
        count: 220,
        wind: { x: 0.05, y: 0.08 },
        decay: 0.003,
        speed: 0.7,
        size: 3.5,
        alpha: 0.75,
        turbulence: 0.35,
        depthBands: 3,
    },

    // ---- v1.5.0 atmospheres distilled from lite-fx-pro presets ---------
    //
    // Each is inspired by a burst preset from @zakkster/lite-fx-pro,
    // reshaped as a continuous ambient loop with blendMode support.
    // See COOKBOOK.md recipe 15 for the translation pattern.

    // MoltenGold -- gold droplets rising with screen glow (fx-pro: molten_gold).
    MoltenGold: {
        behavior: 'EMBER',
        colors: ['#f8ecc5', '#dfa956', '#a86f28', '#5c3d18'],
        spark: '#fff5d9',
        count: 200,
        wind: { x: 0.0, y: -0.4 },
        decay: 0.005,
        speed: 1.8,
        size: 6,
        alpha: 0.85,
        turbulence: 0.4,
        depthBands: 3,
        blendMode: 'screen',
        sizeCurve: [1.25, 2.5],
    },

    // ShadowWisp -- deep purple wisps drifting on darkness (fx-pro: shadow_wisp).
    // The one v1.5.0 preset that uses source-over -- the goal is subtractive,
    // not additive; screen would wash it out.
    ShadowWisp: {
        behavior: 'MIST',
        colors: ['#3b1c5c', '#231338', '#100821'],
        spark: '#5e3982',
        count: 25,
        wind: { x: 0.1, y: -0.02 },
        decay: 0.001,
        speed: 0.4,
        size: 90,
        alpha: 0.5,
        turbulence: 0.3,
        depthBands: 2,
        blendMode: 'source-over',
        sizeCurve: [2.0, 7.5],
        alphaCurve: [0.0, 0.8, 0.0],
    },

    // Stardust -- twinkling FLOAT with screen glow (fx-pro: stardust).
    Stardust: {
        behavior: 'FLOAT',
        colors: ['#f4f7fd', '#c5d3ee', '#7896cd'],
        spark: '#ffffff',
        count: 130,
        wind: { x: 0.05, y: -0.15 },
        decay: 0.0008,
        speed: 0.5,
        size: 4.5,
        alpha: 0.85,
        turbulence: 0.4,
        depthBands: 3,
        blendMode: 'screen',
        sizeCurve: [0.5, 0.0],
        alphaCurve: [0.0, 1.0, 0.0],
    },

    // NeonGlitch -- fast CHAOS with lighter blend for electric cyan/magenta
    // flash (fx-pro: neon_glitch).
    NeonGlitch: {
        behavior: 'CHAOS',
        colors: ['#54d3f7', '#e46bde', '#3a80d9', '#984abf'],
        spark: '#ffffff',
        count: 300,
        wind: { x: 0.0, y: 0.0 },
        decay: 0.02,
        speed: 3.5,
        size: 3,
        alpha: 1.0,
        turbulence: 0.9,
        depthBands: 2,
        blendMode: 'lighter',
        sizeCurve: [0.5, 1.25],
    },

    // SolarFlare -- intense EMBER with lighter blend, dense count, deep
    // orange-to-white ramp (fx-pro: solar_flare).
    SolarFlare: {
        behavior: 'EMBER',
        colors: ['#faf6e2', '#f8b95d', '#e4671e', '#a13411'],
        spark: '#fff8dc',
        count: 320,
        wind: { x: 0.05, y: -0.55 },
        decay: 0.008,
        speed: 2.5,
        size: 5,
        alpha: 0.9,
        turbulence: 0.55,
        depthBands: 3,
        blendMode: 'lighter',
        sizeCurve: [1.5, 0.5],
    },

    // ToxicBubble -- big rising green bubbles with screen glow (fx-pro:
    // toxic_bubble). Distinct from Toxic (which is small FLOAT particles
    // without blend mode) by size + count + additive glow.
    ToxicBubble: {
        behavior: 'FLOAT',
        colors: ['#83f0af', '#4bb27b', '#20714c'],
        spark: '#c5ffe0',
        count: 40,
        wind: { x: 0.0, y: -0.35 },
        decay: 0.0008,
        speed: 0.7,
        size: 22,
        alpha: 0.7,
        turbulence: 0.3,
        depthBands: 2,
        blendMode: 'screen',
        sizeCurve: [1.0, 4.5],
        alphaCurve: [0.0, 0.8, 0.0],
    },
});

/**
 * Human-readable metadata for UI builders (theme pickers, playgrounds).
 * `registerTheme()` appends/updates entries here automatically, so a picker
 * built against THEME_META keeps working without modification.
 */
export const THEME_META = [
    { id: 'Fire',  name: 'Inferno',     icon: 'flame',  behavior: 'EMBER' },
    { id: 'Night', name: 'Stardust',    icon: 'sparks', behavior: 'EMBER' },
    { id: 'Ice',   name: 'Blizzard',    icon: 'flake',  behavior: 'MIST'  },
    { id: 'Frost', name: 'Deep Fog',    icon: 'fog',    behavior: 'MIST'  },
    { id: 'Toxic', name: 'Biohazard',   icon: 'radio',  behavior: 'FLOAT' },
    { id: 'Void',  name: 'Dark Matter', icon: 'orb',    behavior: 'CHAOS' },
    { id: 'Dust',   name: 'Dust Veil',   icon: 'wind',  behavior: 'FLOAT' },
    { id: 'Aurora', name: 'Aurora',      icon: 'wave',  behavior: 'MIST'  },
    { id: 'Abyss',  name: 'Abyss',       icon: 'hole',  behavior: 'CHAOS' },
    { id: 'Snow',   name: 'Snowfall',    icon: 'snow',  behavior: 'FALL'  },
    { id: 'Rain',   name: 'Downpour',    icon: 'rain',  behavior: 'FALL'  },
    { id: 'Sakura',           name: 'Sakura',           icon: 'petal',   behavior: 'FALL'  },
    { id: 'Fireflies',        name: 'Fireflies',        icon: 'spark',   behavior: 'FLOAT' },
    { id: 'Meteor',           name: 'Meteor Shower',    icon: 'comet',   behavior: 'FALL'  },
    { id: 'Cosmic',           name: 'Cosmic Drift',     icon: 'orbit',   behavior: 'EMBER' },
    { id: 'Sandstorm',        name: 'Sandstorm',        icon: 'dune',    behavior: 'MIST'  },
    { id: 'Bioluminescence',  name: 'Bioluminescence',  icon: 'wave',    behavior: 'CHAOS' },
    { id: 'MoltenGold',       name: 'Molten Gold',      icon: 'ember',   behavior: 'EMBER' },
    { id: 'ShadowWisp',       name: 'Shadow Wisp',      icon: 'wisp',    behavior: 'MIST'  },
    { id: 'Stardust',         name: 'Stardust',         icon: 'star',    behavior: 'FLOAT' },
    { id: 'NeonGlitch',       name: 'Neon Glitch',      icon: 'bolt',    behavior: 'CHAOS' },
    { id: 'SolarFlare',       name: 'Solar Flare',      icon: 'sun',     behavior: 'EMBER' },
    { id: 'ToxicBubble',      name: 'Toxic Bubble',     icon: 'bubble',  behavior: 'FLOAT' },
];

// ============================================================
//  SHARED CONSTANTS
// ============================================================

const TAU = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

// v1.5.0: canvas blend modes accepted on AmbientConfig.blendMode. Superset of
// what every browser has shipped for years; validation catches typos before a
// silent no-op renders.
const VALID_BLEND_MODES = [
    'source-over', 'lighter', 'screen', 'multiply', 'overlay',
    'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light',
    'soft-light', 'difference', 'exclusion', 'hue', 'saturation',
    'color', 'luminosity',
];

// 360-entry sine LUT for turbulence and MIST breathing.
const SIN = new Float32Array(360);
for (let i = 0; i < 360; i++) SIN[i] = Math.sin(i * DEG_TO_RAD);

// Sprite logical sizes per behavior class.
const SPRITE_LOGICAL_MIST = 128;
const SPRITE_LOGICAL_CORE = 64;

// Never advance more than 50ms in one step (10x a 60fps frame). Prevents
// catch-up spikes when a tab wakes up.
const DT_CLAMP_MS = 50;

// Delta-time reference: 60fps = 16.667ms/frame. Velocities are tuned per
// frame at 60fps; scaling by dt/16 makes any refresh rate match.
const DT_REF_MS = 16;

// Alpha cutoff below which we skip the drawImage call altogether.
const ALPHA_EPSILON = 0.01;

// MIST life is a ms accumulator; wrap keeps the breath phase stable and
// avoids Float32 drift on multi-minute sessions.
const MIST_LIFE_WRAP_MS = 72_000;
const MIST_LIFE_WRAP_INV = 1 / MIST_LIFE_WRAP_MS;

// How far past the top edge an EMBER/FLOAT particle can go before we
// consider it dead and respawn from the bottom.
const RESPAWN_MARGIN_Y = 50;

// ---- v1.2.0: FALL ----
// Per-frame-at-60 units, like every other behavior here. Note these are NOT the
// px/second constants from @zakkster/lite-snow or @zakkster/lite-rain; those
// engines integrate against a seconds-based dt. Do not copy numbers across.
const FALL_GRAVITY = 0.12;            // velocity gained per 60fps frame
const FALL_DRIFT_SPEED_MIN = 1.5;     // sway phase advance, degrees per frame
const FALL_DRIFT_SPEED_VAR = 2.5;
const FALL_SPAWN_DRIFT = 120;         // widen the spawn band into the wind
const FALL_CULL_X = 120;              // horizontal cull margin
const FALL_SIZE_JITTER = 0.4;
// Fade-in length, in 60fps frames. Previously the window was a fixed slice of
// `life` (< 0.1), which made its duration 0.1/decay frames -- 14 for Meteor
// but 167 for Snow, purely as a side effect of a `decay` most FALL themes
// never reach because geometry culls them first.
const FALL_FADE_IN_FRAMES = 12;

// ---- v1.2.0: parallax depth bands ----
// Discrete z layers instead of a uniform ramp. Same trichotomy lite-snow and
// lite-rain bucket into (near / mid / far); here it only affects spawn-time
// attribute correlation -- no extra draw pass.
const DEPTH_BAND_Z = [0.3, 0.6, 0.9];
const DEPTH_BAND_JITTER = 0.08;
const DEPTH_Z_MIN = 0.2;

// ---- v1.2.0: pointer falloff ----
// Cosine ease, 1 at the pointer and 0 at the radius, smooth at both ends.
// Power-of-two length so the lookup is a mask, not a modulo.
const FALLOFF_STEPS = 64;
const FALLOFF_MASK = FALLOFF_STEPS - 1;
const FALLOFF = new Float32Array(FALLOFF_STEPS);
for (let i = 0; i < FALLOFF_STEPS; i++) {
    FALLOFF[i] = 0.5 * (1 + Math.cos(Math.PI * (i / FALLOFF_MASK)));
}

const POINTER_OFF = 0;
const POINTER_REPEL = 1;
const POINTER_ATTRACT = -1;
const POINTER_DEFAULT_RADIUS = 140;
const POINTER_DEFAULT_STRENGTH = 8;

// Alpha-envelope constants, pre-computed reciprocals so hot loops multiply
// instead of divide. EMBER fade-in is at 0..0.2 (life * 5 = alpha frac);
// EMBER fade-out from 0.2..1 simplifies to 1.25 * (1 - life). FLOAT fade
// windows are 0..0.1 and 0.9..1 (life * 10 either direction).
const EMBER_FADE_IN_INV = 5;      // 1 / 0.2
const EMBER_FADE_OUT_INV = 1.25;  // 1 / 0.8
const FLOAT_FADE_INV = 10;        // 1 / 0.1
const FLOAT_SWAY_AMP = 0.5;       // px per 60fps frame of horizontal sway

// ============================================================
//  DPR-AWARE SPRITE CACHE (nested Map, zero string allocation)
// ============================================================

// Two-level index: Map<color, Map<physicalSize, HTMLCanvasElement>>. Avoids
// the `${color}:${physical}` string concatenation that would otherwise burn
// one string allocation per lookup.
const _sprites = new Map();

// Live-holder refcount, keyed by color. A rasterized sprite is reachable from
// every particle that spawned with it (`p.spriteCanvas`), so dropping one is
// not a cache eviction -- it zeroes a canvas another instance is still
// blitting, and per the HTML spec `drawImage()` on a zero-dimension canvas
// throws InvalidStateError. Colors are therefore retained per instance and
// only freed once the last holder releases them.
const _spriteRefs = new Map();

/** Register `colors` as owned by one more instance. */
function _retainColors(colors) {
    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        const n = _spriteRefs.get(color);
        _spriteRefs.set(color, n === undefined ? 1 : n + 1);
    }
}

/** Drop a color's rasterized canvases and free their backing stores. */
function _evictColor(color) {
    const byPhysical = _sprites.get(color);
    if (byPhysical === undefined) return;
    for (const c of byPhysical.values()) {
        c.width = 0;
        c.height = 0;
    }
    _sprites.delete(color);
}

/** Release one instance's claim; evict only when the count reaches zero. */
function _releaseColors(colors) {
    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        const n = _spriteRefs.get(color);
        if (n === undefined) continue;
        if (n > 1) { _spriteRefs.set(color, n - 1); continue; }
        _spriteRefs.delete(color);
        _evictColor(color);
    }
}

/**
 * Get or build a sprite. `logicalSize` is what the caller draws at; we
 * rasterize at `logicalSize * dpr` and let drawImage downsample.
 */
function getSprite(color, logicalSize, dpr) {
    const physical = Math.max(1, Math.ceil(logicalSize * dpr));
    let byPhysical = _sprites.get(color);
    if (byPhysical === undefined) {
        byPhysical = new Map();
        _sprites.set(color, byPhysical);
    }
    const cached = byPhysical.get(physical);
    if (cached !== undefined) return cached;

    const c = document.createElement('canvas');
    c.width = physical;
    c.height = physical;
    const g2d = c.getContext('2d');
    const center = physical / 2;
    const grad = g2d.createRadialGradient(center, center, 0, center, center, center);

    if (logicalSize >= SPRITE_LOGICAL_MIST) {
        // Mist: soft blob, no bright core.
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
    } else {
        // Ember/Float/Chaos: bright white core, colored halo.
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, 'transparent');
    }
    g2d.fillStyle = grad;
    g2d.beginPath();
    g2d.arc(center, center, center, 0, TAU);
    g2d.fill();
    byPhysical.set(physical, c);
    return c;
}

/**
 * Drop sprites matching a color set (or the whole cache when `colors` is
 * omitted). Called on updateConfig({colors|spark}) and on destroy().
 */
export function clearAmbientSpriteCache(colors) {
    // A color still claimed by a live instance is dropped from the index but
    // its canvas is left intact -- particles holding it keep drawing until
    // they respawn, and the next spawn re-rasterizes. That is the "one frame
    // of re-rasterization" this function has always promised; before the
    // refcount it actually zeroed the canvas under the live holder.
    const keys = colors || Array.from(_sprites.keys());
    for (let i = 0; i < keys.length; i++) {
        const color = keys[i];
        if (_spriteRefs.has(color)) _sprites.delete(color);
        else _evictColor(color);
    }
}

// ============================================================
//  PURE HELPERS (exported for tests and downstream reuse)
// ============================================================

/**
 * Merge a theme with overrides. `wind` is a nested object; a partial `wind`
 * override merges shallowly rather than replacing the whole vector.
 */
export function mergeThemeConfig(base, overrides) {
    if (!overrides) return { ...base, wind: { ...base.wind } };
    const wind = overrides.wind
        ? { x: overrides.wind.x ?? base.wind.x, y: overrides.wind.y ?? base.wind.y }
        : { ...base.wind };
    return { ...base, ...overrides, wind };
}

/**
 * Validate a config object. Throws with a specific message on the first
 * violation. Cheap enough to run on every setTheme.
 */

// v1.6.0: curve validator. Enforces array of >= 2 finite numbers; caught early
// so a typo doesn't render as a silent no-op on the hot path.
function validateCurve(curve, name) {
    if (!Array.isArray(curve)) {
        throw new TypeError(`validateConfig: ${name} must be an array, got ${typeof curve}`);
    }
    if (curve.length < 2) {
        throw new RangeError(`validateConfig: ${name} needs at least 2 control points, got ${curve.length}`);
    }
    for (let i = 0; i < curve.length; i++) {
        const v = curve[i];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new TypeError(`validateConfig: ${name}[${i}] must be a finite number, got ${JSON.stringify(v)}`);
        }
    }
}

export function validateConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') throw new TypeError('AmbientFX: config must be an object');
    if (typeof cfg.behavior !== 'string' || BEHAVIORS[cfg.behavior] === undefined) {
        throw new RangeError('AmbientFX: behavior must be a registered name (' + Object.keys(BEHAVIORS).join(', ') + ')');
    }
    if (!Array.isArray(cfg.colors) || cfg.colors.length === 0) {
        throw new TypeError('AmbientFX: colors must be a non-empty array');
    }
    if (typeof cfg.count !== 'number' || cfg.count < 0 || (cfg.count | 0) !== cfg.count) {
        throw new RangeError('AmbientFX: count must be a non-negative integer');
    }
    if (typeof cfg.alpha !== 'number' || cfg.alpha < 0 || cfg.alpha > 1) {
        throw new RangeError('AmbientFX: alpha must be in [0,1]');
    }
    if (typeof cfg.spark !== 'string' || cfg.spark.length === 0) {
        throw new TypeError('AmbientFX: spark must be a non-empty color string');
    }
    // v1.1.0 -- these were unchecked. Every one is read raw by the hot loop
    // (`cfg.wind.x`, `cfg.size`, `cfg.speed`, ...), so an absent field became
    // `undefined` -> NaN positions -> particles silently vanish, no throw.
    // Harmless while THEMES was a closed set of complete presets; a live hazard
    // now that registerTheme accepts third-party configs.
    if (!cfg.wind || typeof cfg.wind.x !== 'number' || typeof cfg.wind.y !== 'number'
        || !Number.isFinite(cfg.wind.x) || !Number.isFinite(cfg.wind.y)) {
        throw new TypeError('AmbientFX: wind must be { x: number, y: number }');
    }
    for (let i = 0; i < NUMERIC_FIELDS.length; i++) {
        const key = NUMERIC_FIELDS[i];
        const v = cfg[key];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            throw new RangeError('AmbientFX: ' + key + ' must be a finite non-negative number');
        }
    }
    // Optional as of v1.2.0 -- absent means "off", so every pre-1.2 preset and
    // every already-registered custom theme keeps validating unchanged.
    if (cfg.depthBands !== undefined && cfg.depthBands !== 0 && cfg.depthBands !== 2 && cfg.depthBands !== 3) {
        throw new RangeError('AmbientFX: depthBands must be 0, 2, or 3');
    }
    if (cfg.stretch !== undefined
        && (typeof cfg.stretch !== 'number' || !Number.isFinite(cfg.stretch) || cfg.stretch < 0)) {
        throw new RangeError('AmbientFX: stretch must be a finite non-negative number');
    }
        if (cfg.blendMode !== undefined) {
        const bm = cfg.blendMode;
        if (typeof bm !== 'string' || VALID_BLEND_MODES.indexOf(bm) < 0) {
            throw new TypeError(
                `validateConfig: blendMode must be one of ${VALID_BLEND_MODES.join(', ')}, got ${JSON.stringify(bm)}`
            );
        }
    }

    if (cfg.alphaCurve !== undefined) validateCurve(cfg.alphaCurve, 'alphaCurve');
    if (cfg.sizeCurve !== undefined) validateCurve(cfg.sizeCurve, 'sizeCurve');

    return cfg;
}

/** Fields the behavior tick loops read raw. All must be finite and >= 0. */
const NUMERIC_FIELDS = ['decay', 'speed', 'size', 'turbulence'];

/**
 * Sample a depth value for a spawning particle (v1.2.0).
 *
 * `bands` of 2 or 3 quantizes z into discrete parallax layers; anything else
 * (including the `undefined` every pre-1.2 preset carries) falls back to the
 * original uniform ramp, so existing themes are pixel-identical.
 *
 * z is already the correlation hub: every behavior multiplies size, alpha and
 * per-frame movement by it. Banding it is therefore the whole parallax feature --
 * near particles come out big, fast and opaque; far ones small, slow and faint,
 * with no second draw pass and no new per-frame work.
 */
export function sampleDepth(bands) {
    if (bands !== 2 && bands !== 3) return Math.random() * 0.8 + DEPTH_Z_MIN;
    // Two bands take the extremes (0.3 / 0.9) for maximum separation.
    const i = bands === 2 ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() * 3) | 0;
    const z = DEPTH_BAND_Z[i] + (Math.random() - 0.5) * DEPTH_BAND_JITTER;
    return z < DEPTH_Z_MIN ? DEPTH_Z_MIN : z > 1 ? 1 : z;
}

/** Look up a theme by name. Mirrors resolveBehavior's error shape. */
function resolveTheme(name) {
    const t = THEMES[name];
    if (t === undefined) {
        throw new RangeError('AmbientFX: unknown theme "' + name + '"; registered: ' + Object.keys(THEMES).join(', '));
    }
    return t;
}

/** Default THEME_META icon per built-in behavior. Keeps the existing vocabulary. */
const DEFAULT_ICONS = Object.assign(Object.create(null), {
    EMBER: 'sparks', MIST: 'fog', FLOAT: 'wind', CHAOS: 'orb', FALL: 'snow',
});

/**
 * Register a custom theme preset, or override a built-in. The theme is instantly
 * usable via createAmbientFX({ theme }) and setTheme(), and is reflected in
 * THEME_META so existing theme pickers keep working with no code change.
 *
 * `config` must be a COMPLETE preset (same shape as a built-in) -- it is run
 * through validateConfig, which as of v1.1.0 rejects missing wind/size/speed/
 * decay/turbulence rather than letting them NaN out the render loop.
 *
 * @param {string} name
 * @param {AmbientConfig} config
 * @param {{ name?: string, icon?: string }} [meta] Optional display metadata.
 *   Omitted fields fall back to the existing entry (when overriding a built-in),
 *   then to a de-camelCased name and a behavior-derived icon.
 */
export function registerTheme(name, config, meta) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('registerTheme: name must be a non-empty string');
    }
    if (!config || typeof config !== 'object') {
        throw new TypeError('registerTheme: config must be an object');
    }
    const validated = validateConfig(mergeThemeConfig(config, null));
    THEMES[name] = validated;

    const idx = THEME_META.findIndex((m) => m.id === name);
    const prev = idx >= 0 ? THEME_META[idx] : null;
    const entry = {
        id: name,
        name: (meta && meta.name) || (prev && prev.name)
            || name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^[a-z]/, (c) => c.toUpperCase()),
        icon: (meta && meta.icon) || (prev && prev.icon) || DEFAULT_ICONS[validated.behavior] || 'orb',
        behavior: validated.behavior,
    };
    if (idx >= 0) THEME_META[idx] = entry; else THEME_META.push(entry);
    return validated;
}

/**
 * Degrade a config for `prefers-reduced-motion: reduce`. Low count, low speed,
 * calmer turbulence -- theme colors and palette stay intact so the atmosphere is
 * still recognizable, just still-ish. Pure; returns a fresh object.
 */
export function degradeForReducedMotion(cfg) {
    return {
        ...cfg,
        wind: { ...cfg.wind },
        count: Math.max(REDUCED_COUNT_MIN, Math.min(REDUCED_COUNT_MAX, (cfg.count * REDUCED_COUNT_SCALE) | 0)),
        speed: Math.max(REDUCED_SPEED_MIN, cfg.speed * REDUCED_SPEED_SCALE),
        turbulence: cfg.turbulence * REDUCED_TURBULENCE_SCALE,
    };
}

const REDUCED_COUNT_SCALE = 0.2;
const REDUCED_COUNT_MIN = 8;
const REDUCED_COUNT_MAX = 40;
const REDUCED_SPEED_SCALE = 0.35;
const REDUCED_SPEED_MIN = 0.05;
const REDUCED_TURBULENCE_SCALE = 0.6;

/**
 * Normalize a pointer spec (v1.2.0). Pure; returns a fresh object.
 * Pointer reactivity is an *interaction* concern, not a look concern, so it
 * lives on the instance rather than inside a theme preset -- you would not bake
 * "repel" into what Fire looks like.
 */
export function resolvePointer(spec) {
    const src = spec || {};
    const mode = src.mode === undefined ? 'off' : src.mode;
    if (mode !== 'off' && mode !== 'repel' && mode !== 'attract') {
        throw new RangeError('AmbientFX: pointer.mode must be "off", "repel" or "attract"');
    }
    const radius = src.radius === undefined ? POINTER_DEFAULT_RADIUS : src.radius;
    if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
        throw new RangeError('AmbientFX: pointer.radius must be a finite number > 0');
    }
    const strength = src.strength === undefined ? POINTER_DEFAULT_STRENGTH : src.strength;
    if (typeof strength !== 'number' || !Number.isFinite(strength) || strength < 0) {
        throw new RangeError('AmbientFX: pointer.strength must be a finite number >= 0');
    }
    return { mode, radius, strength };
}

/**
 * Delta-time scale factor. Frame velocities are tuned at 60fps; multiply
 * per-frame constants by this to remain framerate-independent.
 */
export function deltaScale(dtMs) {
    return dtMs / DT_REF_MS;
}

/**
 * Signed modulo that keeps SIN LUT indices in [0, 359] under negative input.
 */
export function sinLut(index) {
    const i = ((index | 0) % 360 + 360) % 360;
    return SIN[i];
}

/**
 * Alpha envelope for a life value in [0, 1]. Kept as a shared helper for
 * tests and downstream reuse; the built-in behaviors inline these curves
 * inside their tick loops to avoid the function call per particle.
 */
export function envelopeAlpha(mode, life, maxAlpha) {
    if (mode === 'EMBER') {
        if (life < 0.2) return life * EMBER_FADE_IN_INV * maxAlpha;
        return EMBER_FADE_OUT_INV * (1 - life) * maxAlpha;
    }
    if (mode === 'FLOAT') {
        if (life < 0.1) return life * FLOAT_FADE_INV * maxAlpha;
        if (life > 0.9) return (1 - life) * FLOAT_FADE_INV * maxAlpha;
        return maxAlpha;
    }
    return maxAlpha;
}


/**
 * Sample a linear curve at t. Curve is an array of >= 2 numbers, treated
 * as evenly spaced control points across life [0, 1]. Zero-alloc.
 *
 * Common shapes:
 *   [start, end]              -- linear from start to end.
 *   [start, mid, end]         -- piecewise linear via mid at t=0.5.
 *   [k0, k1, ... kN]          -- piecewise linear across N segments.
 *
 * Values outside [0, 1] clamp to the endpoints.
 *
 * @param {number[]} curve
 * @param {number}   t     Position in [0, 1]. Values outside clamp.
 * @returns {number}
 */
export function sampleCurve(curve, t) {
    if (!(t > 0)) return curve[0];   // also catches NaN
    const n = curve.length - 1;
    if (t >= 1) return curve[n];
    if (n === 1) {
        return curve[0] + (curve[1] - curve[0]) * t;
    }
    if (n === 2) {
        // 3-point piecewise linear through curve[1] at t=0.5.
        if (t < 0.5) {
            const u = t * 2;
            return curve[0] + (curve[1] - curve[0]) * u;
        }
        const u = (t - 0.5) * 2;
        return curve[1] + (curve[2] - curve[1]) * u;
    }
    // N-point piecewise linear across N segments.
    const segF = t * n;
    const seg = segF | 0;
    const u = segF - seg;
    return curve[seg] + (curve[seg + 1] - curve[seg]) * u;
}

/**
 * Empty-particle shape. Every instance-owned particle carries the union of
 * fields used by every behavior, always. This keeps V8's hidden class
 * stable across behavior swaps: no property is ever added or removed at
 * runtime, only mutated. Field-init values are 0/null/'' so the initial
 * hidden class picks up the right slot types (SMI, tagged, string).
 */
function makeParticle(id) {
    return {
        id,
        color: '',
        spriteCanvas: null,
        z: 0,
        life: 0,
        x: 0, y: 0,
        size: 0,
        vx: 0, vy: 0,
        decay: 0,
        maxAlpha: 0,
        // MIST-specific fields -- always present, zeroed for other behaviors.
        anchorX: 0, anchorY: 0,
        pulseOffset: 0,
        // FALL-specific fields (v1.2.0) -- same rule. `terminal` is this
        // particle's own terminal velocity, already scaled by its depth.
        terminal: 0,
        driftPhase: 0, driftSpeed: 0, driftAmp: 0,
    };
}

// =============================================================================
// Section  1  OKLCH <-> sRGB math (Bjoern Ottosson, public domain)
//
// Matrices split as scalar consts so V8 keeps them monomorphic and the JIT can
// hoist them out of any inner loop we later add. No array literals on the hot
// path.
// =============================================================================

// Scratch triples. Reused across every parse / lerp / format call so a 10 Hz
// updateConfig loop against lerpTheme allocates nothing per tick beyond the
// output hex strings (which are unavoidable -- strings are immutable).
const _oklchA   = new Float64Array(3);
const _oklchB   = new Float64Array(3);
const _oklchOut = new Float64Array(3);

// linear-sRGB -> LMS
const M1_00 = 0.4122214708, M1_01 = 0.5363325363, M1_02 = 0.0514459929;
const M1_10 = 0.2119034982, M1_11 = 0.6806995451, M1_12 = 0.1073969566;
const M1_20 = 0.0883024619, M1_21 = 0.2817188376, M1_22 = 0.6299787005;

// LMS' -> OKLab
const M2_00 = 0.2104542553, M2_01 =  0.7936177850, M2_02 = -0.0040720468;
const M2_10 = 1.9779984951, M2_11 = -2.4285922050, M2_12 =  0.4505937099;
const M2_20 = 0.0259040371, M2_21 =  0.7827717662, M2_22 = -0.8086757660;

// OKLab -> LMS' (inverse of M2)
const IM2_01 =  0.3963377774, IM2_02 =  0.2158037573;
const IM2_11 = -0.1055613458, IM2_12 = -0.0638541728;
const IM2_21 = -0.0894841775, IM2_22 = -1.2914855480;

// LMS -> linear-sRGB (inverse of M1)
const IM1_00 =  4.0767416621, IM1_01 = -3.3077115913, IM1_02 =  0.2309699292;
const IM1_10 = -1.2684380046, IM1_11 =  2.6097574011, IM1_12 = -0.3413193965;
const IM1_20 = -0.0041960863, IM1_21 = -0.7034186147, IM1_22 =  1.7076147010;

// DEG_TO_RAD comes from the module-level constants block above.
const RAD_TO_DEG = 180 / Math.PI;
const INV_2P4 = 1 / 2.4;
const INV_255 = 1 / 255;

function _srgbToLinear(u) {
    return u <= 0.04045
        ? u * (1 / 12.92)
        : Math.pow((u + 0.055) * (1 / 1.055), 2.4);
}

function _linearToSrgb(u) {
    return u <= 0.0031308
        ? u * 12.92
        : 1.055 * Math.pow(u, INV_2P4) - 0.055;
}

// =============================================================================
// Section  2  parseColor / formatColor -- public helpers
// =============================================================================

/**
 * Parse a color string into an OKLCH triple `[L, C, H]`.
 *
 * Accepts `#rgb`, `#rrggbb`, `rgb`, `rrggbb`, or `oklch(L C H)` / `oklch(L% C H)`.
 * Returns `out` if supplied (zero-alloc); otherwise allocates a Float64Array(3).
 *
 * Throws on unrecognized input. Does NOT clamp -- the returned OKLCH may lie
 * outside the sRGB gamut when parsed from a CSS oklch() literal.
 *
 * @param {string} input
 * @param {Float64Array=} out
 * @returns {Float64Array}
 */
export function parseColor(input, out) {
    if (typeof input !== 'string') {
        throw new TypeError('parseColor: expected string, got ' + typeof input);
    }
    const target = out !== undefined ? out : new Float64Array(3);

    // oklch(...) -- accept both space and comma separators, and % on L.
    if (input.length > 6 && input.charCodeAt(0) === 111 /* 'o' */) {
        const open = input.indexOf('(');
        const close = input.indexOf(')');
        if (open < 0 || close < 0) {
            throw new SyntaxError('parseColor: malformed oklch() literal: ' + input);
        }
        const body = input.slice(open + 1, close);
        // Split on ' ' / ',' / '/' (alpha ignored)
        const parts = body.replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
        if (parts.length < 3) {
            throw new SyntaxError('parseColor: oklch() needs 3 components: ' + input);
        }
        let L = parseFloat(parts[0]);
        if (parts[0].charCodeAt(parts[0].length - 1) === 37 /* '%' */) L *= 0.01;
        target[0] = L;
        target[1] = parseFloat(parts[1]);
        target[2] = parseFloat(parts[2]);
        return target;
    }

    // hex path -- strip leading '#'
    let s = input.charCodeAt(0) === 35 /* '#' */ ? input.slice(1) : input;
    if (s.length === 3) {
        // #rgb -> #rrggbb via char duplication (no alloc via template literal
        // here -- string concat is fine, this path is warm-not-hot)
        s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (s.length !== 6) {
        throw new SyntaxError('parseColor: hex must be 3 or 6 chars: ' + input);
    }
    // parseInt() prefix-parses -- '12zzzz' yields 0x12, not NaN -- so the old
    // NaN check let malformed input through as a plausible wrong color.
    // Validate every digit instead. Zero allocation.
    for (let i = 0; i < 6; i++) {
        const cc = s.charCodeAt(i);
        if (!((cc >= 48 && cc <= 57) || (cc >= 97 && cc <= 102) || (cc >= 65 && cc <= 70))) {
            throw new SyntaxError('parseColor: invalid hex: ' + input);
        }
    }
    const n = parseInt(s, 16);
    const r = _srgbToLinear(((n >> 16) & 0xff) * INV_255);
    const g = _srgbToLinear(((n >>  8) & 0xff) * INV_255);
    const b = _srgbToLinear(( n        & 0xff) * INV_255);

    const l_ = M1_00 * r + M1_01 * g + M1_02 * b;
    const m_ = M1_10 * r + M1_11 * g + M1_12 * b;
    const s_ = M1_20 * r + M1_21 * g + M1_22 * b;

    const lC = Math.cbrt(l_);
    const mC = Math.cbrt(m_);
    const sC = Math.cbrt(s_);

    const L = M2_00 * lC + M2_01 * mC + M2_02 * sC;
    const a = M2_10 * lC + M2_11 * mC + M2_12 * sC;
    const bLab = M2_20 * lC + M2_21 * mC + M2_22 * sC;

    target[0] = L;
    target[1] = Math.hypot(a, bLab);
    let h = Math.atan2(bLab, a) * RAD_TO_DEG;
    if (h < 0) h += 360;
    target[2] = h;
    return target;
}

// Alias with a clearer name at call sites that only take hex.
export const oklchFromHex = parseColor;

/**
 * Format an OKLCH triple as `#rrggbb`, gamut-clamped in linear sRGB.
 *
 * Uses the natural 8-bit quantization of the hex format as a sprite-cache
 * bound: an OKLCH lerp trajectory that would otherwise generate thousands of
 * near-identical intermediate stops collapses to O(dozens) of hex strings.
 *
 * @param {number} L  Lightness   [0..1] (values outside are clamped after conversion)
 * @param {number} C  Chroma      typically [0..0.4]
 * @param {number} H  Hue in deg  [0..360)
 * @returns {string}
 */
export function formatColor(L, C, H) {
    const hRad = H * DEG_TO_RAD;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + IM2_01 * a + IM2_02 * b;
    const m_ = L + IM2_11 * a + IM2_12 * b;
    const s_ = L + IM2_21 * a + IM2_22 * b;

    const lc = l_ * l_ * l_;
    const mc = m_ * m_ * m_;
    const sc = s_ * s_ * s_;

    let r = IM1_00 * lc + IM1_01 * mc + IM1_02 * sc;
    let g = IM1_10 * lc + IM1_11 * mc + IM1_12 * sc;
    let bB = IM1_20 * lc + IM1_21 * mc + IM1_22 * sc;

    r = _linearToSrgb(r);
    g = _linearToSrgb(g);
    bB = _linearToSrgb(bB);

    // Channel-independent clamp. Hueforge does chroma-direction gamut mapping;
    // ambient-fx doesn't need that fidelity -- a particle sprite blurs the
    // boundary anyway and the extra math would bloat this file.
    if (r < 0) r = 0; else if (r > 1) r = 1;
    if (g < 0) g = 0; else if (g > 1) g = 1;
    if (bB < 0) bB = 0; else if (bB > 1) bB = 1;

    const rI = (r * 255 + 0.5) | 0;
    const gI = (g * 255 + 0.5) | 0;
    const bI = (bB * 255 + 0.5) | 0;

    // One (r << 16) | (g << 8) | b integer -> 6-char hex via toString(16).
    // Single string allocation per call. That's the concession.
    const packed = (rI << 16) | (gI << 8) | bI;
    const hex = packed.toString(16);
    // Left-pad without regex: subtract from a static prefix.
    return '#000000'.slice(0, 7 - hex.length) + hex;
}

// Alias
export const hexFromOklch = formatColor;


// =============================================================================
// Section  3  colorsFromPalette -- hueforge bridge
//
// Accepts anything shaped like a palette source and returns a hex[] usable
// as `AmbientConfig.colors`. No import from hueforge -- the shape is duck-
// typed. If hueforge later changes its scale output, this stays compatible.
// =============================================================================

/**
 * Normalize a palette specification into `AmbientConfig.colors`-shaped hex[].
 *
 * Accepted item shapes (mixed within a single array is fine):
 *   - string:                   passed through if hex or oklch(), else parsed
 *   - `{ l, c, h }`:            OKLCH stop (hueforge ScaleStep shape)
 *   - `{ color: string }`:      { color } wrapper (hueforge token export)
 *   - `[position, colorOrObj]`: CSS-style stop tuple, position ignored
 *   - `{ offset, l, c, h }`:    positioned stop, offset ignored
 *
 * A count option evenly samples the input if provided; otherwise every stop
 * is emitted.
 *
 * @example  Direct from a hueforge scale
 *   const primary = createScale({ ... });
 *   fx.updateConfig({ colors: colorsFromPalette(primary.steps()) });
 *
 * @example  Manual OKLCH stops
 *   colorsFromPalette([{l: 0.7, c: 0.15, h: 30}, {l: 0.5, c: 0.2, h: 260}])
 *   // -> ['#c88a6b', '#4e5aa8']
 *
 * @param {Array} stops
 * @param {{ count?: number }=} opts
 * @returns {string[]}
 */
export function colorsFromPalette(stops, opts) {
    if (!Array.isArray(stops)) {
        throw new TypeError('colorsFromPalette: expected an array of stops');
    }
    if (stops.length === 0) return [];

    const wantCount = opts && typeof opts.count === 'number' && opts.count > 0
        ? opts.count | 0
        : stops.length;

    const out = new Array(wantCount);
    for (let i = 0; i < wantCount; i++) {
        // Evenly sample: index in [0, stops.length - 1] mapped linearly.
        const src = wantCount === 1
            ? 0
            : Math.round(i * (stops.length - 1) / (wantCount - 1));
        out[i] = _stopToHex(stops[src]);
    }
    return out;
}

function _stopToHex(stop) {
    // String -> return as-is if already a hex, else parse + reformat.
    if (typeof stop === 'string') {
        if (stop.charCodeAt(0) === 35 /* '#' */) return stop;
        parseColor(stop, _oklchOut);
        return formatColor(_oklchOut[0], _oklchOut[1], _oklchOut[2]);
    }

    // [pos, ...] tuple -> recurse on payload
    if (Array.isArray(stop)) {
        if (stop.length < 2) {
            throw new TypeError('colorsFromPalette: tuple stop needs [pos, color]');
        }
        return _stopToHex(stop[1]);
    }

    if (stop && typeof stop === 'object') {
        // { color: string } wrapper
        if (typeof stop.color === 'string') return _stopToHex(stop.color);

        // { l, c, h } / { L, C, H } / { offset, l, c, h } -- OKLCH triple
        const L = stop.l !== undefined ? stop.l : stop.L;
        const C = stop.c !== undefined ? stop.c : stop.C;
        const H = stop.h !== undefined ? stop.h : stop.H;
        if (typeof L === 'number' && typeof C === 'number' && typeof H === 'number') {
            return formatColor(L, C, H);
        }
    }

    throw new TypeError('colorsFromPalette: unrecognized stop shape: ' + JSON.stringify(stop));
}


// =============================================================================
// Section  4  lerpOklch / lerpTheme -- theme interpolation
// =============================================================================

/**
 * Interpolate two OKLCH triples into `out`. Hue takes the shortest arc.
 * All three inputs are Float64Array-ish (any indexable [L, C, H]).
 *
 * @param {ArrayLike<number>} a  triple at t = 0
 * @param {ArrayLike<number>} b  triple at t = 1
 * @param {number}            t  [0, 1] (unclamped -- extrapolation is legal)
 * @param {Float64Array}      out
 * @returns {Float64Array} `out`
 */
export function lerpOklch(a, b, t, out) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;

    // Shortest-arc hue. Handle wrap around 0/360.
    let ha = a[2], hb = b[2];
    let dh = hb - ha;
    if (dh >  180) dh -= 360;
    if (dh < -180) dh += 360;
    let h = ha + dh * t;
    if (h < 0)   h += 360;
    if (h >= 360) h -= 360;
    out[2] = h;
    return out;
}

/**
 * Interpolate two full theme configs. Colors lerp channel-wise in OKLCH;
 * scalars lerp linearly; wind lerps as a vector; discrete fields (behavior,
 * depthBands, stretch) step at t = 0.5.
 *
 * When `out` is supplied, the returned object is that same reference,
 * mutated in place (its `colors` array and `wind` object are reused). This
 * makes it safe to call at 10 Hz from a `raf`/`effect` without churn.
 *
 * The output's `colors.length` matches `min(a.colors.length, b.colors.length)`.
 * If `a` and `b` differ in behavior, the output takes `a`'s for t < 0.5 and
 * `b`'s for t >= 0.5 -- this is intentional: EMBER<->MIST at t = 0.4 is not a
 * meaningful thing to render, and a hard swap at the midpoint is the least
 * jarring choice. Same-behavior transitions are the smooth case.
 *
 * Sprite-cache note: each call generates fresh hex strings, and each
 * hex string that reaches the render loop becomes a sprite-cache entry.
 * For a wide OKLCH sweep the cache can grow to hundreds of entries per
 * palette slot over a long transition (rough guide: ~= min(unique-t-calls,
 * gamut-span-in-8-bit-steps)). Two mitigations:
 *
 *   1. Drive `t` at a lower rate -- 10 Hz over a 5 s transition emits ~= 50
 *      unique hex per slot, which is the intended use case and needs no
 *      cleanup.
 *   2. Call `clearAmbientSpriteCache()` after a completed transition to
 *      reclaim the intermediate sprites; there will be one frame of
 *      re-rasterization on the next tick.
 *
 * @param {AmbientConfig} a
 * @param {AmbientConfig} b
 * @param {number}        t   [0, 1], clamped internally
 * @param {AmbientConfig=} out
 * @returns {AmbientConfig}
 */
export function lerpTheme(a, b, t, out) {
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const past = t >= 0.5;

    // Colors: element-wise OKLCH lerp on the shorter of the two arrays.
    const n = Math.min(a.colors.length, b.colors.length);
    let colors;
    if (out && Array.isArray(out.colors)) {
        colors = out.colors;
        if (colors.length !== n) colors.length = n;
    } else {
        colors = new Array(n);
    }
    for (let i = 0; i < n; i++) {
        parseColor(a.colors[i], _oklchA);
        parseColor(b.colors[i], _oklchB);
        lerpOklch(_oklchA, _oklchB, t, _oklchOut);
        colors[i] = formatColor(_oklchOut[0], _oklchOut[1], _oklchOut[2]);
    }

    // Spark -- single OKLCH lerp.
    parseColor(a.spark, _oklchA);
    parseColor(b.spark, _oklchB);
    lerpOklch(_oklchA, _oklchB, t, _oklchOut);
    const spark = formatColor(_oklchOut[0], _oklchOut[1], _oklchOut[2]);

    // Wind: reused object if `out` supplied.
    let wind;
    if (out && out.wind && typeof out.wind === 'object') {
        wind = out.wind;
        wind.x = a.wind.x + (b.wind.x - a.wind.x) * t;
        wind.y = a.wind.y + (b.wind.y - a.wind.y) * t;
    } else {
        wind = {
            x: a.wind.x + (b.wind.x - a.wind.x) * t,
            y: a.wind.y + (b.wind.y - a.wind.y) * t,
        };
    }

    // Target: reuse `out` or fresh.
    const dst = out !== undefined ? out : {};
    dst.behavior   = past ? b.behavior : a.behavior;
    dst.colors     = colors;
    dst.spark      = spark;
    dst.count      = Math.round(a.count + (b.count - a.count) * t);
    dst.wind       = wind;
    dst.decay      = a.decay      + (b.decay      - a.decay)      * t;
    dst.speed      = a.speed      + (b.speed      - a.speed)      * t;
    dst.size       = a.size       + (b.size       - a.size)       * t;
    dst.alpha      = a.alpha      + (b.alpha      - a.alpha)      * t;
    dst.turbulence = a.turbulence + (b.turbulence - a.turbulence) * t;

    // Discrete v1.2 fields: step at midpoint. Undefined stays undefined so
    // validateConfig doesn't reject the output.
    const srcDiscrete = past ? b : a;
    if (srcDiscrete.depthBands !== undefined) dst.depthBands = srcDiscrete.depthBands;
    else delete dst.depthBands;
    if (srcDiscrete.stretch !== undefined)    dst.stretch    = srcDiscrete.stretch;
    else delete dst.stretch;

    return dst;
}



// ============================================================
//  FRAME-BUDGET AUTO-DEGRADER  (v1.4.0)
// ============================================================

/**
 * Rolling p90 frame-time watcher that adjusts `count` down under load and
 * restores toward the base when headroom returns. Fixed 32-slot Float32Array
 * ring (power of 2 -> bitmask indexing). Callback fires only on transitions,
 * not per frame, so steady-state cost is zero allocations.
 *
 * Wired into createAmbientFX via `options.frameBudget` and the returned
 * `instance.frameBudget` / `instance.setFrameBudget(spec)` accessors. Also
 * usable standalone if you want to drive count from a custom render loop.
 *
 * @example
 *   const fx = createAmbientFX(canvas, {
 *       theme: 'Aurora',
 *       frameBudget: {
 *           targetMs: 20,
 *           onDegrade: e => console.log(e.reason, e.from, '->', e.to),
 *       },
 *   });
 */

const FRAME_BUDGET_RING_SIZE = 32;
const FRAME_BUDGET_RING_MASK = 31;

// Module-scratch for p90 sort. Zero-allocation across successive note() calls.
const _frameBudgetSortScratch = new Float32Array(FRAME_BUDGET_RING_SIZE);

function _frameBudgetP90(ring, ringLen) {
    for (let i = 0; i < ringLen; i++) _frameBudgetSortScratch[i] = ring[i];
    _frameBudgetSortScratch.subarray(0, ringLen).sort();
    const idx = ringLen - 1 - ((ringLen * 0.1) | 0);
    return _frameBudgetSortScratch[idx];
}

/**
 * Build a frame-budget auto-degrader. Returns a pure state machine: no DOM
 * access, no timers, no owner registration. Feed `note(dtMs, count)` on every
 * frame; act on the return value.
 *
 * All options optional. Defaults tune for a ~50 fps floor (targetMs 20 ms)
 * with 30% headroom before restore.
 *
 * @param {object} [opts]
 * @param {number} [opts.targetMs=20]   p90 above this triggers a degrade step
 * @param {number} [opts.restoreMs]     defaults to targetMs * 0.7
 * @param {number} [opts.cooldown=60]   frames between adjustments
 * @param {number} [opts.stepFrac=0.1]  fraction of base count to add/subtract per step
 * @param {number} [opts.minCount=20]   hard floor -- never degrades below this
 * @param {(e:{from:number,to:number,reason:string,p90:number}) => void} [opts.onDegrade]
 */
export function createFrameBudget(opts) {
    const o = opts || {};
    const targetMs   = o.targetMs   != null ? +o.targetMs   : 20;
    const restoreMs  = o.restoreMs  != null ? +o.restoreMs  : targetMs * 0.7;
    const cooldown   = o.cooldown   != null ? (o.cooldown | 0) : 60;
    const stepFrac   = o.stepFrac   != null ? +o.stepFrac   : 0.1;
    const minCount   = o.minCount   != null ? (o.minCount | 0) : 20;
    const onDegrade  = typeof o.onDegrade === 'function' ? o.onDegrade : null;

    if (!(targetMs > 0)) throw new RangeError('frameBudget.targetMs must be > 0');
    if (!(restoreMs > 0 && restoreMs < targetMs)) {
        throw new RangeError('frameBudget.restoreMs must be in (0, targetMs)');
    }

    const ring = new Float32Array(FRAME_BUDGET_RING_SIZE);
    let ringIdx = 0;
    let ringLen = 0;
    let cooldownRemaining = 0;
    let baseCount = 0;
    let currentCount = 0;

    return {
        get targetMs()     { return targetMs; },
        get restoreMs()    { return restoreMs; },
        get minCount()     { return minCount; },
        get baseCount()    { return baseCount; },
        get currentCount() { return currentCount; },
        get windowFilled() { return ringLen === FRAME_BUDGET_RING_SIZE; },

        /**
         * Called from the tick loop with the clamped dt in ms and the
         * currently-rendering count.
         * @returns {number} negative -> no change, else the new count to apply.
         */
        note(dtMs, count) {
            ring[ringIdx] = dtMs;
            ringIdx = (ringIdx + 1) & FRAME_BUDGET_RING_MASK;
            if (ringLen < FRAME_BUDGET_RING_SIZE) ringLen++;

            if (baseCount === 0 && count > 0) baseCount = count;
            currentCount = count;

            if (cooldownRemaining > 0) { cooldownRemaining--; return -1; }
            if (ringLen < FRAME_BUDGET_RING_SIZE) return -1;

            const p = _frameBudgetP90(ring, ringLen);

            if (p > targetMs && currentCount > minCount) {
                const step = Math.max(1, (baseCount * stepFrac) | 0);
                const next = Math.max(minCount, currentCount - step);
                cooldownRemaining = cooldown;
                if (onDegrade) onDegrade({
                    from: currentCount, to: next, reason: 'over-budget', p90: p,
                });
                return next;
            }

            if (p < restoreMs && currentCount < baseCount) {
                const step = Math.max(1, (baseCount * stepFrac) | 0);
                const next = Math.min(baseCount, currentCount + step);
                cooldownRemaining = cooldown;
                if (onDegrade) onDegrade({
                    from: currentCount, to: next, reason: 'restore', p90: p,
                });
                return next;
            }

            return -1;
        },

        /** Update the base count. Call whenever `cfg.count` shifts. */
        setBaseCount(n) {
            baseCount = n | 0;
            if (currentCount === 0) currentCount = baseCount;
        },

        /** Wipe the window. Call on visibility resume or long pauses. */
        reset() {
            ringIdx = 0;
            ringLen = 0;
            cooldownRemaining = 0;
        },
    };
}


/**
 * Internal: resolve a frameBudget option value into an instance or null.
 * Not exported -- shape matches the createAmbientFX option contract.
 */
function _resolveFrameBudget(spec) {
    if (spec == null || spec === false) return null;
    if (spec === true) return createFrameBudget({});
    if (typeof spec === 'object') return createFrameBudget(spec);
    throw new TypeError('frameBudget: expected boolean | object | null, got ' + typeof spec);
}


// ============================================================
//  BEHAVIOR REGISTRY
// ============================================================

/**
 * Every behavior is a `{ spriteLogical, spawn, tick }` triple.
 *
 * - `spriteLogical` -- the CSS-pixel size at which sprites for this
 *   behavior are rasterized. Two categories today: MIST at 128, everything
 *   else at 64. Custom behaviors pick their own.
 * - `spawn(p, frame)` -- populate/reset a particle from cfg + frame state.
 *   MUST set every field, including a resolved `spriteCanvas` via
 *   `frame.getSprite(color, spriteLogical)`. MUST NOT add new fields to
 *   `p` (the shape is monomorphic; see makeParticle).
 * - `tick(particles, ctx, frame)` -- advance and render every particle for
 *   one frame. Owns its own physics + alpha envelope. Calls
 *   `frame.respawn(p, false)` for dead particles.
 *
 * `frame` is a pooled context object owned by the instance. Do not retain
 * references to it or its fields past the current call.
 */
export const BEHAVIORS = Object.create(null);

/**
 * Register a custom behavior. Overwrites any existing entry with the same
 * name; the four built-in behaviors are registered during module init and
 * can be replaced if needed.
 */
export function registerBehavior(name, def) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('registerBehavior: name must be a non-empty string');
    }
    if (!def || typeof def.spawn !== 'function' || typeof def.tick !== 'function') {
        throw new TypeError('registerBehavior: def must have spawn() and tick() functions');
    }
    if (typeof def.spriteLogical !== 'number' || def.spriteLogical <= 0) {
        throw new TypeError('registerBehavior: def.spriteLogical must be a positive number');
    }
    BEHAVIORS[name] = def;
}

/** Look up a behavior by name. Throws with a helpful message if unknown. */
function resolveBehavior(name) {
    const b = BEHAVIORS[name];
    if (b === undefined) {
        throw new RangeError('AmbientFX: unknown behavior "' + name + '"; registered: ' + Object.keys(BEHAVIORS).join(', '));
    }
    return b;
}

// ---- Built-in: EMBER ----------------------------------------
BEHAVIORS.EMBER = {
    spriteLogical: SPRITE_LOGICAL_CORE,

    spawn(p, frame) {
        const cfg = frame.cfg;
        const W = frame.W;
        const H = frame.H;
        p.z = sampleDepth(cfg.depthBands);
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = frame.isInit ? Math.random() : 0;
        p.x = Math.random() * W;
        p.y = frame.isInit ? Math.random() * H : H + 20;
        p.size = (Math.random() * cfg.size + 2) * p.z;
        p.vx = (Math.random() - 0.5) * 0.5;
        const isSuper = Math.random() > 0.85;
        p.decay = isSuper ? cfg.decay * 0.3 : cfg.decay;
        p.vy = isSuper ? cfg.speed * 1.5 : cfg.speed;
        p.maxAlpha = cfg.alpha * p.z;
        // Zero MIST-only fields so the monomorphic shape is stable.
        p.anchorX = 0;
        p.anchorY = 0;
        p.pulseOffset = 0;
        p.terminal = 0;
        p.driftPhase = 0;
        p.driftSpeed = 0;
        p.driftAmp = 0;
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const alphaCurve = cfg.alphaCurve;
        const sizeCurve = cfg.sizeCurve;
        const wind = cfg.wind;
        const turbFactor = cfg.turbulence;
        const ds = frame.ds;
        const respawn = frame.respawn;
        // decay 0 means "no lifecycle": life never advances, so the envelope
        // has nothing to progress through. Collapse it to a flat maxAlpha
        // rather than leaving every particle pinned at the life-0 alpha of 0.
        // Hoisted; the loop body keeps its original instruction count.
        const fadeInSpan = cfg.decay > 0 ? 0.2 : 0;
        const fadeOutInv = cfg.decay > 0 ? EMBER_FADE_OUT_INV : 1;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const turbIdx = (p.y * 0.5) | 0;
            const turb = sinLut(turbIdx) * turbFactor;
            const moveX = (p.vx + wind.x + turb) * p.z * ds;
            const moveY = (p.vy + wind.y) * p.z * ds;
            p.y -= moveY;
            p.x += moveX;
            p.life += p.decay * ds;
            // Death is a life test, not an alpha test. `alpha <= 0` was also
            // true at life 0 and whenever maxAlpha was 0, so a config with
            // decay: 0 or alpha: 0 -- both of which validateConfig accepts --
            // respawned every particle on every frame and rendered nothing.
            if (p.y < -RESPAWN_MARGIN_Y || p.life >= 1) { respawn(p, false); continue; }
            let alpha = p.life < fadeInSpan
                ? p.life * EMBER_FADE_IN_INV * p.maxAlpha
                : fadeOutInv * (1 - p.life) * p.maxAlpha;
            if (alphaCurve !== undefined) alpha *= sampleCurve(alphaCurve, p.life);
            if (alpha > ALPHA_EPSILON) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const drawSize = sizeCurve !== undefined ? p.size * sampleCurve(sizeCurve, p.life) : p.size;
                if (drawSize >= 1) {
                    const half = drawSize * 0.5;
                    ctx.drawImage(
                        p.spriteCanvas,
                        (p.x - half) | 0,
                        (p.y - half) | 0,
                        drawSize | 0,
                        drawSize | 0,
                    );
                }
            }
        }
    },
};

// ---- Built-in: MIST -----------------------------------------
BEHAVIORS.MIST = {
    spriteLogical: SPRITE_LOGICAL_MIST,

    spawn(p, frame) {
        const cfg = frame.cfg;
        const W = frame.W;
        const H = frame.H;
        p.z = sampleDepth(cfg.depthBands);
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_MIST);
        p.life = frame.isInit ? Math.random() : 0;
        p.x = Math.random() * W;
        p.y = Math.random() * H;
        p.anchorX = p.x;
        p.anchorY = p.y;
        p.size = cfg.size * (0.6 + p.z * 0.4);
        p.pulseOffset = (Math.random() * 360) | 0;
        p.maxAlpha = cfg.alpha * p.z;
        p.vx = 0;
        p.vy = 0;
        p.decay = 0;
        p.terminal = 0;
        p.driftPhase = 0;
        p.driftSpeed = 0;
        p.driftAmp = 0;
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const alphaCurve = cfg.alphaCurve;
        const sizeCurve = cfg.sizeCurve;
        const wind = cfg.wind;
        const turbFactor = cfg.turbulence;
        const ds = frame.ds;
        const dt = frame.dt;
        const W = frame.W;
        const H = frame.H;
        const margin = cfg.size + 100;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            // Accumulator: ms since spawn, wrapped to keep breath phase stable.
            p.life += dt;
            if (p.life > MIST_LIFE_WRAP_MS) p.life -= MIST_LIFE_WRAP_MS;
            const turbIdx = (p.anchorY * 0.5) | 0;
            const turb = sinLut(turbIdx) * turbFactor;
            const moveX = (wind.x + turb) * p.z * ds;
            const moveY = wind.y * p.z * ds;
            p.anchorX += moveX;
            p.anchorY += moveY;
            if (p.anchorX > W + margin) p.anchorX = -margin;
            else if (p.anchorX < -margin) p.anchorX = W + margin;
            if (p.anchorY > H + margin) p.anchorY = -margin;
            else if (p.anchorY < -margin) p.anchorY = H + margin;
            const timeIdx = (p.life * 0.05) | 0;
            const breath = (sinLut(timeIdx + p.pulseOffset) + 1) * 0.5;
            let alpha = 0.05 + breath * p.maxAlpha;
            // MIST p.life is milliseconds (0..MIST_LIFE_WRAP_MS), not the [0,1]
            // that curves expect; normalize before sampling so the curve spans
            // one wrap cycle instead of always clamping to its last point.
            const lifeN = alphaCurve !== undefined || sizeCurve !== undefined
                ? p.life * MIST_LIFE_WRAP_INV : 0;
            if (alphaCurve !== undefined) alpha *= sampleCurve(alphaCurve, lifeN);
            const scMul = sizeCurve !== undefined ? sampleCurve(sizeCurve, lifeN) : 1;
            const drawSize = p.size * (0.9 + breath * 0.2) * scMul;
            if (alpha > ALPHA_EPSILON && drawSize >= 1) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const half = drawSize * 0.5;
                ctx.drawImage(
                    p.spriteCanvas,
                    (p.anchorX - half) | 0,
                    (p.anchorY - half) | 0,
                    drawSize | 0,
                    drawSize | 0,
                );
            }
        }
    },
};

// ---- Built-in: FLOAT ----------------------------------------
BEHAVIORS.FLOAT = {
    spriteLogical: SPRITE_LOGICAL_CORE,

    spawn(p, frame) {
        const cfg = frame.cfg;
        const W = frame.W;
        const H = frame.H;
        p.z = sampleDepth(cfg.depthBands);
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = frame.isInit ? Math.random() : 0;
        p.x = Math.random() * W;
        p.y = frame.isInit ? Math.random() * H : H + 20;
        p.size = (Math.random() * cfg.size + 4) * p.z;
        p.vx = 0;
        p.vy = cfg.speed * (Math.random() * 0.5 + 0.5);
        p.decay = cfg.decay;
        p.maxAlpha = cfg.alpha * p.z;
        p.anchorX = 0;
        p.anchorY = 0;
        p.pulseOffset = 0;
        p.terminal = 0;
        p.driftPhase = 0;
        p.driftSpeed = 0;
        p.driftAmp = 0;
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const alphaCurve = cfg.alphaCurve;
        const sizeCurve = cfg.sizeCurve;
        const wind = cfg.wind;
        const ds = frame.ds;
        const respawn = frame.respawn;
        // See EMBER: decay 0 has no lifecycle, so both fade windows close.
        const fadeInSpan = cfg.decay > 0 ? 0.1 : 0;
        const fadeOutStart = cfg.decay > 0 ? 0.9 : 1;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const moveY = (p.vy + wind.y) * p.z * ds;
            p.y -= moveY;
            // `* ds` was missing: sway advanced once per frame rather than per
            // unit of frame time, so at 120fps FLOAT drifted sideways twice as
            // far per second as at 60. Every other term here is already scaled.
            p.x += Math.sin(p.y * 0.05) * FLOAT_SWAY_AMP * ds;
            p.life += p.decay * ds;
            if (p.y < -RESPAWN_MARGIN_Y || p.life >= 1) { respawn(p, false); continue; }
            let alpha;
            if (p.life < fadeInSpan) alpha = p.life * FLOAT_FADE_INV * p.maxAlpha;
            else if (p.life > fadeOutStart) alpha = (1 - p.life) * FLOAT_FADE_INV * p.maxAlpha;
            else alpha = p.maxAlpha;
            if (alphaCurve !== undefined) alpha *= sampleCurve(alphaCurve, p.life);
            if (alpha > ALPHA_EPSILON) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const drawSize = sizeCurve !== undefined ? p.size * sampleCurve(sizeCurve, p.life) : p.size;
                if (drawSize >= 1) {
                    const half = drawSize * 0.5;
                    ctx.drawImage(
                        p.spriteCanvas,
                        (p.x - half) | 0,
                        (p.y - half) | 0,
                        drawSize | 0,
                        drawSize | 0,
                    );
                }
            }
        }
    },
};

// ---- Built-in: CHAOS ----------------------------------------
BEHAVIORS.CHAOS = {
    spriteLogical: SPRITE_LOGICAL_CORE,

    spawn(p, frame) {
        const cfg = frame.cfg;
        const W = frame.W;
        const H = frame.H;
        p.z = sampleDepth(cfg.depthBands);
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = frame.isInit ? Math.random() : 0;
        p.x = Math.random() * W;
        p.y = Math.random() * H;
        p.size = Math.random() * cfg.size + 1;
        p.vx = (Math.random() - 0.5) * cfg.speed * 2;
        p.vy = (Math.random() - 0.5) * cfg.speed * 2;
        p.decay = cfg.decay;
        p.maxAlpha = cfg.alpha;
        p.anchorX = 0;
        p.anchorY = 0;
        p.pulseOffset = 0;
        p.terminal = 0;
        p.driftPhase = 0;
        p.driftSpeed = 0;
        p.driftAmp = 0;
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const alphaCurve = cfg.alphaCurve;
        const sizeCurve = cfg.sizeCurve;
        const ds = frame.ds;
        const respawn = frame.respawn;
        const W = frame.W;
        const H = frame.H;
        // Math.trunc avoids the 32-bit signed cast that `timestamp >> 7`
        // does; safe over long sessions (`performance.now()` past ~24 days).
        const phase = Math.trunc(frame.timestamp / 128);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx * ds;
            p.y += p.vy * ds;
            p.life += p.decay * ds;
            if (p.life >= 1 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
                respawn(p, false);
                continue;
            }
            const flickerBit = (phase + p.id) & 1;
            let alpha = flickerBit ? p.maxAlpha : p.maxAlpha * 0.3;
            if (alphaCurve !== undefined) alpha *= sampleCurve(alphaCurve, p.life);
            if (alpha > ALPHA_EPSILON) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const drawSize = sizeCurve !== undefined ? p.size * sampleCurve(sizeCurve, p.life) : p.size;
                if (drawSize >= 1) {
                    const half = drawSize * 0.5;
                    ctx.drawImage(
                        p.spriteCanvas,
                        (p.x - half) | 0,
                        (p.y - half) | 0,
                        drawSize | 0,
                        drawSize | 0,
                    );
                }
            }
        }
    },
};

// ============================================================
//  AMBIENT FX RENDERER
// ============================================================

/**
 * @typedef {Object} AmbientOptions
 * @property {string} [theme='Fire']    Preset name from THEMES.
 * @property {Object} [overrides]       Partial config to merge over the theme.
 * @property {boolean} [autoStart=true] Start the RAF loop immediately.
 */


// ---- Built-in: FALL (v1.2.0) --------------------------------
// The gap in the original four: EMBER rises, FLOAT rises with sway, MIST drifts
// laterally, CHAOS goes everywhere. Nothing fell.
//
// Physics ported *conceptually* from @zakkster/lite-snow and @zakkster/lite-rain
// -- per-particle terminal velocity scaled by depth, and sway as a phase/speed/
// amplitude triple. Not ported literally: those engines are SoA, seconds-based,
// path-batched, and depend on @zakkster/lite-color. This one is AoS, per-frame,
// sprite-cached, and keeps the zero-dependency badge intact.
BEHAVIORS.FALL = {
    spriteLogical: SPRITE_LOGICAL_CORE,

    spawn(p, frame) {
        const cfg = frame.cfg;
        const W = frame.W;
        const H = frame.H;
        p.z = sampleDepth(cfg.depthBands);
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = frame.isInit ? Math.random() : 0;

        // Wind shears the column sideways. Widen the spawn band upwind so the
        // leading edge doesn't starve -- otherwise a strong wind.x leaves a
        // visibly empty wedge. Same correction lite-snow applies.
        const drift = Math.abs(cfg.wind.x) * FALL_SPAWN_DRIFT;
        p.x = Math.random() * (W + drift * 2) - drift;
        p.y = frame.isInit
            ? Math.random() * H
            : -RESPAWN_MARGIN_Y - Math.random() * RESPAWN_MARGIN_Y;

        p.size = (cfg.size + (Math.random() - 0.5) * cfg.size * FALL_SIZE_JITTER) * p.z;
        p.vx = 0;
        p.vy = 0;                            // starts at rest, accelerates to terminal
        p.terminal = cfg.speed * p.z;        // depth-scaled: near flakes fall faster
        p.decay = cfg.decay;
        p.maxAlpha = cfg.alpha * p.z;

        // Sway: phase advances per frame, so it needs no wall-clock reference and
        // cannot drift out of integer range the way `timestamp * k` eventually would.
        p.driftPhase = (Math.random() * 360) | 0;
        p.driftSpeed = FALL_DRIFT_SPEED_MIN + Math.random() * FALL_DRIFT_SPEED_VAR;
        p.driftAmp = cfg.turbulence * p.z;

        p.anchorX = 0;
        p.anchorY = 0;
        p.pulseOffset = 0;
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const alphaCurve = cfg.alphaCurve;
        const sizeCurve = cfg.sizeCurve;
        const wind = cfg.wind;
        const ds = frame.ds;
        const W = frame.W;
        const H = frame.H;
        const respawn = frame.respawn;
        // `stretch` elongates the sprite along the fall vector -- a round blob
        // becomes a streak. That is the whole difference between Snow and Rain.
        const stretch = cfg.stretch === undefined ? 0 : cfg.stretch;
        const cullBottom = H + RESPAWN_MARGIN_Y;
        const cullRight = W + FALL_CULL_X;
        // Hoisted: the fade-in window costs nothing per particle. Capped at the
        // original 0.1 so nothing fades in slower than it used to. decay 0
        // yields a span of 0, i.e. full alpha immediately.
        const fadeSpanRaw = FALL_FADE_IN_FRAMES * cfg.decay;
        const fadeSpan = fadeSpanRaw > 0.1 ? 0.1 : fadeSpanRaw;
        const fadeInv = fadeSpan > 0 ? 1 / fadeSpan : 0;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            p.vy += FALL_GRAVITY * ds;
            if (p.vy > p.terminal) p.vy = p.terminal;

            p.driftPhase += p.driftSpeed * ds;
            const sway = sinLut(p.driftPhase) * p.driftAmp;

            p.x += (wind.x + sway) * p.z * ds;
            p.y += (p.vy + wind.y * p.z) * ds;
            p.life += p.decay * ds;

            if (p.y > cullBottom || p.x < -FALL_CULL_X || p.x > cullRight || p.life >= 1) {
                respawn(p, false);
                continue;
            }

            let alpha = p.life < fadeSpan
                ? p.life * fadeInv * p.maxAlpha
                : p.maxAlpha;
            if (alphaCurve !== undefined) alpha *= sampleCurve(alphaCurve, p.life);

            if (alpha > ALPHA_EPSILON) {
                ctx.globalAlpha = alpha > 1 ? 1 : alpha;
                const w = sizeCurve !== undefined ? p.size * sampleCurve(sizeCurve, p.life) : p.size;
                if (w >= 1) {
                    const h = stretch === 0 ? w : w + p.vy * stretch;
                    ctx.drawImage(
                        p.spriteCanvas,
                        (p.x - w * 0.5) | 0,
                        (p.y - h * 0.5) | 0,
                        w | 0,
                        h | 0,
                    );
                }
            }
        }
    },
};

/**
 * Create a fullscreen ambient particle atmosphere on the given canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {AmbientOptions} [options]
 */
export function createAmbientFX(canvas, options) {
    if (!canvas || typeof canvas.getContext !== 'function') {
        throw new TypeError('AmbientFX: first argument must be an HTMLCanvasElement');
    }
    const opts = options || {};
    const themeName = opts.theme || 'Fire';
    const themeBase = resolveTheme(themeName);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('AmbientFX: 2d context unavailable on this canvas');

    // --- prefers-reduced-motion (v1.1.0) -------------------------------------
    // On by default, zero developer effort. Opt out with `reducedMotion: false`.
    // `baseCfg` is the source of truth (what the dev asked for); `cfg` is what we
    // actually render (baseCfg, degraded when the media query matches). Keeping
    // both means we can restore full motion if the user flips the OS setting mid-
    // session, instead of being stuck degraded until reload.
    const respectReduced = opts.reducedMotion !== false;
    const reduceMedia = (respectReduced && typeof window !== 'undefined' && typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    let isReduced = !!(reduceMedia && reduceMedia.matches);

    // --- pointer reactivity (v1.2.0) ----------------------------------------
    let pointerSpec = resolvePointer(opts.pointer);
    let pointerMode = pointerSpec.mode === 'repel' ? POINTER_REPEL
        : pointerSpec.mode === 'attract' ? POINTER_ATTRACT
        : POINTER_OFF;
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    let pointerBound = false;
    // Canvas origin, cached at resize. Reading getBoundingClientRect() inside the
    // pointermove handler would force a layout on every mouse move.
    let rectLeft = 0;
    let rectTop = 0;

    let baseCfg = validateConfig(mergeThemeConfig(themeBase, opts.overrides));
    let cfg = isReduced ? degradeForReducedMotion(baseCfg) : baseCfg;
    let currentThemeName = themeName;

    // Palette this instance currently claims in the shared sprite cache.
    let ownedColors = null;

    /**
     * Claim the current palette and drop the previous one. Retain runs first
     * so a color carried across the change never transiently hits zero and
     * gets evicted out from under our own live particles.
     */
    function retainPalette() {
        const next = uniqueColors(cfg);
        _retainColors(next);
        if (ownedColors !== null) _releaseColors(ownedColors);
        ownedColors = next;
    }

    /** Re-derive `cfg` from `baseCfg` + the current reduced-motion state. */
    function applyCfg(nextBase, refreshSprites) {
        baseCfg = nextBase;
        cfg = isReduced ? degradeForReducedMotion(baseCfg) : baseCfg;
        retainPalette();
        if (refreshSprites) primeSprites();
        // Respawns every particle, so each picks up a sprite from the live
        // cache rather than keeping a reference we may have just released.
        initParticles();
        if (budget !== null) budget.setBaseCount(cfg.count);
    }

    /** Grow or shrink the pool to `next` in place. Called by the frame budget. */
    function adjustCount(next) {
        if (next === particles.length) return;
        if (next > particles.length) {
            const behavior = resolveBehavior(cfg.behavior);
            frame.cfg = cfg;
            frame.W = W;
            frame.H = H;
            frame.isInit = false;
            while (particles.length < next) {
                // `id` feeds CHAOS's `(phase + p.id) & 1` flicker; an
                // undefined id makes that NaN & 1 === 0, so budget-restored
                // particles never flicker bright. It also breaks the Smi field
                // representation the pool depends on being monomorphic.
                const p = makeParticle(particles.length);
                particles.push(p);
                behavior.spawn(p, frame);
            }
        } else {
            particles.length = next;
        }
    }

    // Monomorphic particle pool.
    /** @type {Array<Object>} */
    const particles = [];

    // Viewport state (logical CSS pixels).
    let W = 0;
    let H = 0;
    let dpr = 1;

    // Loop state.
    let lastTime = -1;
    let raf = null;
    let running = false;
    let destroyed = false;

    // Frame-budget auto-degrader (v1.4.0). Null when not configured.
    let budget = _resolveFrameBudget(opts && opts.frameBudget);

    // Pooled frame context. Allocated once, mutated per frame/spawn.
    // Behaviors receive this and MUST NOT retain references.
    const frame = {
        cfg,
        W: 0,
        H: 0,
        dt: 0,
        ds: 0,
        timestamp: 0,
        isInit: false,
        getSprite(color, logicalSize) {
            return getSprite(color, logicalSize, dpr);
        },
        respawn(p, isInit) {
            resetParticle(p, isInit);
        },
    };

    function resize() {
        const prevW = W;
        const prevH = H;
        W = canvas.clientWidth || canvas.width || 1;
        H = canvas.clientHeight || canvas.height || 1;
        if (typeof canvas.getBoundingClientRect === 'function') {
            const rect = canvas.getBoundingClientRect();
            rectLeft = rect.left;
            rectTop = rect.top;
        }

        const newDpr = window.devicePixelRatio || 1;
        canvas.width = (W * newDpr) | 0;
        canvas.height = (H * newDpr) | 0;
        ctx.setTransform(newDpr, 0, 0, newDpr, 0, 0);

        // Preserve particle positions across resize: rescale proportionally.
        if (prevW > 0 && prevH > 0 && (prevW !== W || prevH !== H)) {
            const sx = W / prevW;
            const sy = H / prevH;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x *= sx;
                p.y *= sy;
                p.anchorX *= sx;
                p.anchorY *= sy;
            }
        }

        // If DPR actually changed, sprites at the old physical size are
        // stale. Re-prime at the new size; the old bucket is dropped on
        // next color/theme change.
        const dprChanged = newDpr !== dpr;
        dpr = newDpr;
        if (dprChanged) primeSprites();
    }

    function primeSprites() {
        const behavior = resolveBehavior(cfg.behavior);
        const palette = uniqueColors(cfg);
        for (let i = 0; i < palette.length; i++) {
            getSprite(palette[i], behavior.spriteLogical, dpr);
        }
    }

    function uniqueColors(c) {
        const seen = new Set();
        const out = [];
        for (let i = 0; i < c.colors.length; i++) {
            const col = c.colors[i];
            if (!seen.has(col)) { seen.add(col); out.push(col); }
        }
        if (!seen.has(c.spark)) out.push(c.spark);
        return out;
    }

    function resetParticle(p, isInit) {
        const behavior = resolveBehavior(cfg.behavior);
        frame.cfg = cfg;
        frame.W = W;
        frame.H = H;
        frame.isInit = isInit;
        behavior.spawn(p, frame);
    }

    function initParticles() {
        const n = cfg.count | 0;
        // Grow the pool: every push uses makeParticle to pin the hidden
        // class before any spawn writes to it.
        while (particles.length < n) particles.push(makeParticle(particles.length));
        if (particles.length > n) particles.length = n;
        for (let i = 0; i < n; i++) {
            particles[i].id = i;
            resetParticle(particles[i], true);
        }
    }

    /**
     * Displace particles near the pointer, once per frame, BEFORE the behavior
     * ticks. Doing it as a separate pass rather than inside each tick loop means
     * every behavior gets pointer reactivity for free -- including third-party
     * ones registered via registerBehavior, which never learn this exists.
     *
     * Zero allocation. Costs one branch per frame when the pointer is off.
     */
    function applyPointer(ds) {
        if (pointerMode === POINTER_OFF || !pointerActive) return;
        // WCAG 2.3.3 is literally "Animation from Interactions". A user who asked
        // for reduced motion did not ask for particles to chase their cursor.
        if (isReduced) return;

        const px = pointerX;
        const py = pointerY;
        const radius = pointerSpec.radius;
        const r2 = radius * radius;
        const invRadius = 1 / radius;
        const k = pointerSpec.strength * pointerMode * ds;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const dx = p.x - px;
            const dy = p.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r2 || d2 < 1) continue;   // outside the radius, or dead centre
            const d = Math.sqrt(d2);
            // Depth-correlated: near particles react hard, far ones barely move.
            // This is what makes the parallax bands read as actual depth.
            const f = (k * FALLOFF[(d * invRadius * FALLOFF_MASK) & FALLOFF_MASK] * p.z) / d;
            p.x += dx * f;
            p.y += dy * f;
        }
    }

    function onPointerMove(e) {
        const px = e.clientX - rectLeft;
        const py = e.clientY - rectTop;
        // A synthetic `new Event('pointermove')` carries no clientX, and
        // `undefined - 0` is NaN. Letting that reach applyPointer poisons the
        // field permanently: `d2 = NaN` fails both the `>= r2` and the `< 1`
        // guard, so every particle integrates NaN, and once a position is NaN
        // no cull test can ever be true again. The whole field collapses onto
        // the origin for the life of the instance. Two compares per event.
        if (px !== px || py !== py) return;
        pointerX = px;
        pointerY = py;
        pointerActive = true;
    }

    function onPointerEnd(e) {
        // A mouse keeps hovering after mouseup; a finger does not.
        if (e.pointerType === 'mouse') return;
        pointerActive = false;
    }

    function onPointerOut() {
        pointerActive = false;
    }

    // Listeners go on window, not the canvas: an ambient backdrop is usually
    // behind the UI (or pointer-events: none), so canvas-local events never fire.
    function bindPointer() {
        if (pointerBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerdown', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerEnd, { passive: true });
        window.addEventListener('pointercancel', onPointerOut, { passive: true });
        document.addEventListener('pointerleave', onPointerOut, { passive: true });
        pointerBound = true;
    }

    function unbindPointer() {
        if (!pointerBound) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerMove);
        window.removeEventListener('pointerup', onPointerEnd);
        window.removeEventListener('pointercancel', onPointerOut);
        document.removeEventListener('pointerleave', onPointerOut);
        pointerBound = false;
        pointerActive = false;
    }

    function loop(timestamp) {
        if (destroyed || !running) return;
        raf = requestAnimationFrame(loop);

        if (lastTime < 0) { lastTime = timestamp; return; }
        const dt = Math.min(timestamp - lastTime, DT_CLAMP_MS);
        lastTime = timestamp;
        if (dt < 1) return;

        if (budget !== null) {
            const nextCount = budget.note(dt, particles.length);
            if (nextCount >= 0) adjustCount(nextCount);
        }

        const behavior = resolveBehavior(cfg.behavior);
        ctx.globalCompositeOperation = cfg.blendMode || 'source-over';

        // Populate the pooled frame context. No allocation.
        frame.cfg = cfg;
        frame.W = W;
        frame.H = H;
        frame.dt = dt;
        frame.ds = dt / DT_REF_MS;
        frame.timestamp = timestamp;
        frame.isInit = false;

        applyPointer(frame.ds);

        ctx.clearRect(0, 0, W, H);
        behavior.tick(particles, ctx, frame);
        ctx.globalAlpha = 1;
    }

    function onVisibility() {
        if (!document.hidden) {
            lastTime = -1;
            if (budget !== null) budget.reset();
        }
    }
    document.addEventListener('visibilitychange', onVisibility);

    // Live reduced-motion tracking. Without this the preference is a snapshot
    // taken at construction; a user toggling it in OS settings would see no
    // change until reload. Torn down in destroy().
    function onReduceChange(e) {
        if (destroyed) return;
        const next = !!e.matches;
        if (next === isReduced) return;
        isReduced = next;
        applyCfg(baseCfg, false);
    }
    if (reduceMedia) {
        if (typeof reduceMedia.addEventListener === 'function') {
            reduceMedia.addEventListener('change', onReduceChange);
        } else if (typeof reduceMedia.addListener === 'function') {
            reduceMedia.addListener(onReduceChange); // Safari < 14
        }
    }

    let ro = null;
    let resizeScheduled = false;
    // Tracked so destroy() can cancel it. A hidden tab never fires rAF, so an
    // uncancelled debounce pins this closure -- and through it the instance
    // and its canvas -- for as long as the tab stays backgrounded.
    let resizeRaf = null;
    if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
            if (resizeScheduled || destroyed) return;
            resizeScheduled = true;
            resizeRaf = requestAnimationFrame(() => {
                resizeRaf = null;
                resizeScheduled = false;
                if (!destroyed) resize();
            });
        });
        ro.observe(canvas.parentElement || canvas);
    }

    // Boot.
    retainPalette();
    resize();
    primeSprites();
    initParticles();
    if (budget !== null) budget.setBaseCount(cfg.count);
    if (pointerMode !== POINTER_OFF) bindPointer();
    if (opts.autoStart !== false) {
        running = true;
        raf = requestAnimationFrame(loop);
    }

    return {
        setTheme(name) {
            if (destroyed) return;
            const base = resolveTheme(name);
            currentThemeName = name;
            applyCfg(validateConfig(mergeThemeConfig(base, null)), true);
        },

        updateConfig(overrides) {
            if (destroyed || !overrides) return;
            const prevBehavior = baseCfg.behavior;
            const next = validateConfig(mergeThemeConfig(baseCfg, overrides));
            const behaviorChanged = next.behavior !== prevBehavior;
            const spritesDirty = overrides.colors !== undefined
                || overrides.spark !== undefined
                || behaviorChanged;
            applyCfg(next, spritesDirty);
        },

        /** The config actually being rendered (degraded when reduced-motion is active). */
        get config() {
            return { ...cfg, wind: { ...cfg.wind } };
        },

        /** The config as requested, before any reduced-motion degrade. */
        get baseConfig() {
            return { ...baseCfg, wind: { ...baseCfg.wind } };
        },

        /** True when prefers-reduced-motion is matching and not opted out. */
        get reducedMotion() { return isReduced; },

        /** Current pointer spec: { mode, radius, strength }. Defensive copy. */
        get pointer() {
            return { mode: pointerSpec.mode, radius: pointerSpec.radius, strength: pointerSpec.strength };
        },

        /**
         * Change pointer reactivity live. Partial: omitted keys keep their value.
         * Setting mode to 'off' detaches the listeners entirely.
         */
        setPointer(next) {
            if (destroyed) return;
            pointerSpec = resolvePointer({
                mode: next && next.mode !== undefined ? next.mode : pointerSpec.mode,
                radius: next && next.radius !== undefined ? next.radius : pointerSpec.radius,
                strength: next && next.strength !== undefined ? next.strength : pointerSpec.strength,
            });
            pointerMode = pointerSpec.mode === 'repel' ? POINTER_REPEL
                : pointerSpec.mode === 'attract' ? POINTER_ATTRACT
                : POINTER_OFF;
            if (pointerMode === POINTER_OFF) unbindPointer();
            else bindPointer();
        },

        get theme() { return currentThemeName; },

        get count() { return particles.length; },

        get running() { return running; },

        pause() {
            if (!running || destroyed) return;
            running = false;
            if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        },

        /** The active frame-budget, or null when disabled. */
        get frameBudget() { return budget; },

        /**
         * Swap the frame-budget policy live. Pass `null`/`false` to disable,
         * `true` to enable with defaults, or a fresh FrameBudgetOptions object.
         */
        setFrameBudget(spec) {
            if (destroyed) return;
            budget = _resolveFrameBudget(spec);
            if (budget !== null) budget.setBaseCount(cfg.count);
        },

        resume() {
            if (running || destroyed) return;
            running = true;
            lastTime = -1;
            if (budget !== null) budget.reset();
            raf = requestAnimationFrame(loop);
        },

        destroy() {
            if (destroyed) return;
            destroyed = true;
            running = false;
            if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
            document.removeEventListener('visibilitychange', onVisibility);
            unbindPointer();
            if (reduceMedia) {
                if (typeof reduceMedia.removeEventListener === 'function') {
                    reduceMedia.removeEventListener('change', onReduceChange);
                } else if (typeof reduceMedia.removeListener === 'function') {
                    reduceMedia.removeListener(onReduceChange);
                }
            }
            if (ro !== null) { ro.disconnect(); ro = null; }
            if (resizeRaf !== null) { cancelAnimationFrame(resizeRaf); resizeRaf = null; }
            if (ownedColors !== null) { _releaseColors(ownedColors); ownedColors = null; }
            particles.length = 0;
        },
    };
}

export default createAmbientFX;
