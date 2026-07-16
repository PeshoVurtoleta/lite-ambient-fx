/**
 * @zakkster/lite-ambient-fx
 *
 * Full-screen ambient particle atmospheres in one file. Nine themed presets
 * (Fire, Night, Ice, Frost, Toxic, Void, Dust, Aurora, Abyss) across four
 * particle behaviors (EMBER, MIST, FLOAT, CHAOS), plus registry hooks for
 * custom themes (`registerTheme`) and behaviors (`registerBehavior`).
 * Sprite-cached radial gradients, zero-alloc render loop, monomorphic
 * particle shape, DPR-aware rasterization, delta-time scaled,
 * resize-preserving, visibility-paused, and `prefers-reduced-motion`
 * auto-degrade. Zero runtime dependencies. One file.
 *
 * (c) 2026 Zahary Shinikchiev. MIT.
 */

export const VERSION = '1.1.0';

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
];

// ============================================================
//  SHARED CONSTANTS
// ============================================================

const TAU = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

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

// How far past the top edge an EMBER/FLOAT particle can go before we
// consider it dead and respawn from the bottom.
const RESPAWN_MARGIN_Y = 50;

// Alpha-envelope constants, pre-computed reciprocals so hot loops multiply
// instead of divide. EMBER fade-in is at 0..0.2 (life * 5 = alpha frac);
// EMBER fade-out from 0.2..1 simplifies to 1.25 * (1 - life). FLOAT fade
// windows are 0..0.1 and 0.9..1 (life * 10 either direction).
const EMBER_FADE_IN_INV = 5;      // 1 / 0.2
const EMBER_FADE_OUT_INV = 1.25;  // 1 / 0.8
const FLOAT_FADE_INV = 10;        // 1 / 0.1

// ============================================================
//  DPR-AWARE SPRITE CACHE (nested Map, zero string allocation)
// ============================================================

// Two-level index: Map<color, Map<physicalSize, HTMLCanvasElement>>. Avoids
// the `${color}:${physical}` string concatenation that would otherwise burn
// one string allocation per lookup.
const _sprites = new Map();

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
    if (!colors) {
        for (const byPhysical of _sprites.values()) {
            for (const c of byPhysical.values()) {
                c.width = 0;
                c.height = 0;
            }
        }
        _sprites.clear();
        return;
    }
    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        const byPhysical = _sprites.get(color);
        if (byPhysical === undefined) continue;
        for (const c of byPhysical.values()) {
            c.width = 0;
            c.height = 0;
        }
        _sprites.delete(color);
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
    return cfg;
}

/** Fields the behavior tick loops read raw. All must be finite and >= 0. */
const NUMERIC_FIELDS = ['decay', 'speed', 'size', 'turbulence'];

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
    EMBER: 'sparks', MIST: 'fog', FLOAT: 'wind', CHAOS: 'orb',
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
    };
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
        p.z = Math.random() * 0.8 + 0.2;
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = 0;
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
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const wind = cfg.wind;
        const turbFactor = cfg.turbulence;
        const ds = frame.ds;
        const respawn = frame.respawn;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const turbIdx = (p.y * 0.5) | 0;
            const turb = sinLut(turbIdx) * turbFactor;
            const moveX = (p.vx + wind.x + turb) * p.z * ds;
            const moveY = (p.vy + wind.y) * p.z * ds;
            p.y -= moveY;
            p.x += moveX;
            p.life += p.decay * ds;
            let alpha;
            if (p.life < 0.2) alpha = p.life * EMBER_FADE_IN_INV * p.maxAlpha;
            else alpha = EMBER_FADE_OUT_INV * (1 - p.life) * p.maxAlpha;
            if (p.y < -RESPAWN_MARGIN_Y || alpha <= 0) { respawn(p, false); continue; }
            if (alpha > ALPHA_EPSILON) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const half = p.size * 0.5;
                ctx.drawImage(
                    p.spriteCanvas,
                    (p.x - half) | 0,
                    (p.y - half) | 0,
                    p.size | 0,
                    p.size | 0,
                );
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
        p.z = Math.random() * 0.8 + 0.2;
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_MIST);
        p.life = 0;
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
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
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
            const alpha = 0.05 + breath * p.maxAlpha;
            const drawSize = p.size * (0.9 + breath * 0.2);
            if (alpha > ALPHA_EPSILON) {
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
        p.z = Math.random() * 0.8 + 0.2;
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = 0;
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
    },

    tick(particles, ctx, frame) {
        const cfg = frame.cfg;
        const wind = cfg.wind;
        const ds = frame.ds;
        const respawn = frame.respawn;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const moveY = (p.vy + wind.y) * p.z * ds;
            p.y -= moveY;
            p.x += Math.sin(p.y * 0.05) * 0.5;
            p.life += p.decay * ds;
            if (p.y < -RESPAWN_MARGIN_Y || p.life >= 1) { respawn(p, false); continue; }
            let alpha;
            if (p.life < 0.1) alpha = p.life * FLOAT_FADE_INV * p.maxAlpha;
            else if (p.life > 0.9) alpha = (1 - p.life) * FLOAT_FADE_INV * p.maxAlpha;
            else alpha = p.maxAlpha;
            if (alpha > ALPHA_EPSILON) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const half = p.size * 0.5;
                ctx.drawImage(
                    p.spriteCanvas,
                    (p.x - half) | 0,
                    (p.y - half) | 0,
                    p.size | 0,
                    p.size | 0,
                );
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
        p.z = Math.random() * 0.8 + 0.2;
        p.color = Math.random() > 0.9 ? cfg.spark : cfg.colors[(Math.random() * cfg.colors.length) | 0];
        p.spriteCanvas = frame.getSprite(p.color, SPRITE_LOGICAL_CORE);
        p.life = 0;
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
    },

    tick(particles, ctx, frame) {
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
            const alpha = flickerBit ? p.maxAlpha : p.maxAlpha * 0.3;
            if (alpha > ALPHA_EPSILON) {
                const a = alpha > 1 ? 1 : alpha;
                ctx.globalAlpha = a;
                const half = p.size * 0.5;
                ctx.drawImage(
                    p.spriteCanvas,
                    (p.x - half) | 0,
                    (p.y - half) | 0,
                    p.size | 0,
                    p.size | 0,
                );
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

    let baseCfg = validateConfig(mergeThemeConfig(themeBase, opts.overrides));
    let cfg = isReduced ? degradeForReducedMotion(baseCfg) : baseCfg;
    let currentThemeName = themeName;

    /** Re-derive `cfg` from `baseCfg` + the current reduced-motion state. */
    function applyCfg(nextBase, refreshSprites) {
        const prevColors = uniqueColors(cfg);
        baseCfg = nextBase;
        cfg = isReduced ? degradeForReducedMotion(baseCfg) : baseCfg;
        if (refreshSprites) {
            clearAmbientSpriteCache(prevColors);
            primeSprites();
        }
        initParticles();
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

    function loop(timestamp) {
        if (destroyed || !running) return;
        raf = requestAnimationFrame(loop);

        if (lastTime < 0) { lastTime = timestamp; return; }
        const dt = Math.min(timestamp - lastTime, DT_CLAMP_MS);
        lastTime = timestamp;
        if (dt < 1) return;

        const behavior = resolveBehavior(cfg.behavior);

        // Populate the pooled frame context. No allocation.
        frame.cfg = cfg;
        frame.W = W;
        frame.H = H;
        frame.dt = dt;
        frame.ds = dt / DT_REF_MS;
        frame.timestamp = timestamp;
        frame.isInit = false;

        ctx.clearRect(0, 0, W, H);
        behavior.tick(particles, ctx, frame);
        ctx.globalAlpha = 1;
    }

    function onVisibility() {
        if (!document.hidden) lastTime = -1;
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
    if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
            if (resizeScheduled || destroyed) return;
            resizeScheduled = true;
            requestAnimationFrame(() => {
                resizeScheduled = false;
                if (!destroyed) resize();
            });
        });
        ro.observe(canvas.parentElement || canvas);
    }

    // Boot.
    resize();
    primeSprites();
    initParticles();
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

        get theme() { return currentThemeName; },

        get count() { return particles.length; },

        get running() { return running; },

        pause() {
            if (!running || destroyed) return;
            running = false;
            if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        },

        resume() {
            if (running || destroyed) return;
            running = true;
            lastTime = -1;
            raf = requestAnimationFrame(loop);
        },

        destroy() {
            if (destroyed) return;
            destroyed = true;
            running = false;
            if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
            document.removeEventListener('visibilitychange', onVisibility);
            if (reduceMedia) {
                if (typeof reduceMedia.removeEventListener === 'function') {
                    reduceMedia.removeEventListener('change', onReduceChange);
                } else if (typeof reduceMedia.removeListener === 'function') {
                    reduceMedia.removeListener(onReduceChange);
                }
            }
            if (ro !== null) { ro.disconnect(); ro = null; }
            const palette = uniqueColors(cfg);
            clearAmbientSpriteCache(palette);
            particles.length = 0;
        },
    };
}

export default createAmbientFX;
