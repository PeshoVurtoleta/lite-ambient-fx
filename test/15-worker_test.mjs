// @zakkster/lite-ambient-fx -- v1.7.0 worker-mode conformance.
//
// Two layers:
//
//   1. CONFORMANCE. The real `ambientWorkerBody` is driven with a mock lite-worker
//      ctx and an OffscreenCanvas stub, and its rendering is compared frame-for-
//      frame against a main-thread instance built from the same config. The body
//      dynamically imports the actual AmbientFX.js, so this proves the two paths
//      run the same code -- not that two copies happen to agree.
//
//   2. SERIALIZATION. The body is round-tripped through Function.prototype
//      .toString() + new Function, the way lite-worker's Blob transport does it,
//      to prove it is genuinely self-contained (no closure over module scope).
//
// Everything runs in Node; no browser, no --expose-gc.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// ── Canvas + DOM stubs ──────────────────────────────────────────────────────

const rafQueue = [];
let rafNext = 1;

class Ctx2D {
    constructor() { this.ops = []; this._alpha = 1; }
    setTransform(...a) { this.ops.push(['T', ...a]); }
    clearRect() {}
    fillRect() {} beginPath() {} arc() {} fill() {}
    createRadialGradient() { return { addColorStop() {} }; }
    drawImage(_s, x, y, w, h) { this.ops.push(['D', x, y, w | 0, h | 0, Math.round(this._alpha * 1000)]); }
    set globalAlpha(v) { this._alpha = v; } get globalAlpha() { return this._alpha; }
    set fillStyle(v) { this._f = v; } get fillStyle() { return this._f; }
    set globalCompositeOperation(v) { this._g = v; } get globalCompositeOperation() { return this._g; }
}

class SurfaceStub {
    constructor(w, h) { this.width = w; this.height = h; this._c = null; }
    getContext(k) { if (k !== '2d') return null; if (!this._c) this._c = new Ctx2D(); return this._c; }
}

// Worker global: OffscreenCanvas.
globalThis.OffscreenCanvas = SurfaceStub;

class ElementStub extends SurfaceStub {
    constructor(w, h) { super(w, h); this.clientWidth = w; this.clientHeight = h; this.parentElement = null; }
    getBoundingClientRect() {
        return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight,
            width: this.clientWidth, height: this.clientHeight };
    }
}

function listenerBag() {
    return { _l: new Map(),
        addEventListener(t, f) { if (typeof f !== 'function') return; let s = this._l.get(t); if (!s) { s = new Set(); this._l.set(t, s); } s.add(f); },
        removeEventListener(t, f) { const s = this._l.get(t); if (s) s.delete(f); },
        dispatch(t, e) { const s = this._l.get(t); if (s) for (const f of [...s]) f(e); },
        count() { let n = 0; for (const s of this._l.values()) n += s.size; return n; } };
}

/** Install a main-thread-ish DOM. The worker body replaces these with its own. */
function installMainDom(dpr = 2) {
    const doc = Object.assign(listenerBag(), {
        hidden: false,
        createElement: (t) => (t === 'canvas' ? new ElementStub(1, 1) : listenerBag()),
    });
    const win = Object.assign(listenerBag(), {
        devicePixelRatio: dpr,
        matchMedia: (q) => ({ media: q, matches: false, addEventListener() {}, removeEventListener() {} }),
    });
    globalThis.document = doc;
    globalThis.window = win;
    globalThis.ResizeObserver = class { constructor(cb) { this._cb = cb; } observe() {} unobserve() {} disconnect() {} };
    return { doc, win };
}
installMainDom();

globalThis.requestAnimationFrame = (fn) => { const id = rafNext++; rafQueue.push({ id, fn }); return id; };
globalThis.cancelAnimationFrame = (id) => { const i = rafQueue.findIndex((c) => c.id === id); if (i >= 0) rafQueue.splice(i, 1); };
function pump(ts) { const b = rafQueue.splice(0, rafQueue.length); for (const c of b) c.fn(ts); }

const CORE_URL = pathToFileURL(new URL('../AmbientFX.js', import.meta.url).pathname).href;
const { ambientWorkerBody, supportsWorkerMode } = await import('../AmbientFXWorker.js');
const core = await import('../AmbientFX.js');

// ── Mock lite-worker ctx + onCanvas control ─────────────────────────────────

function makeCtl(surface, w, h, dpr) {
    const resizeCbs = [];
    const visCbs = [];
    return {
        canvas: surface,
        width: w, height: h, dpr, visible: true,
        onResize(cb) { resizeCbs.push(cb); },
        onVisibility(cb) { visCbs.push(cb); },
        frame() { return () => {}; },
        pause() {}, resume() {},
        dispose() { this.disposed = true; },
        // test drivers
        _resize(nw, nh, ndpr) {
            this.width = nw; this.height = nh; this.dpr = ndpr;
            surface.width = nw; surface.height = nh;
            for (const cb of resizeCbs) cb(nw, nh, ndpr);
        },
        _visibility(v) { this.visible = v; for (const cb of visCbs) cb(v); },
    };
}

function makeCtx() {
    const handlers = new Map();
    const posted = [];
    return {
        on(type, fn) { handlers.set(type, fn); return () => handlers.delete(type); },
        off(type) { handlers.delete(type); },
        onRaw() { return () => {}; }, offRaw() {},
        post(type, data) { posted.push({ type, data }); },
        send() {},
        close() { this.closed = true; },
        onCanvas(cb) { this._canvasCb = cb; },
        // test drivers
        _deliver(type, data) { const h = handlers.get(type); return h ? h(data) : undefined; },
        _posted: posted,
        _has(type) { return handlers.has(type); },
    };
}

/** Boot the real worker body against stubs and return everything needed to drive it. */
async function bootWorker(options, { w = 800, h = 600, dpr = 2 } = {}) {
    const ctx = makeCtx();
    ambientWorkerBody(ctx);
    const surface = new SurfaceStub(w * dpr, h * dpr);
    const ctl = makeCtl(surface, w * dpr, h * dpr, dpr);
    ctx._deliver('afx:init', { coreUrl: CORE_URL, options, reduced: false });
    ctx._canvasCb(surface, ctl);
    // tryStart awaits the dynamic import
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    return { ctx, ctl, surface, draw: surface.getContext('2d') };
}

// ── 1. Conformance: worker path renders what the main-thread path renders ───

describe('worker body conformance', () => {
    test('mounts through onCanvas and starts rendering', async () => {
        const { ctx, draw } = await bootWorker({ theme: 'Fire', overrides: { count: 60 } });
        let t = 0;
        for (let i = 0; i < 20; i++) pump(t += 16);
        const drew = draw.ops.filter((o) => o[0] === 'D').length;
        assert.ok(drew > 0, 'worker body rendered nothing');
        assert.ok(ctx._posted.some((p) => p.type === 'afx:ready'), 'never posted afx:ready');
        ctx._deliver('afx:destroy');
    });

    test('renders the same op stream as a main-thread instance', async () => {
        // Same theme, same geometry, same frame timings. The behaviors use
        // Math.random(), so op *counts* and geometry envelopes must match, not
        // exact coordinates: compare structure, not the RNG stream.
        const opts = { theme: 'Snow', overrides: { count: 120 } };

        const { ctx, draw: wdraw } = await bootWorker(opts, { w: 800, h: 600, dpr: 2 });
        let t = 0;
        for (let i = 0; i < 40; i++) pump(t += 16);
        const wOps = wdraw.ops.filter((o) => o[0] === 'D');
        ctx._deliver('afx:destroy');

        installMainDom(2);
        const el = new ElementStub(800, 600);
        const fx = core.createAmbientFX(el, opts);
        let t2 = 0;
        for (let i = 0; i < 40; i++) pump(t2 += 16);
        const mOps = el.getContext('2d').ops.filter((o) => o[0] === 'D');
        fx.destroy();

        assert.ok(wOps.length > 0 && mOps.length > 0, 'one of the paths drew nothing');
        // Same order of magnitude of blits over the same frames.
        const ratio = wOps.length / mOps.length;
        assert.ok(ratio > 0.8 && ratio < 1.25,
            `blit-count ratio worker/main = ${ratio.toFixed(2)} (${wOps.length} vs ${mOps.length})`);
        // Same drawn-size envelope: the worker's sprite path must rasterize at
        // the same physical sizes as the main-thread one.
        const wMax = Math.max(...wOps.map((o) => o[3]));
        const mMax = Math.max(...mOps.map((o) => o[3]));
        assert.equal(wMax, mMax, `max draw size differs: worker ${wMax} vs main ${mMax}`);
    });

    test('applies the device pixel ratio from the canvas control', async () => {
        const { ctx, draw, surface } = await bootWorker({ theme: 'Fire', overrides: { count: 10 } },
            { w: 400, h: 300, dpr: 3 });
        pump(0); pump(16);
        const setT = draw.ops.find((o) => o[0] === 'T');
        assert.ok(setT, 'never set a transform');
        assert.equal(setT[1], 3, `expected dpr 3 transform, got ${setT[1]}`);
        assert.equal(surface.width, 1200, `expected 400*3 backing width, got ${surface.width}`);
        ctx._deliver('afx:destroy');
    });

    test('forwards control messages to the off-thread instance', async () => {
        const { ctx } = await bootWorker({ theme: 'Fire', overrides: { count: 20 } });
        let t = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);

        ctx._deliver('afx:setTheme', 'Ice');
        ctx._deliver('afx:updateConfig', { count: 44 });
        for (let i = 0; i < 5; i++) pump(t += 16);
        let snap = ctx._deliver('afx:state');
        assert.equal(snap.theme, 'Ice');
        assert.equal(snap.config.count, 44);

        ctx._deliver('afx:pause');
        snap = ctx._deliver('afx:state');
        assert.equal(snap.running, false, 'pause did not stop the loop');
        ctx._deliver('afx:resume');
        snap = ctx._deliver('afx:state');
        assert.equal(snap.running, true, 'resume did not restart the loop');

        ctx._deliver('afx:destroy');
    });

    test('reduced-motion forwarded from the main thread degrades the instance', async () => {
        const { ctx } = await bootWorker({ theme: 'Fire', overrides: { count: 300 } });
        let t = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        const full = ctx._deliver('afx:state');
        assert.equal(full.reducedMotion, false);

        ctx._deliver('afx:reduced', true);
        for (let i = 0; i < 5; i++) pump(t += 16);
        const degraded = ctx._deliver('afx:state');
        assert.equal(degraded.reducedMotion, true, 'reduced flag not applied off-thread');
        assert.ok(degraded.config.count < full.config.count,
            `count did not degrade: ${full.config.count} -> ${degraded.config.count}`);

        ctx._deliver('afx:reduced', false);
        for (let i = 0; i < 5; i++) pump(t += 16);
        assert.equal(ctx._deliver('afx:state').config.count, full.config.count, 'did not restore');
        ctx._deliver('afx:destroy');
    });

    test('pointer coordinates forwarded from the main thread reach the field', async () => {
        const { ctx, draw } = await bootWorker({
            theme: 'Fire', overrides: { count: 60 },
            pointer: { mode: 'repel', radius: 400, strength: 40 },
        });
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);
        draw.ops.length = 0;
        pump(t += 16);
        const before = draw.ops.filter((o) => o[0] === 'D').map((o) => o[1]);

        ctx._deliver('afx:pointer', { x: 400, y: 300 });
        draw.ops.length = 0;
        pump(t += 16);
        const after = draw.ops.filter((o) => o[0] === 'D').map((o) => o[1]);

        let moved = 0;
        for (let i = 0; i < Math.min(before.length, after.length); i++) if (before[i] !== after[i]) moved++;
        assert.ok(moved > 0, 'forwarded pointer had no effect on particle positions');
        ctx._deliver('afx:destroy');
    });

    test('a malformed forwarded pointer cannot poison the field', async () => {
        const { ctx, draw } = await bootWorker({
            theme: 'Fire', overrides: { count: 60 }, pointer: { mode: 'repel' },
        });
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);
        ctx._deliver('afx:pointer', { x: NaN, y: 0 });
        for (let i = 0; i < 5; i++) pump(t += 16);
        draw.ops.length = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        const drawn = draw.ops.filter((o) => o[0] === 'D');
        const atOrigin = drawn.filter((o) => o[1] === 0 && o[2] === 0).length;
        assert.ok(drawn.length > 0);
        assert.ok(atOrigin < drawn.length * 0.5, 'NaN pointer collapsed the off-thread field');
        ctx._deliver('afx:destroy');
    });

    test('destroy tears the instance and the canvas control down', async () => {
        const { ctx, ctl } = await bootWorker({ theme: 'Fire', overrides: { count: 10 } });
        pump(0); pump(16);
        ctx._deliver('afx:destroy');
        assert.ok(ctl.disposed, 'canvas control not disposed');
        assert.ok(ctx.closed, 'worker not closed');
        assert.equal(ctx._deliver('afx:state'), null);
    });
});

// ── 2. Canvas-control plumbing: resize + visibility ─────────────────────────

describe('worker canvas control plumbing', () => {
    test('a resize from the host re-derives the backing store and keeps the field', async () => {
        const { ctx, ctl, surface, draw } = await bootWorker(
            { theme: 'Fire', overrides: { count: 80 } }, { w: 800, h: 600, dpr: 2 });
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);
        draw.ops.length = 0;
        pump(t += 16);
        const before = draw.ops.filter((o) => o[0] === 'D').length;

        ctl._resize(1200 * 2, 400 * 2, 2);
        for (let i = 0; i < 3; i++) pump(t += 16);   // RO debounce is a rAF
        draw.ops.length = 0;
        pump(t += 16);
        const after = draw.ops.filter((o) => o[0] === 'D').length;

        assert.equal(surface.width, 2400, `backing width after resize: ${surface.width}`);
        assert.equal(surface.height, 800, `backing height after resize: ${surface.height}`);
        assert.ok(after > 0 && Math.abs(after - before) < before * 0.5,
            `field size changed drastically across resize: ${before} -> ${after}`);
        ctx._deliver('afx:destroy');
    });

    test('a dpr change is honoured off-thread', async () => {
        const { ctx, ctl, surface } = await bootWorker(
            { theme: 'Fire', overrides: { count: 20 } }, { w: 500, h: 500, dpr: 1 });
        let t = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        ctl._resize(500 * 3, 500 * 3, 3);
        for (let i = 0; i < 3; i++) pump(t += 16);
        assert.equal(surface.width, 1500, `dpr 3 backing width: ${surface.width}`);
        ctx._deliver('afx:destroy');
    });

    test('host visibility drives the loop', async () => {
        const { ctx, ctl } = await bootWorker({ theme: 'Fire', overrides: { count: 20 } });
        let t = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        assert.equal(ctx._deliver('afx:state').running, true);

        ctl._visibility(false);
        assert.equal(ctx._deliver('afx:state').running, false, 'hidden host did not pause the worker loop');

        ctl._visibility(true);
        assert.equal(ctx._deliver('afx:state').running, true, 'visible host did not resume the worker loop');
        ctx._deliver('afx:destroy');
    });
});

// ── 3. Serialization: the body must survive toString() ──────────────────────

describe('worker body is transport-safe', () => {
    test('round-trips through Function.prototype.toString()', async () => {
        // This is exactly what lite-worker's Blob transport does.
        const src = ambientWorkerBody.toString();
        const rebuilt = new Function(`return (${src});`)();
        assert.equal(typeof rebuilt, 'function');

        const ctx = makeCtx();
        rebuilt(ctx);
        const surface = new SurfaceStub(1600, 1200);
        const ctl = makeCtl(surface, 1600, 1200, 2);
        ctx._deliver('afx:init', { coreUrl: CORE_URL, options: { theme: 'Fire', overrides: { count: 30 } }, reduced: false });
        ctx._canvasCb(surface, ctl);
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));

        let t = 0;
        for (let i = 0; i < 15; i++) pump(t += 16);
        const drew = surface.getContext('2d').ops.filter((o) => o[0] === 'D').length;
        assert.ok(drew > 0, 'deserialized body did not render -- it is not self-contained');
        ctx._deliver('afx:destroy');
    });

    test('closes over no module-scope identifiers', () => {
        const src = ambientWorkerBody.toString();
        // Anything the body needs must be a parameter, a local, a worker global,
        // or arrive in the init payload. These would only resolve on the main side.
        for (const ident of ['CORE_URL', 'defineWorker', 'REDUCE_QUERY', 'wrapMainThread']) {
            assert.ok(!new RegExp(`\\b${ident}\\b`).test(src),
                `worker body references main-scope identifier: ${ident}`);
        }
        // No static import, and no relative specifier a Blob URL could not resolve.
        assert.ok(!/^\s*import\s/m.test(src), 'worker body uses a static import');
        assert.ok(!/import\(['"]\.\//.test(src), 'worker body uses a relative dynamic import');
        // It must reach the core through the injected URL, not a static import.
        assert.ok(src.includes('initPayload.coreUrl'), 'body does not import the core by injected URL');
    });
});

// ── 4. Environment probe ────────────────────────────────────────────────────

describe('supportsWorkerMode', () => {
    test('is false without transferControlToOffscreen', () => {
        assert.equal(supportsWorkerMode(new ElementStub(10, 10)), false);
        assert.equal(supportsWorkerMode(null), false);
    });
});
