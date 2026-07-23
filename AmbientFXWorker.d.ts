/**
 * @zakkster/lite-ambient-fx/worker -- OffscreenCanvas worker mode.
 *
 * Separate entry point: importing the core never pulls @zakkster/lite-worker in.
 */

import type { AmbientConfig, AmbientOptions, PointerSpec, FrameBudgetSpec } from './AmbientFX.js';

export declare const WORKER_VERSION: string;

/** Cache census as seen from inside the worker. */
export interface WorkerSpriteCacheStats {
    colors: number;
    sprites: number;
    retained: number;
}

/** Snapshot of the off-thread instance. */
export interface AmbientWorkerState {
    theme: string;
    count: number;
    running: boolean;
    reducedMotion: boolean;
    spawned: number;
    config: AmbientConfig;
    spriteCache: WorkerSpriteCacheStats | null;
}

export interface AmbientWorkerOptions extends AmbientOptions {
    /** Degrade to a main-thread instance when the environment cannot do worker mode. Default true. */
    fallback?: boolean;
    /** Worker name, for devtools. Default 'ambient-fx'. */
    workerName?: string;
    /** Device-pixel-ratio ceiling forwarded to adoptCanvas. Default 2. */
    maxDpr?: number;
    /** Called with any error surfaced by the worker. */
    onWorkerError?: (err: Error) => void;
}

/** Control surface for an atmosphere running on a worker thread. */
export interface AmbientWorkerInstance {
    /** The underlying lite-worker handle (escape hatch); null in fallback mode. */
    readonly worker: unknown | null;
    /** adoptCanvas control; null in fallback mode. */
    readonly canvasControl: { resize(): void; pause(): void; resume(): void; dispose(): void } | null;
    /** Resolves once the worker has mounted the canvas. */
    readonly ready: Promise<AmbientWorkerState | null>;
    /** 'worker' when off-thread, 'main' when it fell back. */
    readonly mode: 'worker' | 'main';
    readonly destroyed: boolean;

    /** Last known snapshot; may lag by a frame. Use state() for a fresh read. */
    readonly theme: string | undefined;
    readonly count: number;
    readonly config: AmbientConfig | undefined;
    readonly running: boolean;
    readonly reducedMotion: boolean;
    readonly spawned: number;

    state(): Promise<AmbientWorkerState | null>;

    setTheme(name: string): this;
    updateConfig(partial: Partial<AmbientConfig>): this;
    setFrameBudget(spec: FrameBudgetSpec | boolean | null): this;
    setPointer(spec: PointerSpec): this;
    pause(): this;
    resume(): this;
    destroy(): void;
}

/** True when this environment can hand `canvas` to a worker. */
export declare function supportsWorkerMode(canvas: unknown): boolean;

/**
 * Run an ambient atmosphere on a worker thread against an OffscreenCanvas.
 * Falls back to a main-thread instance unless `fallback: false`.
 */
export declare function createAmbientFXWorker(
    canvas: HTMLCanvasElement,
    options?: AmbientWorkerOptions,
): AmbientWorkerInstance;

/**
 * The serialized worker body. Exported for conformance testing; you do not need
 * to call this directly.
 */
export declare function ambientWorkerBody(ctx: unknown): void;

export default createAmbientFXWorker;
