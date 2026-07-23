/**
 * @zakkster/lite-ambient-fx -- TypeScript declarations.
 * (c) 2026 Zahary Shinikchiev. MIT.
 */

export type BuiltInBehavior = 'EMBER' | 'MIST' | 'FLOAT' | 'CHAOS' | 'FALL';

/**
 * Any registered behavior name -- widen to `string` because users can
 * install their own via `registerBehavior`.
 */
export type BehaviorName = BuiltInBehavior | (string & {});

export type BuiltInTheme =
    | 'Fire' | 'Night' | 'Ice' | 'Frost' | 'Toxic' | 'Void'
    | 'Dust' | 'Aurora' | 'Abyss'
    | 'Snow' | 'Rain'
    | 'Sakura' | 'Fireflies' | 'Meteor' | 'Cosmic' | 'Sandstorm' | 'Bioluminescence'
    | 'MoltenGold' | 'ShadowWisp' | 'Stardust' | 'NeonGlitch' | 'SolarFlare' | 'ToxicBubble';

/** Discrete parallax layers. 0 (or absent) keeps the original continuous z ramp. */
export type DepthBands = 0 | 2 | 3;

export type PointerMode = 'off' | 'repel' | 'attract';

export interface PointerSpec {
    /** Push particles away, pull them in, or do nothing. Default 'off'. */
    mode?: PointerMode;
    /** Radius of influence in CSS pixels. Default 140. */
    radius?: number;
    /** Peak displacement per 60fps frame at the pointer. Default 8. */
    strength?: number;
}

export interface ResolvedPointer {
    mode: PointerMode;
    radius: number;
    strength: number;
}

/** Any registered theme name -- widened because users add their own via `registerTheme`. */
export type ThemeName = BuiltInTheme | (string & {});

export interface WindVector {
    x: number;
    y: number;
}


/**
 * Canvas 2D blend modes accepted on {@link AmbientConfig.blendMode} (v1.5.0).
 * The tick loop sets `ctx.globalCompositeOperation` before drawing each frame.
 */
export type BlendMode =
    | 'source-over' | 'lighter' | 'screen' | 'multiply' | 'overlay'
    | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light'
    | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation'
    | 'color' | 'luminosity';


/**
 * A visual curve across a particle's lifetime (v1.6.0). An array of at least
 * two evenly-spaced control points, evaluated at `t = life`.
 *
 * `[start, end]`          - linear from `start` at t=0 to `end` at t=1.
 * `[start, mid, end]`     - piecewise linear via `mid` at t=0.5.
 * `[k0, k1, ... kN]`      - piecewise linear across N segments.
 *
 * See {@link sampleCurve} for the sampler.
 */
export type Curve = readonly number[];

export interface AmbientConfig {
    behavior: BehaviorName;
    /** Base palette. Particles pick uniformly at random from these. */
    colors: string[];
    /** Rarer highlight color (~10% chance per spawn). */
    spark: string;
    /** Live particle count. */
    count: number;
    /** Constant advection vector applied per frame. */
    wind: WindVector;
    /** Per-frame life increment. Smaller = longer-lived. */
    decay: number;
    /** Base velocity magnitude. */
    speed: number;
    /**
     * Sprite draw size in CSS pixels. Interpretation is behavior-specific:
     * EMBER/FLOAT/CHAOS are small (2..30), MIST is large (50..500).
     */
    size: number;
    /** Alpha cap; multiplied by z for depth. Clamped to [0, 1]. */
    alpha: number;
    /** Amplitude of the sin-LUT lateral turbulence. For FALL, the sway amplitude. */
    turbulence: number;
    /**
     * Quantize depth into 2 or 3 discrete parallax layers at spawn (v1.2.0).
     * Omit or set 0 for the original continuous ramp. Because every behavior
     * already scales size, alpha and movement by z, banding it *is* the parallax:
     * no extra draw pass, no extra per-frame work.
     */
    depthBands?: DepthBands;
    /**
     * FALL only (v1.2.0). Elongates the sprite along the fall vector, turning a
     * round blob into a streak. 0 / absent = round (Snow); ~2.2 = rain.
     */
    stretch?: number;
    /**
     * Canvas 2D blend mode (v1.5.0). Optional; defaults to `'source-over'`.
     * Use `'screen'` or `'lighter'` for glowing atmospheres (Stardust,
     * SolarFlare, NeonGlitch, MoltenGold, ToxicBubble ship with these).
     */
    blendMode?: BlendMode;

    /**
     * Optional life-based alpha multiplier (v1.6.0). Applied AFTER the
     * behavior's built-in alpha envelope (EMBER/FLOAT/FALL fade curves,
     * MIST breathing, CHAOS flicker). Set to e.g. `[0, 1, 0]` for a
     * gentle fade-in/fade-out on top of the behavior default.
     */
    alphaCurve?: Curve;

    /**
     * Optional life-based size multiplier (v1.6.0). Applied to `p.size` at
     * draw time. Set to e.g. `[1, 2.5]` for particles that grow across
     * their lifetime, or `[0.5, 0]` for shrinking sparkles.
     */
    sizeCurve?: Curve;

}

export interface AmbientOptions {
    /**
     * Frame-budget auto-degradation (v1.4.0).
     * - `undefined` / `false` / `null` -> off (default, no behavior change).
     * - `true`                          -> on with default thresholds.
     * - `FrameBudgetOptions`            -> on with custom thresholds and callback.
     *
     * When on, the tick loop tracks a rolling window of frame times and steps
     * `count` down when p90 exceeds `targetMs` -- restoring toward the base
     * when headroom returns. `baseConfig` is untouched; `config.count` reflects
     * what is actually rendering. Compatible with reduced-motion (both degrades
     * stack).
     */
    frameBudget?: boolean | FrameBudgetOptions | null;

    /** Preset name from THEMES. Defaults to 'Fire'. */
    theme?: ThemeName;
    /** Partial config to merge over the theme. `wind` merges shallowly. */
    overrides?: Partial<AmbientConfig>;
    /** Start the RAF loop immediately. Defaults to true. */
    autoStart?: boolean;
    /**
     * Respect `prefers-reduced-motion: reduce`. Defaults to `true` -- zero config.
     * When the media query matches, the instance renders a degraded config:
     * low particle count (8..40), ~0.35x speed, calmer turbulence. Palette and
     * behavior are preserved, so the atmosphere stays recognizable.
     *
     * Tracked live: flipping the OS setting mid-session degrades or restores
     * without a reload. Set `false` to force full motion regardless.
     *
     * Note: while active, the degrade is re-applied after every `setTheme()` and
     * `updateConfig()` -- a user's accessibility preference outranks a dev's
     * `count` knob. Use `reducedMotion: false` if you need to override it.
     */
    reducedMotion?: boolean;
    /**
     * Pointer reactivity (v1.2.0). Applied as a single pass over the pool before
     * the behavior ticks, so *every* behavior gets it -- including custom ones
     * installed via registerBehavior, which never learn it exists.
     *
     * Force falls off on a precomputed cosine curve and is scaled by particle
     * depth, so near particles react hard and far ones barely move.
     * Automatically disabled under prefers-reduced-motion (WCAG 2.3.3).
     */
    pointer?: PointerSpec;
}

export interface AmbientInstance {
    /** The active frame budget, or null when disabled. */
    readonly frameBudget: FrameBudget | null;

    /**
     * Replace the frame-budget policy live. `null`/`false` disables,
     * `true` re-enables with defaults, or pass a fresh options object.
     */
    setFrameBudget(spec: boolean | FrameBudgetOptions | null): void;


    setTheme(name: ThemeName): void;
    updateConfig(overrides: Partial<AmbientConfig>): void;
    /** The config actually being rendered (degraded when reduced-motion is active). */
    readonly config: AmbientConfig;
    /** The config as requested, before any reduced-motion degrade. */
    readonly baseConfig: AmbientConfig;
    /** True while `prefers-reduced-motion: reduce` matches and it is not opted out. */
    readonly reducedMotion: boolean;
    readonly theme: ThemeName;
    /** Current pointer spec. Defensive copy. */
    readonly pointer: ResolvedPointer;
    /** Change pointer reactivity live. Partial -- omitted keys keep their value. */
    setPointer(next: PointerSpec): void;
    readonly count: number;
    /** Monotonic total particles spawned since mount. Diff per frame for a profiler counter. */
    readonly spawned: number;
    readonly running: boolean;
    pause(): void;
    resume(): void;
    destroy(): void;
}

export interface ThemeMeta {
    id: ThemeName;
    name: string;
    icon: string;
    behavior: BuiltInBehavior;
}

/**
 * Pooled per-frame context passed to every behavior's spawn/tick call.
 * Do NOT retain references to this object or any of its slots past the
 * current call -- the instance mutates it in place.
 */
export interface FrameContext {
    /** Current merged config (read-only from behavior perspective). */
    cfg: AmbientConfig;
    /** Viewport width in CSS pixels. */
    W: number;
    /** Viewport height in CSS pixels. */
    H: number;
    /** Milliseconds since last frame, clamped to <=50. */
    dt: number;
    /** dt / 16 -- delta-scale to the 60fps velocity reference. */
    ds: number;
    /** RAF-callback timestamp for this frame. */
    timestamp: number;
    /** True during initial population, false during in-flight respawns. */
    isInit: boolean;
    /** Get or build a DPR-aware sprite for the given color + logical size. */
    getSprite(color: string, logicalSize: number): HTMLCanvasElement;
    /** Recycle a particle in place. Called from tick when a particle dies. */
    respawn(particle: Particle, isInit: boolean): void;
}

/**
 * Monomorphic particle shape. Every field is present on every particle
 * regardless of active behavior; MIST-specific slots stay zeroed for other
 * behaviors so V8's hidden class never transitions.
 */
export interface Particle {
    id: number;
    color: string;
    spriteCanvas: HTMLCanvasElement | null;
    z: number;
    life: number;
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    decay: number;
    maxAlpha: number;
    anchorX: number;
    anchorY: number;
    pulseOffset: number;
}

export interface BehaviorDefinition {
    /** CSS-pixel size at which sprites for this behavior are rasterized. */
    spriteLogical: number;
    /** Populate/reset a particle. MUST NOT add new fields to `p`. */
    spawn(p: Particle, frame: FrameContext): void;
    /** Advance and render every particle for one frame. */
    tick(particles: Particle[], ctx: CanvasRenderingContext2D, frame: FrameContext): void;
}

/** Package version string. */
export const VERSION: string;

/** Six shipped presets, keyed by theme name. */
export const THEMES: Record<BuiltInTheme, AmbientConfig> & Record<string, AmbientConfig>;

/** Human-readable metadata for UI builders. */
export const THEME_META: ThemeMeta[];

/**
 * The behavior registry. Four built-in entries at module load; users can
 * install their own via `registerBehavior`. Uses a null prototype so
 * property lookups don't fall through to `Object.prototype`.
 */
export const BEHAVIORS: Record<string, BehaviorDefinition>;

/** Register a custom behavior (or replace a built-in). Throws on invalid def. */
export function registerBehavior(name: string, def: BehaviorDefinition): void;

/** Optional display metadata for a registered theme. */
export interface ThemeMetaInput {
    /** Display name for pickers. Defaults to a de-camelCased `name`. */
    name?: string;
    /** Icon hint. Defaults to the behavior's icon ('sparks' | 'fog' | 'wind' | 'orb'). */
    icon?: string;
}

/**
 * Register a custom theme preset, or override a built-in. Instantly usable via
 * `createAmbientFX({ theme })` and `setTheme()`, and mirrored into `THEME_META`
 * so an existing theme picker keeps working unchanged.
 *
 * `config` must be a COMPLETE preset -- it is run through `validateConfig`, which
 * rejects a missing `wind`, `size`, `speed`, `decay`, or `turbulence` rather than
 * letting them reach the tick loop as `undefined`.
 *
 * @returns the validated, stored config.
 */
export function registerTheme(name: string, config: AmbientConfig, meta?: ThemeMetaInput): AmbientConfig;

/**
 * The pure reduced-motion transform: low count (8..40), 0.35x speed, 0.6x
 * turbulence, palette untouched. Exported for tests and for callers who want to
 * apply the same degrade to their own configs.
 */
export function degradeForReducedMotion(cfg: AmbientConfig): AmbientConfig;

/**
 * Sample a depth value for a spawning particle. `bands` of 2 or 3 quantizes z
 * into discrete parallax layers; anything else falls back to the original
 * uniform ramp, so pre-1.2 presets are pixel-identical.
 */
export function sampleDepth(bands?: DepthBands): number;

/** Normalize and validate a pointer spec, filling in defaults. Pure. */
export function resolvePointer(spec?: PointerSpec | null): ResolvedPointer;

/** Drop cached sprites by color, or the entire cache when `colors` is omitted. */
/**
 * Sprite-cache census. Cheap enough to poll every frame from a HUD or profiler
 * counter. `retained` is how many colors are still claimed by a live instance.
 */
export function ambientSpriteCacheStats(): { colors: number; sprites: number; retained: number };

export function clearAmbientSpriteCache(colors?: string[]): void;

/** Merge a theme with overrides. `wind` merges shallowly. */
export function mergeThemeConfig(base: AmbientConfig, overrides: Partial<AmbientConfig> | null | undefined): AmbientConfig;

/** Validate a config object. Throws on violation. Returns the input for chaining. */
export function validateConfig(cfg: AmbientConfig): AmbientConfig;

/** Delta-time scale factor: dtMs / 16. */
export function deltaScale(dtMs: number): number;

/** Signed-modulo sine LUT access. */
export function sinLut(index: number): number;

/**
 * Alpha envelope for `life` in [0, 1] under the given built-in mode.
 * Kept as a shared helper for tests and downstream reuse; the built-in
 * behaviors inline these curves inside their tick loops.
 */
export function envelopeAlpha(mode: BuiltInBehavior, life: number, maxAlpha: number): number;

/**
 * Create a fullscreen ambient particle atmosphere on the given canvas.
 * The canvas should be positioned as a fullscreen overlay via CSS.
 */
export function createAmbientFX(canvas: HTMLCanvasElement, options?: AmbientOptions): AmbientInstance;

export default createAmbientFX;


// -----------------------------------------------------------------------------
// v1.3.0 type additions -- append to AmbientFX.d.ts
// -----------------------------------------------------------------------------

/** An OKLCH triple as `[L, C, H]`. Emitted as `Float64Array` at runtime. */
export type OklchTriple = ArrayLike<number> & { readonly length: 3 };

/**
 * A single palette entry accepted by {@link colorsFromPalette}.
 * Every shape you'd get out of a hueforge scale, a token export, or a hand-
 * written OKLCH list is covered without an import from those packages.
 */
export type PaletteStop =
    | string                                          // '#rrggbb' | 'oklch(...)'
    | { l: number; c: number; h: number }             // hueforge ScaleStep
    | { L: number; C: number; H: number }             // uppercase alias
    | { offset: number; l: number; c: number; h: number }
    | { color: string }                               // token wrapper
    | [number, string | { l: number; c: number; h: number }];

export interface ColorsFromPaletteOptions {
    /** Evenly resample the stops to this length. Defaults to `stops.length`. */
    count?: number;
}

/**
 * Parse a color string into an OKLCH triple `[L, C, H]`.
 * Accepts `#rgb`, `#rrggbb`, or `oklch(L C H)` (with `%` on L, comma/slash
 * separators, alpha component ignored).
 *
 * Zero-alloc when `out` is supplied; otherwise allocates a `Float64Array(3)`.
 * Throws on malformed input.
 */
export function parseColor(input: string, out?: Float64Array): Float64Array;

/**
 * Alias for {@link parseColor} -- for call sites that only take hex.
 */
export const oklchFromHex: typeof parseColor;

/**
 * Format an OKLCH triple as `#rrggbb`, gamut-clamped in linear sRGB.
 * Single string allocation per call.
 */
export function formatColor(L: number, C: number, H: number): string;

/**
 * Alias for {@link formatColor}.
 */
export const hexFromOklch: typeof formatColor;

/**
 * Interpolate two OKLCH triples into `out`. Hue takes the shortest arc.
 * Zero-alloc when `out` is supplied.
 */
export function lerpOklch<T extends { [i: number]: number; length: number }>(
    a: ArrayLike<number>,
    b: ArrayLike<number>,
    t: number,
    out: T,
): T;

/**
 * Normalize a palette specification into a hex[] usable as
 * `AmbientConfig.colors`.
 *
 * Shape is duck-typed -- no import from `@zakkster/lite-hueforge` is required,
 * but hueforge's `scale.steps()` output plugs in unchanged:
 *
 * ```ts
 * const primary = createScale({ ... });
 * fx.updateConfig({ colors: colorsFromPalette(primary.steps()) });
 * ```
 */
export function colorsFromPalette(
    stops: readonly PaletteStop[],
    opts?: ColorsFromPaletteOptions,
): string[];

/**
 * Interpolate two full theme configs.
 *
 * Colors lerp channel-wise in OKLCH; scalars lerp linearly; `wind` lerps as
 * a vector; discrete fields (`behavior`, `depthBands`, `stretch`) step at
 * `t = 0.5`.
 *
 * When `out` is supplied, that reference is returned mutated in place -- its
 * `colors` array and `wind` object are reused. Safe to call at 10 Hz from a
 * `raf`/`effect` without allocation churn beyond the hex strings themselves.
 *
 * ```ts
 * const scratch = { colors: [], wind: { x: 0, y: 0 } } as any;
 * effect(() => {
 *   const t = dayCycle();                 // signal in [0, 1]
 *   fx.updateConfig(lerpTheme(THEMES.Night, THEMES.Fire, t, scratch));
 * });
 * ```
 */
export function lerpTheme<T extends AmbientConfig>(
    a: AmbientConfig,
    b: AmbientConfig,
    t: number,
    out?: T,
): T;


// ============================================================
//  FRAME BUDGET (v1.4.0)
// ============================================================

/**
 * Options for the frame-budget auto-degrader.
 * All fields optional; defaults tune for a ~50 fps floor.
 */
export interface FrameBudgetOptions {
    /** p90 above this triggers a degrade step (ms). Default 20. */
    targetMs?: number;
    /** p90 below this triggers a restore step (ms). Default targetMs * 0.7. */
    restoreMs?: number;
    /** Frames between adjustments. Default 60. */
    cooldown?: number;
    /** Fraction of base count to add/subtract per step. Default 0.10. */
    stepFrac?: number;
    /** Never degrade below this count. Default 20. */
    minCount?: number;
    /** Called on transitions from -> to. Fires only on adjustments, not per frame. */
    onDegrade?: (info: FrameBudgetEvent) => void;
}

export interface FrameBudgetEvent {
    from: number;
    to: number;
    reason: 'over-budget' | 'restore';
    /** p90 frame time (ms) at the transition. */
    p90: number;
}

/**
 * A running frame-budget state machine. Owned by an AmbientInstance when
 * `options.frameBudget` was set, or constructed standalone via
 * {@link createFrameBudget} for a custom render loop.
 */
export interface FrameBudget {
    readonly targetMs: number;
    readonly restoreMs: number;
    readonly minCount: number;
    /** The user-requested count -- the ceiling for restore steps. */
    readonly baseCount: number;
    /** The currently-rendering count after any degrade. */
    readonly currentCount: number;
    /** True once the rolling window has 32 samples. */
    readonly windowFilled: boolean;

    /**
     * Feed a frame-time sample and the current count.
     * @returns `-1` for no change, or the new count to apply.
     */
    note(dtMs: number, count: number): number;

    /** Update the base count when the effective cfg.count changes. */
    setBaseCount(n: number): void;

    /** Wipe the window -- call on visibility resume or long pauses. */
    reset(): void;
}

/**
 * Build a frame-budget auto-degrader. Pure state machine: no DOM access,
 * no timers. Usable standalone with a custom render loop, or wired into
 * createAmbientFX via `options.frameBudget`.
 */
export function createFrameBudget(opts?: FrameBudgetOptions): FrameBudget;

/**
 * Sample a linear curve at t. Curve is an array of >= 2 numbers, treated as
 * evenly-spaced control points across life [0, 1]. Zero-alloc.
 *
 * Values of t outside [0, 1] clamp to the endpoints.
 */
export function sampleCurve(curve: Curve, t: number): number;
