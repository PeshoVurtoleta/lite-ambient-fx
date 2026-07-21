// test/11-torture_test.mjs
//
// Adversarial regression suite. Every case here reproduced a real defect on
// v1.4.0; each asserts the specific failure mode, not just "it works".
//
// Runs without --expose-gc. The zero-alloc gates use lite-gc-profiler's
// per-op lane (measureOps/checkOps); the lifecycle gate uses lite-leak.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { measureOps, checkOps } from '@zakkster/lite-gc-profiler';
import {
    createLeakTracker,
    createTimerOrphanKernel,
    createListenerOrphanKernel,
    createObserverOrphanKernel,
} from '@zakkster/lite-leak';

// ── DOM shim ────────────────────────────────────────────────────────────────
// Records the identity and live dimensions of every blit source. A canvas
// whose width or height is 0 makes drawImage() throw InvalidStateError per
// the HTML spec, so a "bad blit" here is a thrown frame in a real browser.

const rafQueue = [];
let rafNext = 1;
const rafPending = new Set();
const observers = new Set();
let serial = 0;

class Ctx2D {
    constructor() { this.draws = []; this.badBlits = 0; this._alpha = 1; }
    setTransform() {} clearRect() {} fillRect() {} beginPath() {} arc() {} fill() {}
    createRadialGradient() { return { addColorStop() {} }; }
    drawImage(src, x, y, w, h) {
        if (!src || src.width === 0 || src.height === 0) this.badBlits++;
        this.draws.push({ x, y, w, h, alpha: this._alpha });
    }
    set globalAlpha(v) { this._alpha = v; }
    get globalAlpha() { return this._alpha; }
    set fillStyle(v) { this._f = v; } get fillStyle() { return this._f; }
    set globalCompositeOperation(v) { this._g = v; } get globalCompositeOperation() { return this._g; }
}

class CanvasStub {
    constructor(w = 800, h = 600) {
        this.__id = ++serial;
        this.width = w; this.height = h;
        this.clientWidth = w; this.clientHeight = h;
        this.parentElement = null; this._ctx = null;
    }
    getContext(k) { if (k !== '2d') return null; if (!this._ctx) this._ctx = new Ctx2D(); return this._ctx; }
    getBoundingClientRect() {
        return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight,
            width: this.clientWidth, height: this.clientHeight };
    }
}

class Target {
    constructor() { this._l = new Map(); }
    addEventListener(t, f) {
        if (typeof f !== 'function') return;
        let s = this._l.get(t); if (!s) { s = new Set(); this._l.set(t, s); }
        s.add(f);
    }
    removeEventListener(t, f) { const s = this._l.get(t); if (s) s.delete(f); }
    dispatch(t, ev) { const s = this._l.get(t); if (s) for (const f of [...s]) f(ev); }
    count() { let n = 0; for (const s of this._l.values()) n += s.size; return n; }
}

const doc = new Target();
doc.hidden = false;
doc.createElement = (tag) => (tag === 'canvas' ? new CanvasStub(64, 64) : new Target());
globalThis.document = doc;

const win = new Target();
win.devicePixelRatio = 2;
win.matchMedia = (q) => { const l = new Target(); l.media = q; l.matches = false; return l; };
globalThis.window = win;

globalThis.requestAnimationFrame = (fn) => {
    const id = rafNext++; rafQueue.push({ id, fn }); rafPending.add(id); return id;
};
globalThis.cancelAnimationFrame = (id) => {
    const i = rafQueue.findIndex((c) => c.id === id);
    if (i >= 0) rafQueue.splice(i, 1);
    rafPending.delete(id);
};
globalThis.ResizeObserver = class {
    constructor(cb) { this._cb = cb; observers.add(this); }
    observe(el) { this._el = el; }
    unobserve() {}
    disconnect() { observers.delete(this); }
    fire() { this._cb([{ target: this._el }], this); }
};

function pump(ts) {
    const batch = rafQueue.splice(0, rafQueue.length);
    for (const c of batch) { rafPending.delete(c.id); c.fn(ts); }
}
function makeCanvas(w, h) { return new CanvasStub(w, h); }

const {
    createAmbientFX, THEMES, BEHAVIORS, parseColor, clearAmbientSpriteCache,
} = await import('../AmbientFX.js');


// ── 1. Shared sprite cache must survive a sibling's lifecycle ───────────────

describe('sprite cache ownership (multi-instance)', () => {
    test('destroy() does not zero sprites a live sibling is still blitting', () => {
        clearAmbientSpriteCache();
        const cA = makeCanvas(800, 600);
        const cB = makeCanvas(800, 600);
        const a = createAmbientFX(cA, { theme: 'Fire', overrides: { count: 40 } });
        const b = createAmbientFX(cB, { theme: 'Fire', overrides: { count: 40 } });

        let t = 0;
        for (let i = 0; i < 30; i++) pump(t += 16);

        const ctxB = cB.getContext('2d');
        a.destroy();
        ctxB.badBlits = 0;
        ctxB.draws.length = 0;
        for (let i = 0; i < 30; i++) pump(t += 16);

        assert.ok(ctxB.draws.length > 0, 'sibling still rendering');
        assert.equal(ctxB.badBlits, 0,
            `${ctxB.badBlits}/${ctxB.draws.length} blits hit a 0x0 canvas after the sibling was destroyed`);
        b.destroy();
    });

    test('setTheme() on one instance does not zero another instance sprites', () => {
        clearAmbientSpriteCache();
        const cC = makeCanvas(800, 600);
        const cD = makeCanvas(800, 600);
        const c = createAmbientFX(cC, { theme: 'Ice', overrides: { count: 40 } });
        const d = createAmbientFX(cD, { theme: 'Ice', overrides: { count: 40 } });

        let t = 0;
        for (let i = 0; i < 30; i++) pump(t += 16);

        const ctxD = cD.getContext('2d');
        c.setTheme('Fire');
        ctxD.badBlits = 0;
        ctxD.draws.length = 0;
        for (let i = 0; i < 30; i++) pump(t += 16);

        assert.ok(ctxD.draws.length > 0);
        assert.equal(ctxD.badBlits, 0, 'untouched instance blitted a zeroed sprite');
        c.destroy(); d.destroy();
    });

    test('the public cache wipe leaves live holders renderable', () => {
        clearAmbientSpriteCache();
        const cE = makeCanvas(800, 600);
        const e = createAmbientFX(cE, { theme: 'Aurora', overrides: { count: 30 } });
        let t = 0;
        for (let i = 0; i < 20; i++) pump(t += 16);

        const ctxE = cE.getContext('2d');
        clearAmbientSpriteCache();          // documented manual reclaim
        ctxE.badBlits = 0;
        ctxE.draws.length = 0;
        for (let i = 0; i < 20; i++) pump(t += 16);

        assert.equal(ctxE.badBlits, 0, 'wipe zeroed a canvas that live particles still hold');
        e.destroy();
    });

    test('the last release still frees the backing store', () => {
        clearAmbientSpriteCache();
        const cF = makeCanvas(400, 300);
        const f = createAmbientFX(cF, { theme: 'Toxic', overrides: { count: 10 } });
        let t = 0;
        for (let i = 0; i < 5; i++) pump(t += 16);
        const sprite = cF.getContext('2d').draws.length > 0;
        assert.ok(sprite, 'rendered at least once');
        f.destroy();
        // Nothing holds the palette now; a fresh mount must re-rasterize
        // rather than hand back a zeroed canvas.
        const cG = makeCanvas(400, 300);
        const g = createAmbientFX(cG, { theme: 'Toxic', overrides: { count: 10 } });
        const ctxG = cG.getContext('2d');
        for (let i = 0; i < 10; i++) pump(t += 16);
        assert.ok(ctxG.draws.length > 0);
        assert.equal(ctxG.badBlits, 0, 'remount got a freed canvas back');
        g.destroy();
    });
});


// ── 2. Pointer input hardening ──────────────────────────────────────────────

describe('pointer input hardening', () => {
    test('a pointermove with no clientX does not poison the field', () => {
        clearAmbientSpriteCache();
        const c = makeCanvas(800, 600);
        const fx = createAmbientFX(c, {
            theme: 'Fire', overrides: { count: 60 }, pointer: { mode: 'repel' },
        });
        const ctx = c.getContext('2d');
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);

        // A bare `new Event('pointermove')` has no clientX at all.
        win.dispatch('pointermove', { pointerType: 'mouse' });
        win.dispatch('pointermove', { clientX: NaN, clientY: 0, pointerType: 'mouse' });
        for (let i = 0; i < 5; i++) pump(t += 16);

        ctx.draws.length = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);
        const atOrigin = ctx.draws.filter((d) => d.x === 0 && d.y === 0).length;
        assert.ok(ctx.draws.length > 0);
        assert.ok(atOrigin < ctx.draws.length * 0.5,
            `${atOrigin}/${ctx.draws.length} particles collapsed onto the origin (NaN positions)`);
        fx.destroy();
    });

    test('a valid pointermove still displaces particles', () => {
        clearAmbientSpriteCache();
        const c = makeCanvas(800, 600);
        const fx = createAmbientFX(c, {
            theme: 'Fire', overrides: { count: 60 },
            pointer: { mode: 'repel', radius: 400, strength: 40 },
        });
        let t = 0;
        for (let i = 0; i < 10; i++) pump(t += 16);
        const ctx = c.getContext('2d');
        ctx.draws.length = 0;
        pump(t += 16);
        const before = ctx.draws.map((d) => d.x);

        win.dispatch('pointermove', { clientX: 400, clientY: 300, pointerType: 'mouse' });
        ctx.draws.length = 0;
        pump(t += 16);
        const after = ctx.draws.map((d) => d.x);

        let moved = 0;
        for (let i = 0; i < Math.min(before.length, after.length); i++) {
            if (before[i] !== after[i]) moved++;
        }
        assert.ok(moved > 0, 'repel had no effect -- the guard is too aggressive');
        fx.destroy();
    });
});


// ── 3. Particle identity across the frame-budget growth path ────────────────

describe('frame-budget pool growth', () => {
    test('restored particles carry a numeric id', () => {
        clearAmbientSpriteCache();
        const c = makeCanvas(800, 600);
        const fx = createAmbientFX(c, {
            theme: 'Void', overrides: { count: 200 },
            frameBudget: { targetMs: 20, restoreMs: 10, cooldown: 0, stepFrac: 0.5, minCount: 10 },
        });
        let t = 0;
        for (let i = 0; i < 40; i++) pump(t += 40);   // slow -> degrade
        for (let i = 0; i < 40; i++) pump(t += 4);    // fast -> restore (grows)

        // CHAOS flickers on (phase + id) & 1. An undefined id makes that
        // NaN & 1 === 0, so the particle is permanently dimmed. Sample the
        // alpha histogram: both flicker states must be present.
        // With correct ids, `(phase + id) & 1` splits the field ~50/50 between
        // the bright and dim flicker states every frame. An id of undefined
        // pins that particle to the dim state forever, so any drift of the dim
        // share above ~half means id-less particles entered the pool.
        const ctx = c.getContext('2d');
        ctx.draws.length = 0;
        for (let i = 0; i < 8; i++) pump(t += 16);
        assert.ok(ctx.draws.length > 0, 'nothing rendered after the restore');
        const alphas = ctx.draws.map((d) => d.alpha);
        const brightest = Math.max(...alphas);
        const dim = alphas.filter((a) => a < brightest * 0.9).length;
        const dimShare = dim / alphas.length;
        assert.ok(dimShare < 0.62,
            `${(dimShare * 100).toFixed(0)}% of particles stuck in the dim flicker state ` +
            '-- ids are undefined on the frame-budget growth path');
        fx.destroy();
    });
});


// ── 4. Frame-rate independence ──────────────────────────────────────────────

describe('frame-rate independence', () => {
    function runFloat(dt, frames) {
        const cfg = { ...THEMES.Aurora, wind: { ...THEMES.Aurora.wind }, turbulence: 0 };
        const sprite = { width: 32, height: 32 };
        const frame = {
            cfg, W: 800, H: 600, dt, ds: dt / 16, timestamp: 0, isInit: true,
            getSprite: () => sprite,
            respawn(p, isInit) { frame.isInit = isInit; BEHAVIORS.FLOAT.spawn(p, frame); },
        };
        const ps = [];
        for (let i = 0; i < 50; i++) {
            const p = {
                id: i, color: '', spriteCanvas: null, z: 0, life: 0, x: 0, y: 0, size: 0,
                vx: 0, vy: 0, decay: 0, maxAlpha: 0, anchorX: 0, anchorY: 0, pulseOffset: 0,
                terminal: 0, driftPhase: 0, driftSpeed: 0, driftAmp: 0,
            };
            BEHAVIORS.FLOAT.spawn(p, frame);
            p.x = 400; p.y = 300; p.life = 0.5; p.vy = 1; p.z = 1; p.decay = 0;
            ps.push(p);
        }
        frame.isInit = false;
        const ctx = { globalAlpha: 1, drawImage() {} };
        for (let i = 0; i < frames; i++) BEHAVIORS.FLOAT.tick(ps, ctx, frame);
        let sum = 0;
        for (const p of ps) sum += Math.abs(p.x - 400);
        return sum / ps.length;
    }

    test('FLOAT sway covers the same distance at 60fps and 120fps', () => {
        const at60 = runFloat(16, 120);
        const at120 = runFloat(8, 240);
        const ratio = at120 / (at60 || 1e-9);
        assert.ok(ratio > 0.8 && ratio < 1.25,
            `sway ratio ${ratio.toFixed(2)} over equal wall time (60fps=${at60.toFixed(2)}px, 120fps=${at120.toFixed(2)}px)`);
    });
});


// ── 5. Degenerate but validateConfig-legal configs ──────────────────────────

describe('degenerate configs render instead of spinning', () => {
    for (const theme of ['Fire', 'Aurora', 'Snow']) {
        test(`${theme} with decay: 0 still renders`, () => {
            clearAmbientSpriteCache();
            const c = makeCanvas(800, 600);
            const fx = createAmbientFX(c, { theme, overrides: { count: 50, decay: 0 } });
            const ctx = c.getContext('2d');
            let t = 0;
            for (let i = 0; i < 60; i++) pump(t += 16);
            assert.ok(ctx.draws.length > 0,
                'decay: 0 validates but rendered nothing across 60 frames');
            assert.equal(ctx.badBlits, 0);
            fx.destroy();
        });
    }

    test('FALL fade-in duration does not scale with decay', () => {
        // Snow (decay 0.0006) and Meteor (decay 0.007) differ by ~12x. Their
        // time to first paint must not.
        const firstPaint = {};
        for (const theme of ['Snow', 'Meteor']) {
            clearAmbientSpriteCache();
            const c = makeCanvas(800, 600);
            const fx = createAmbientFX(c, { theme, overrides: { count: 100 } });
            const ctx = c.getContext('2d');
            let t = 0;
            firstPaint[theme] = -1;
            for (let i = 1; i <= 400; i++) {
                ctx.draws.length = 0;
                pump(t += 16);
                if (ctx.draws.length >= 90) { firstPaint[theme] = i; break; }
            }
            fx.destroy();
        }
        assert.ok(firstPaint.Snow > 0 && firstPaint.Meteor > 0, 'both themes painted');
        assert.ok(Math.abs(firstPaint.Snow - firstPaint.Meteor) <= 4,
            `time to full field differs: Snow f${firstPaint.Snow} vs Meteor f${firstPaint.Meteor}`);
    });
});


// ── 6. parseColor input validation ──────────────────────────────────────────

describe('parseColor rejects malformed hex', () => {
    for (const bad of ['#12zzzz', '#ff00gg', '#0x1234', '#1e+5ab', '#  1234', '#12 34 5']) {
        test(`rejects ${JSON.stringify(bad)}`, () => {
            assert.throws(() => parseColor(bad), SyntaxError);
        });
    }
    test('still accepts every built-in palette entry', () => {
        for (const name of Object.keys(THEMES)) {
            const t = THEMES[name];
            for (const col of t.colors) assert.doesNotThrow(() => parseColor(col), name + ' ' + col);
            assert.doesNotThrow(() => parseColor(t.spark), name + ' spark');
        }
    });
    test('still accepts shorthand and oklch()', () => {
        assert.doesNotThrow(() => parseColor('#f0a'));
        assert.doesNotThrow(() => parseColor('oklch(0.7 0.15 30)'));
        assert.doesNotThrow(() => parseColor('oklch(70% 0.15 30)'));
    });
});


// ── 7. Teardown completeness ────────────────────────────────────────────────

describe('teardown', () => {
    test('destroy() cancels a debounced resize still in flight', () => {
        clearAmbientSpriteCache();
        const before = rafPending.size;
        const c = makeCanvas(800, 600);
        const fx = createAmbientFX(c, { theme: 'Fire', overrides: { count: 10 } });
        const ro = [...observers][observers.size - 1];
        ro.fire();                                   // schedules the debounce
        fx.destroy();
        assert.equal(rafPending.size, before,
            'a rAF survived destroy(); on a hidden tab it never fires and pins the instance');
    });

    test('100 mount/destroy cycles leave no orphaned DOM state', () => {
        const findings = [];
        const tracker = createLeakTracker({
            name: 'ambient-fx-torture',
            onFinding: (f) => findings.push(f),
            onWarning: () => {},
        });
        const off = [
            tracker.registerKernel(createTimerOrphanKernel({ warnOnNoOwner: false })),
            tracker.registerKernel(createListenerOrphanKernel({ warnOnNoOwner: false })),
            tracker.registerKernel(createObserverOrphanKernel({ warnOnNoOwner: false })),
        ];

        const base = { win: win.count(), doc: doc.count(), obs: observers.size };
        let t = 0;
        for (let i = 0; i < 100; i++) {
            const c = makeCanvas(800, 600);
            const fx = createAmbientFX(c, {
                theme: i % 2 ? 'Snow' : 'Fire',
                overrides: { count: 20 },
                pointer: { mode: i % 3 ? 'repel' : 'off' },
            });
            pump(t += 16);
            pump(t += 16);
            if (i % 5 === 0) fx.setTheme('Aurora');
            if (i % 7 === 0) fx.updateConfig({ count: 25 });
            fx.destroy();
        }
        pump(t += 16);

        assert.equal(win.count(), base.win, 'window listeners leaked');
        assert.equal(doc.count(), base.doc, 'document listeners leaked');
        assert.equal(observers.size, base.obs, 'ResizeObservers leaked');
        assert.deepEqual(tracker.audit(), [], 'lite-leak reported orphans');
        for (const d of off) d();
    });

    test('interleaved lifecycles never produce a bad blit', () => {
        clearAmbientSpriteCache();
        const live = [];
        const themes = ['Fire', 'Ice', 'Snow', 'Aurora', 'Void'];
        let t = 0;
        for (let i = 0; i < 60; i++) {
            const c = makeCanvas(600, 400);
            live.push({
                c,
                fx: createAmbientFX(c, { theme: themes[i % themes.length], overrides: { count: 15 } }),
            });
            if (live.length > 6) {
                const victim = live.splice((i * 7) % live.length, 1)[0];
                victim.fx.destroy();
            }
            if (i % 4 === 0 && live.length) {
                live[i % live.length].fx.setTheme(themes[(i + 2) % themes.length]);
            }
            pump(t += 16);
            pump(t += 16);
        }
        let bad = 0, total = 0;
        for (const e of live) {
            const ctx = e.c.getContext('2d');
            bad += ctx.badBlits;
            total += ctx.draws.length;
        }
        assert.ok(total > 0, 'nothing rendered');
        assert.equal(bad, 0, `${bad}/${total} blits used a zeroed sprite under interleaved lifecycles`);
        for (const e of live) e.fx.destroy();
    });
});


// ── 8. Zero-alloc gates on the paths the fixes touched ──────────────────────

describe('zero-alloc gates (lite-gc-profiler)', () => {
    function makeFrame(cfg, W, H) {
        const sprite = { width: 32, height: 32 };
        const frame = {
            cfg, W, H, dt: 16, ds: 1, timestamp: 0, isInit: false,
            getSprite: () => sprite,
            respawn(p, isInit) { frame.isInit = isInit; BEHAVIORS[cfg.behavior].spawn(p, frame); },
        };
        return frame;
    }
    const ctx = {
        globalAlpha: 1, clearRect() {}, drawImage() {},
        createRadialGradient() { return { addColorStop() {} }; },
    };

    for (const name of ['EMBER', 'MIST', 'FLOAT', 'CHAOS', 'FALL']) {
        test(`${name}.tick allocates nothing per frame after the fixes`, () => {
            const theme = Object.keys(THEMES).find((k) => THEMES[k].behavior === name);
            const cfg = { ...THEMES[theme], wind: { ...THEMES[theme].wind } };
            const frame = makeFrame(cfg, 1280, 720);
            const behavior = BEHAVIORS[name];
            const ps = [];
            frame.isInit = true;
            for (let i = 0; i < 500; i++) {
                const p = {
                    id: i, color: '', spriteCanvas: null, z: 0, life: 0, x: 0, y: 0, size: 0,
                    vx: 0, vy: 0, decay: 0, maxAlpha: 0, anchorX: 0, anchorY: 0, pulseOffset: 0,
                    terminal: 0, driftPhase: 0, driftSpeed: 0, driftAmp: 0,
                };
                behavior.spawn(p, frame);
                ps.push(p);
            }
            frame.isInit = false;

            const result = measureOps(() => { behavior.tick(ps, ctx, frame); }, {
                ops: 3000, warmup: 600, source: 'gc',
            });
            const gate = checkOps(result, { maxMajorsPerKOp: 0 });
            assert.notEqual(gate.verdict, 'fail',
                `${name}.tick: ${JSON.stringify(gate.violations)}`);
        });
    }

    test('parseColor validation adds no allocation', () => {
        const palette = THEMES.Fire.colors.concat(THEMES.Ice.colors, THEMES.Snow.colors);
        const out = new Float64Array(3);
        const result = measureOps((i) => { parseColor(palette[i % palette.length], out); }, {
            ops: 20000, warmup: 4000, source: 'gc',
        });
        const gate = checkOps(result, { maxMajorsPerKOp: 0 });
        assert.notEqual(gate.verdict, 'fail', JSON.stringify(gate.violations));
    });
});
