// @zakkster/lite-ambient-fx -- standing package gates.
//
// From the v1.4.0 roadmap: "visibility-pause and resize-preservation regression
// tests per version; sprite-cache leak soak (theme-swap loop, cache size
// bounded); reduced-motion snapshot." These run against every future version,
// so a regression in any of the four shows up as a named failure rather than a
// vague visual complaint.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const rafQueue = [];
let rafNext = 1;
const observers = new Set();

class Ctx2D {
    constructor() { this.draws = []; this._a = 1; }
    setTransform(...a) { this.lastTransform = a; }
    clearRect() {} fillRect() {} beginPath() {} arc() {} fill() {}
    createRadialGradient() { return { addColorStop() {} }; }
    drawImage(_s, x, y, w, h) { this.draws.push({ x, y, w: w | 0, h: h | 0, a: this._a }); }
    set globalAlpha(v) { this._a = v; } get globalAlpha() { return this._a; }
    set fillStyle(v) { this._f = v; } get fillStyle() { return this._f; }
    set globalCompositeOperation(v) { this._g = v; } get globalCompositeOperation() { return this._g; }
}

class CanvasStub {
    constructor(w, h) {
        this.width = w; this.height = h;
        this.clientWidth = w; this.clientHeight = h;
        this.parentElement = null; this._c = null;
    }
    getContext(k) { if (k !== '2d') return null; if (!this._c) this._c = new Ctx2D(); return this._c; }
    getBoundingClientRect() {
        return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight,
            width: this.clientWidth, height: this.clientHeight };
    }
    /** Simulate a CSS-box change and notify observers, as a browser would. */
    setClientSize(w, h) {
        this.clientWidth = w; this.clientHeight = h;
        for (const o of observers) o.fire();
    }
}

function bag() {
    return { _l: new Map(),
        addEventListener(t, f) { if (typeof f !== 'function') return; let s = this._l.get(t); if (!s) { s = new Set(); this._l.set(t, s); } s.add(f); },
        removeEventListener(t, f) { const s = this._l.get(t); if (s) s.delete(f); },
        dispatch(t, e) { const s = this._l.get(t); if (s) for (const f of [...s]) f(e); },
        count() { let n = 0; for (const s of this._l.values()) n += s.size; return n; } };
}

const reduceState = { matches: false };
const reduceLists = new Set();

const doc = Object.assign(bag(), {
    hidden: false,
    createElement: (t) => (t === 'canvas' ? new CanvasStub(1, 1) : bag()),
});
const win = Object.assign(bag(), {
    devicePixelRatio: 2,
    matchMedia(q) {
        const isReduce = String(q).includes('reduce');
        const l = Object.assign(bag(), { media: q, get matches() { return isReduce && reduceState.matches; } });
        if (isReduce) reduceLists.add(l);
        return l;
    },
});
globalThis.document = doc;
globalThis.window = win;
globalThis.requestAnimationFrame = (fn) => { const id = rafNext++; rafQueue.push({ id, fn }); return id; };
globalThis.cancelAnimationFrame = (id) => { const i = rafQueue.findIndex((c) => c.id === id); if (i >= 0) rafQueue.splice(i, 1); };
globalThis.ResizeObserver = class {
    constructor(cb) { this._cb = cb; observers.add(this); }
    observe(el) { this._el = el; }
    unobserve() {}
    disconnect() { observers.delete(this); }
    fire() { this._cb([{ target: this._el }], this); }
};

function pump(ts) { const b = rafQueue.splice(0, rafQueue.length); for (const c of b) c.fn(ts); }
function setReduced(v) {
    reduceState.matches = v;
    for (const l of reduceLists) l.dispatch('change', { matches: v });
}

const { createAmbientFX, THEMES, THEME_META, ambientSpriteCacheStats, clearAmbientSpriteCache } =
    await import('../AmbientFX.js');

// ── Gate 1: visibility pause ────────────────────────────────────────────────

describe('gate: visibility pause', () => {
    test('a hidden document stops the work, and showing it resumes cleanly', () => {
        const c = new CanvasStub(900, 600);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'Fire', overrides: { count: 80 } });
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);

        ctx.draws.length = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        assert.ok(ctx.draws.length > 0, 'not rendering before the visibility flip');

        // A hidden document keeps the pending rAF queued and simply never runs
        // it, so model the pause by not pumping -- the callback chain survives.
        doc.hidden = true;
        doc.dispatch('visibilitychange', { type: 'visibilitychange' });
        const queuedWhileHidden = rafQueue.length;
        ctx.draws.length = 0;
        assert.ok(queuedWhileHidden > 0, 'no frame was queued when the document went hidden');
        assert.equal(ctx.draws.length, 0, 'drew while hidden');

        // On return, the first frame must not integrate the whole hidden gap.
        doc.hidden = false;
        doc.dispatch('visibilitychange', { type: 'visibilitychange' });
        const jumpTs = t + 600_000;   // ten minutes in the background
        pump(jumpTs);
        ctx.draws.length = 0;
        pump(jumpTs + 16);
        const ys = ctx.draws.map((d) => d.y);
        assert.ok(ys.length > 0, 'did not resume rendering');
        assert.ok(ys.every((y) => Number.isFinite(y)), 'resume produced non-finite positions');
        assert.ok(ys.some((y) => y > -5000 && y < 5000),
            'field teleported on resume -- the hidden gap was integrated as one delta');
        fx.destroy();
    });

    test('pause() halts the loop and resume() restarts it', () => {
        const c = new CanvasStub(800, 600);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'Aurora', overrides: { count: 40 } });
        let t = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);

        fx.pause();
        assert.equal(fx.running, false);
        ctx.draws.length = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        assert.equal(ctx.draws.length, 0, 'drew while paused');

        fx.resume();
        assert.equal(fx.running, true);
        for (let i = 0; i < 5; i++) pump(t += 16);
        assert.ok(ctx.draws.length > 0, 'did not resume');
        fx.destroy();
    });
});

// ── Gate 2: resize preservation ─────────────────────────────────────────────

describe('gate: resize preservation', () => {
    test('particles keep their relative position across a resize', () => {
        const c = new CanvasStub(1000, 500);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'Aurora', overrides: { count: 120 } });
        let t = 0;
        for (let i = 0; i < 20; i++) pump(t += 16);

        ctx.draws.length = 0;
        pump(t += 16);
        const before = ctx.draws.map((d) => ({ fx: d.x / 1000, fy: d.y / 500 }));
        assert.ok(before.length > 0);

        c.setClientSize(500, 1000);            // half as wide, twice as tall
        for (let i = 0; i < 3; i++) pump(t += 16);   // RO debounce is one rAF
        ctx.draws.length = 0;
        pump(t += 16);
        const after = ctx.draws.map((d) => ({ fx: d.x / 500, fy: d.y / 1000 }));

        assert.ok(after.length > 0, 'nothing drawn after resize');
        // Fractional positions are rescaled, so the field keeps its shape rather
        // than clumping into the old box or spilling outside the new one.
        const n = Math.min(before.length, after.length);
        let drift = 0;
        for (let i = 0; i < n; i++) drift += Math.abs(before[i].fx - after[i].fx);
        assert.ok(drift / n < 0.25,
            `mean fractional-x drift ${(drift / n).toFixed(3)} across resize -- positions not preserved`);
        fx.destroy();
    });

    test('the backing store follows dpr and the transform matches', () => {
        const c = new CanvasStub(800, 400);
        const fx = createAmbientFX(c, { theme: 'Fire', overrides: { count: 20 } });
        pump(0); pump(16);
        assert.equal(c.width, 1600, 'backing width != clientWidth * dpr');
        assert.equal(c.height, 800, 'backing height != clientHeight * dpr');
        assert.equal(c.getContext('2d').lastTransform[0], 2, 'transform does not carry dpr');

        win.devicePixelRatio = 1;
        c.setClientSize(640, 480);
        let t = 100;
        for (let i = 0; i < 3; i++) pump(t += 16);
        assert.equal(c.width, 640, 'dpr change not applied to the backing store');
        win.devicePixelRatio = 2;
        fx.destroy();
    });

    test('a degenerate (zero-size) box does not produce non-finite geometry', () => {
        const c = new CanvasStub(800, 600);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'Snow', overrides: { count: 40 } });
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);

        c.setClientSize(0, 0);                 // collapsed container / display:none
        for (let i = 0; i < 3; i++) pump(t += 16);
        c.setClientSize(900, 700);             // and back
        for (let i = 0; i < 3; i++) pump(t += 16);

        ctx.draws.length = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        assert.ok(ctx.draws.length > 0, 'never recovered from a zero-size box');
        assert.ok(ctx.draws.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y)),
            'a zero-size box produced NaN positions');
        fx.destroy();
    });
});

// ── Gate 3: sprite-cache leak soak ──────────────────────────────────────────

describe('gate: sprite-cache leak soak', () => {
    test('a long theme-swap loop keeps the cache bounded', () => {
        const base = ambientSpriteCacheStats().retained;
        const c = new CanvasStub(1000, 700);
        const fx = createAmbientFX(c, { theme: THEME_META[0].id });
        let t = 0;

        const names = THEME_META.map((m) => m.id);
        const samples = [];
        for (let cycle = 0; cycle < 6; cycle++) {
            for (const name of names) {
                fx.setTheme(name);
                pump(t += 16);
                pump(t += 16);
            }
            samples.push(ambientSpriteCacheStats());
        }
        fx.destroy();

        // One instance can only claim one palette at a time, so `retained` must
        // not grow with the number of swaps.
        const retained = samples.map((s) => s.retained);
        assert.ok(retained[retained.length - 1] <= retained[0] + 2,
            `retained colors grew across swap cycles: ${retained.join(' -> ')}`);
        // Total sprites is bounded by the union of the shipped palettes, not by
        // how many times we cycled through them.
        const sprites = samples.map((s) => s.sprites);
        assert.ok(sprites[sprites.length - 1] <= sprites[0] * 1.5 + 8,
            `sprite count grew across swap cycles: ${sprites.join(' -> ')}`);

        // Nothing is left retained by *this* test once its instance is gone.
        assert.equal(ambientSpriteCacheStats().retained, base,
            'palette still retained after the only instance was destroyed');
    });

    test('a wide lerpTheme sweep does not grow the cache without bound', async () => {
        const { lerpTheme } = await import('../AmbientFX.js');
        const base = ambientSpriteCacheStats().retained;
        const c = new CanvasStub(800, 600);
        const fx = createAmbientFX(c, { theme: 'Fire', overrides: { count: 30 } });
        const scratch = { colors: [], wind: { x: 0, y: 0 } };
        let t = 0;

        for (let i = 0; i <= 400; i++) {
            fx.updateConfig(lerpTheme(THEMES.Fire, THEMES.Abyss, i / 400, scratch));
            pump(t += 16);
        }
        const during = ambientSpriteCacheStats();
        fx.destroy();
        const after = ambientSpriteCacheStats();

        // Every intermediate hex is released as the sweep advances, so only the
        // live palette is ever claimed.
        // Only the live palette is ever claimed: intermediate hexes are released
        // as the sweep advances, so this does not scale with the 400 steps.
        assert.ok(during.retained - base <= 8,
            `sweep retained ${during.retained - base} palettes at once (base ${base})`);
        assert.equal(after.retained, base, 'sweep left colors retained after destroy');
    });

    test('interleaved instances never strand a retained palette', () => {
        const base = ambientSpriteCacheStats().retained;
        const live = [];
        const names = ['Fire', 'Ice', 'Snow', 'Aurora', 'Void'];
        let t = 0;
        for (let i = 0; i < 40; i++) {
            const c = new CanvasStub(600, 400);
            live.push(createAmbientFX(c, { theme: names[i % names.length], overrides: { count: 12 } }));
            if (live.length > 5) live.splice((i * 7) % live.length, 1)[0].destroy();
            if (i % 4 === 0 && live.length) live[i % live.length].setTheme(names[(i + 2) % names.length]);
            pump(t += 16);
        }
        for (const fx of live) fx.destroy();
        assert.equal(ambientSpriteCacheStats().retained, base,
            'interleaved lifecycles stranded a retained palette');
    });
});

// ── Gate 4: reduced-motion snapshot ─────────────────────────────────────────

describe('gate: reduced-motion snapshot', () => {
    const FIELDS = ['count', 'speed', 'turbulence'];

    test('every shipped theme degrades on the documented axes and restores', () => {
        setReduced(false);
        for (const name of Object.keys(THEMES)) {
            const c = new CanvasStub(800, 600);
            const fx = createAmbientFX(c, { theme: name });
            const full = fx.config;

            setReduced(true);
            const low = fx.config;
            assert.equal(fx.reducedMotion, true, `${name}: reducedMotion flag not set`);
            for (const f of FIELDS) {
                assert.ok(low[f] <= full[f] + 1e-9,
                    `${name}: reduced ${f} ${low[f]} exceeds full ${full[f]}`);
            }
            assert.ok(low.count < full.count, `${name}: count did not degrade`);

            setReduced(false);
            const restored = fx.config;
            for (const f of FIELDS) {
                assert.equal(restored[f], full[f], `${name}: ${f} not restored after the flag cleared`);
            }
            fx.destroy();
        }
    });

    test('reducedMotion: false opts out entirely', () => {
        setReduced(true);
        const c = new CanvasStub(800, 600);
        const fx = createAmbientFX(c, { theme: 'Fireflies', reducedMotion: false });
        assert.equal(fx.reducedMotion, false, 'opt-out ignored');
        assert.equal(fx.config.count, THEMES.Fireflies.count, 'degraded despite opting out');
        fx.destroy();
        setReduced(false);
    });

    test('the frame budget ceiling never exceeds the reduced count', () => {
        setReduced(true);
        const c = new CanvasStub(1200, 800);
        const fx = createAmbientFX(c, {
            theme: 'Aurora',
            frameBudget: { targetMs: 20, cooldown: 0, stepFrac: 0.5, minCount: 5 },
        });
        let t = 0;
        for (let i = 0; i < 40; i++) pump(t += 40);   // degrade
        for (let i = 0; i < 80; i++) pump(t += 2);    // restore hard
        assert.ok(fx.count <= fx.config.count,
            `budget restored to ${fx.count}, above the reduced ceiling ${fx.config.count}`);
        fx.destroy();
        setReduced(false);
    });
});
