/**
 * @zakkster/lite-ambient-fx/worker -- OffscreenCanvas worker mode.
 *
 * Separate export path on purpose. `AmbientFX.js` stays zero-dependency and
 * single-file; this entry is the only thing that pulls `@zakkster/lite-worker`,
 * so importing the core never drags a dependency in. Consumers who never touch
 * `/worker` ship exactly what they shipped before.
 *
 * The worker body below does NOT re-implement the behaviors. It dynamically
 * imports the real `AmbientFX.js` by absolute URL, so off-thread rendering is
 * the same code as on-thread rendering and cannot drift. What the body *does*
 * provide is the small DOM surface the core reads (`document.createElement`
 * for sprite rasterization, `window.devicePixelRatio`, `matchMedia`,
 * `ResizeObserver`, `visibilitychange`) mapped onto lite-worker's `onCanvas`
 * control object.
 *
 * MIT (c) Zahary Shinikchiev
 */

import { defineWorker } from '@zakkster/lite-worker';
import { createAmbientFX } from './AmbientFX.js';

export const WORKER_VERSION = '1.7.0';

/** Absolute URL of the core module, resolved against this file. */
const CORE_URL = new URL('./AmbientFX.js', import.meta.url).href;

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/* ------------------------------------------------------------------ *
 * Worker body                                                         *
 * ------------------------------------------------------------------ *
 * Serialized with Function.prototype.toString(), so it must be entirely
 * self-contained: no closure over module scope, no bare import specifiers.
 * Exported for the conformance test, which drives it with a mock ctx.
 */
export function ambientWorkerBody(ctx) {
    let fx = null;
    let ctl = null;
    let initPayload = null;
    let reduced = false;
    let coreModule = null;
    // A worker's requestAnimationFrame is not throttled by the host tab's
    // visibility the way the main thread's is, so an ambient backdrop would keep
    // burning a core behind a hidden tab. Pause explicitly and remember that we
    // -- not the caller -- did it, so an explicit pause() is never undone.
    let autoPaused = false;

    const winListeners = new Map();
    const docListeners = new Map();
    const roCallbacks = new Set();

    function addTo(map, type, fn) {
        if (typeof fn !== 'function') return;
        let s = map.get(type);
        if (s === undefined) { s = new Set(); map.set(type, s); }
        s.add(fn);
    }
    function removeFrom(map, type, fn) {
        const s = map.get(type);
        if (s !== undefined) s.delete(fn);
    }
    function fire(map, type, ev) {
        const s = map.get(type);
        if (s === undefined) return;
        for (const fn of Array.from(s)) fn(ev);
    }

    /** The DOM surface AmbientFX.js reads, backed by the worker globals. */
    function installEnv(control) {
        const doc = {
            hidden: !control.visible,
            createElement(tag) {
                // Sprite rasterization target. OffscreenCanvas is the worker
                // equivalent of a detached <canvas>.
                if (tag === 'canvas') return new OffscreenCanvas(1, 1);
                return {};
            },
            addEventListener(t, f) { addTo(docListeners, t, f); },
            removeEventListener(t, f) { removeFrom(docListeners, t, f); },
        };
        const win = {
            devicePixelRatio: control.dpr || 1,
            matchMedia(query) {
                const isReduceQuery = String(query).indexOf('reduce') >= 0;
                return {
                    media: query,
                    get matches() { return isReduceQuery ? reduced : false; },
                    addEventListener(t, f) { if (isReduceQuery) addTo(docListeners, 'afx:reduce', f); },
                    removeEventListener(t, f) { if (isReduceQuery) removeFrom(docListeners, 'afx:reduce', f); },
                };
            },
            addEventListener(t, f) { addTo(winListeners, t, f); },
            removeEventListener(t, f) { removeFrom(winListeners, t, f); },
        };
        globalThis.document = doc;
        globalThis.window = win;
        globalThis.ResizeObserver = class {
            constructor(cb) { this._cb = cb; }
            observe() { roCallbacks.add(this._cb); }
            unobserve() { roCallbacks.delete(this._cb); }
            disconnect() { roCallbacks.delete(this._cb); }
        };
        return { doc, win };
    }

    /**
     * Presents the transferred OffscreenCanvas with the few element-ish fields
     * the core reads. Sizes are getters so a resize is picked up without
     * re-creating the instance.
     */
    function makeCanvasProxy(surface, control) {
        return {
            get width() { return surface.width; },
            set width(v) { surface.width = v; },
            get height() { return surface.height; },
            set height(v) { surface.height = v; },
            get clientWidth() {
                const d = control.dpr || 1;
                return Math.max(1, Math.round(control.width / d));
            },
            get clientHeight() {
                const d = control.dpr || 1;
                return Math.max(1, Math.round(control.height / d));
            },
            parentElement: null,
            getContext(kind, o) { return surface.getContext(kind, o); },
            getBoundingClientRect() {
                return {
                    left: 0, top: 0,
                    right: this.clientWidth, bottom: this.clientHeight,
                    width: this.clientWidth, height: this.clientHeight,
                };
            },
        };
    }

    async function tryStart() {
        if (fx !== null || ctl === null || initPayload === null) return;

        const env = installEnv(ctl);
        reduced = !!initPayload.reduced;

        // The real module -- not a copy of it.
        if (coreModule === null) {
            coreModule = initPayload.module || await import(initPayload.coreUrl);
        }

        const proxy = makeCanvasProxy(ctl.canvas, ctl);

        ctl.onResize((w, h, dpr) => {
            env.win.devicePixelRatio = dpr || 1;
            for (const cb of Array.from(roCallbacks)) cb([{ target: proxy }], null);
        });
        ctl.onVisibility((visible) => {
            env.doc.hidden = !visible;
            fire(docListeners, 'visibilitychange', { type: 'visibilitychange' });
            if (fx === null) return;
            if (!visible) {
                if (fx.running) { fx.pause(); autoPaused = true; }
            } else if (autoPaused) {
                autoPaused = false;
                fx.resume();
            }
        });

        fx = coreModule.createAmbientFX(proxy, initPayload.options || {});
        ctx.post('afx:ready', snapshot());
    }

    function snapshot() {
        if (fx === null) return null;
        const stats = coreModule && coreModule.ambientSpriteCacheStats
            ? coreModule.ambientSpriteCacheStats()
            : null;
        return {
            theme: fx.theme,
            count: fx.count,
            running: fx.running,
            reducedMotion: fx.reducedMotion,
            spawned: fx.spawned,
            config: fx.config,
            spriteCache: stats,
        };
    }

    ctx.on('afx:init', (d) => { initPayload = d; tryStart(); });
    ctx.onCanvas((surface, control) => { ctl = control; tryStart(); });

    ctx.on('afx:setTheme', (d) => { if (fx) fx.setTheme(d); });
    ctx.on('afx:updateConfig', (d) => { if (fx) fx.updateConfig(d); });
    ctx.on('afx:setPointer', (d) => { if (fx) fx.setPointer(d); });
    ctx.on('afx:setFrameBudget', (d) => { if (fx) fx.setFrameBudget(d); });
    ctx.on('afx:pause', () => { autoPaused = false; if (fx) fx.pause(); });
    ctx.on('afx:resume', () => { autoPaused = false; if (fx) fx.resume(); });

    // Pointer events cannot reach a worker; the main side forwards coalesced
    // coordinates already relative to the canvas rect. Dispatching them through
    // the shimmed window means the core's own handlers -- and every pointer
    // mode -- run unmodified.
    ctx.on('afx:pointer', (d) => {
        if (d && d.end) { fire(winListeners, 'pointerup', {}); return; }
        if (d && d.out) { fire(winListeners, 'pointercancel', {}); return; }
        if (!d) return;
        fire(winListeners, 'pointermove', { clientX: d.x, clientY: d.y, pointerType: d.t || 'mouse' });
    });

    ctx.on('afx:reduced', (d) => {
        reduced = !!d;
        fire(docListeners, 'afx:reduce', { matches: reduced });
    });

    ctx.on('afx:destroy', () => {
        if (fx) { fx.destroy(); fx = null; }
        if (ctl) { ctl.dispose(); ctl = null; }
        ctx.close();
    });

    ctx.on('afx:state', () => snapshot());
}

/* ------------------------------------------------------------------ *
 * Main thread                                                         *
 * ------------------------------------------------------------------ */

/** True when this environment can hand a canvas to a worker. */
export function supportsWorkerMode(canvas) {
    return typeof Worker === 'function'
        && typeof OffscreenCanvas === 'function'
        && !!canvas
        && typeof canvas.transferControlToOffscreen === 'function';
}

/**
 * Run an ambient atmosphere on a worker thread against an OffscreenCanvas.
 *
 * Returns the same control surface as `createAmbientFX`, minus the synchronous
 * getters -- the instance lives off-thread, so `config`/`count` are served from
 * the last snapshot and `state()` fetches a fresh one. `ready` resolves once the
 * worker has mounted.
 *
 * `fallback` (default true) transparently returns a main-thread instance when
 * the environment cannot do worker mode, so callers do not need two code paths.
 */
export function createAmbientFXWorker(canvas, options = {}) {
    const { fallback = true, workerName = 'ambient-fx', maxDpr = 2, ...rest } = options;

    if (!supportsWorkerMode(canvas)) {
        if (!fallback) {
            throw new Error(
                'AmbientFX: worker mode needs Worker + OffscreenCanvas + '
                + 'canvas.transferControlToOffscreen (pass fallback: true to degrade)',
            );
        }
        return wrapMainThread(createAmbientFX(canvas, rest));
    }

    const handle = defineWorker(ambientWorkerBody, {
        type: 'module',
        name: workerName,
        onError: typeof rest.onWorkerError === 'function' ? rest.onWorkerError : undefined,
    }).spawn();

    const reduceMedia = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
        ? window.matchMedia(REDUCE_QUERY)
        : null;

    let last = null;
    let destroyed = false;

    const ready = new Promise((resolve) => {
        const off = handle.on('afx:ready', (snap) => { off(); last = snap; resolve(snap); });
    });

    handle.post('afx:init', {
        coreUrl: CORE_URL,
        options: rest,
        reduced: !!(reduceMedia && reduceMedia.matches),
    });

    const canvasCtl = handle.adoptCanvas(canvas, { maxDpr });

    // Reduced-motion lives on the main thread; forward flips so the worker's
    // instance degrades and restores exactly like an on-thread one.
    const onReduce = (e) => { if (!destroyed) handle.post('afx:reduced', !!e.matches); };
    if (reduceMedia && typeof reduceMedia.addEventListener === 'function') {
        reduceMedia.addEventListener('change', onReduce);
    }

    // Pointer forwarding, coalesced to at most one message per frame and only
    // when the position actually changed. Off entirely unless a mode is set.
    let pointerBound = false;
    let px = 0;
    let py = 0;
    let pDirty = false;
    let pRaf = 0;

    function flushPointer() {
        pRaf = 0;
        if (!pDirty || destroyed) return;
        pDirty = false;
        handle.post('afx:pointer', { x: px, y: py });
    }
    function onMove(e) {
        const rect = canvas.getBoundingClientRect();
        const nx = e.clientX - rect.left;
        const ny = e.clientY - rect.top;
        if (nx !== nx || ny !== ny) return;
        if (nx === px && ny === py) return;
        px = nx; py = ny; pDirty = true;
        if (pRaf === 0) pRaf = requestAnimationFrame(flushPointer);
    }
    function onEnd() { if (!destroyed) handle.post('afx:pointer', { end: true }); }
    function onOut() { if (!destroyed) handle.post('afx:pointer', { out: true }); }

    function bindPointer() {
        if (pointerBound || typeof window === 'undefined') return;
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerdown', onMove, { passive: true });
        window.addEventListener('pointerup', onEnd, { passive: true });
        window.addEventListener('pointercancel', onOut, { passive: true });
        pointerBound = true;
    }
    function unbindPointer() {
        if (!pointerBound) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onOut);
        pointerBound = false;
    }
    if (rest.pointer && rest.pointer.mode && rest.pointer.mode !== 'off') bindPointer();

    return {
        /** Escape hatch: the underlying lite-worker handle. */
        worker: handle,
        /** adoptCanvas control ({ resize, pause, resume, dispose }). */
        canvasControl: canvasCtl,
        ready,
        get mode() { return 'worker'; },
        get destroyed() { return destroyed; },

        // Last known snapshot -- synchronous, may lag by a frame.
        get theme() { return last ? last.theme : undefined; },
        get count() { return last ? last.count : 0; },
        get config() { return last ? last.config : undefined; },
        get running() { return last ? last.running : false; },
        get reducedMotion() { return last ? last.reducedMotion : false; },
        get spawned() { return last ? last.spawned : 0; },

        /** Fetch a fresh snapshot from the worker. */
        async state() {
            if (destroyed) return last;
            last = await handle.call('afx:state');
            return last;
        },

        setTheme(name) { handle.post('afx:setTheme', name); return this; },
        updateConfig(partial) { handle.post('afx:updateConfig', partial); return this; },
        setFrameBudget(spec) { handle.post('afx:setFrameBudget', spec); return this; },
        setPointer(spec) {
            handle.post('afx:setPointer', spec);
            if (spec && spec.mode && spec.mode !== 'off') bindPointer();
            else unbindPointer();
            return this;
        },
        pause() { handle.post('afx:pause'); return this; },
        resume() { handle.post('afx:resume'); return this; },

        destroy() {
            if (destroyed) return;
            destroyed = true;
            unbindPointer();
            if (pRaf !== 0) { cancelAnimationFrame(pRaf); pRaf = 0; }
            if (reduceMedia && typeof reduceMedia.removeEventListener === 'function') {
                reduceMedia.removeEventListener('change', onReduce);
            }
            handle.post('afx:destroy');
            if (canvasCtl && typeof canvasCtl.dispose === 'function') canvasCtl.dispose();
            handle.destroy();
        },
    };
}

/** Presents a main-thread instance through the worker-mode surface. */
function wrapMainThread(fx) {
    return {
        worker: null,
        canvasControl: null,
        ready: Promise.resolve(null),
        get mode() { return 'main'; },
        get destroyed() { return fx.destroyed; },
        get theme() { return fx.theme; },
        get count() { return fx.count; },
        get config() { return fx.config; },
        get running() { return fx.running; },
        get reducedMotion() { return fx.reducedMotion; },
        get spawned() { return fx.spawned; },
        async state() {
            return {
                theme: fx.theme, count: fx.count, running: fx.running,
                reducedMotion: fx.reducedMotion, spawned: fx.spawned, config: fx.config,
                spriteCache: null,
            };
        },
        setTheme(n) { fx.setTheme(n); return this; },
        updateConfig(p) { fx.updateConfig(p); return this; },
        setFrameBudget(s) { fx.setFrameBudget(s); return this; },
        setPointer(s) { fx.setPointer(s); return this; },
        pause() { fx.pause(); return this; },
        resume() { fx.resume(); return this; },
        destroy() { fx.destroy(); },
    };
}

export default createAmbientFXWorker;
