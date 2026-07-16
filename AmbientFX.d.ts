/**
 * @zakkster/lite-ambient-fx -- TypeScript declarations.
 * (c) 2026 Zahary Shinikchiev. MIT.
 */

export type BuiltInBehavior = 'EMBER' | 'MIST' | 'FLOAT' | 'CHAOS';

/**
 * Any registered behavior name -- widen to `string` because users can
 * install their own via `registerBehavior`.
 */
export type BehaviorName = BuiltInBehavior | (string & {});

export type BuiltInTheme =
    | 'Fire' | 'Night' | 'Ice' | 'Frost' | 'Toxic' | 'Void'
    | 'Dust' | 'Aurora' | 'Abyss';

/** Any registered theme name -- widened because users add their own via `registerTheme`. */
export type ThemeName = BuiltInTheme | (string & {});

export interface WindVector {
    x: number;
    y: number;
}

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
    /** Amplitude of the sin-LUT lateral turbulence. */
    turbulence: number;
}

export interface AmbientOptions {
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
}

export interface AmbientInstance {
    setTheme(name: ThemeName): void;
    updateConfig(overrides: Partial<AmbientConfig>): void;
    /** The config actually being rendered (degraded when reduced-motion is active). */
    readonly config: AmbientConfig;
    /** The config as requested, before any reduced-motion degrade. */
    readonly baseConfig: AmbientConfig;
    /** True while `prefers-reduced-motion: reduce` matches and it is not opted out. */
    readonly reducedMotion: boolean;
    readonly theme: ThemeName;
    readonly count: number;
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

/** Drop cached sprites by color, or the entire cache when `colors` is omitted. */
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
