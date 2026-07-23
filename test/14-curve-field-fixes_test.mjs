// @zakkster/lite-ambient-fx -- v1.6.1 regression suite.
//
// Covers the defects fixed on top of the v1.6.0 curve feature, plus the
// still-unmerged FLOAT field-collapse fix that v1.6.0 shipped without:
//
//   * MIST curves sampled at millisecond life -> always clamped to the curve's
//     last control point. ShadowWisp (alphaCurve ending at 0) rendered nothing.
//   * sizeCurve reaching 0 (Stardust [0.5, 0.0]) truncated drawSize to 0 while
//     the particle was still alpha-visible, so ~59% popped out early.
//   * sampleCurve(curve, NaN) returned NaN instead of clamping.
//   * FLOAT/EMBER synchronized-death pulse + ToxicBubble/Stardust/Fireflies
//     decay tuned too high -> field drained to the bottom.
//
// Headless: a stub canvas records every drawImage(y, w). No --expose-gc.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const rafQueue = [];
let rafNext = 1;

class Ctx2D {
    constructor() { this.ys = []; this.ws = []; this.alphas = []; this._alpha = 1; }
    setTransform() {} clearRect() {} fillRect() {} beginPath() {} arc() {} fill() {}
    createRadialGradient() { return { addColorStop() {} }; }
    drawImage(_s, _x, y, w) { this.ys.push(y); this.ws.push(w); this.alphas.push(this._alpha); }
    set globalAlpha(v) { this._alpha = v; } get globalAlpha() { return this._alpha; }
    set fillStyle(v) { this._f = v; } get fillStyle() { return this._f; }
    set globalCompositeOperation(v) { this._g = v; } get globalCompositeOperation() { return this._g; }
}
class CanvasStub {
    constructor(w, h) { this.width = w; this.height = h; this.clientWidth = w; this.clientHeight = h; this.parentElement = null; this._c = null; }
    getContext(k) { if (k !== '2d') return null; if (!this._c) this._c = new Ctx2D(); return this._c; }
    getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; }
}
function target() {
    return { _l: new Map(),
        addEventListener(t, f) { if (typeof f !== 'function') return; let s = this._l.get(t); if (!s) { s = new Set(); this._l.set(t, s); } s.add(f); },
        removeEventListener(t, f) { const s = this._l.get(t); if (s) s.delete(f); } };
}
globalThis.document = Object.assign(target(), { hidden: false, createElement: (t) => (t === 'canvas' ? new CanvasStub(64, 64) : target()) });
globalThis.window = Object.assign(target(), { devicePixelRatio: 1, matchMedia: (q) => ({ media: q, matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.requestAnimationFrame = (fn) => { const id = rafNext++; rafQueue.push({ id, fn }); return id; };
globalThis.cancelAnimationFrame = (id) => { const i = rafQueue.findIndex((c) => c.id === id); if (i >= 0) rafQueue.splice(i, 1); };
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
function pump(ts) { const b = rafQueue.splice(0, rafQueue.length); for (const c of b) c.fn(ts); }

const { createAmbientFX, THEMES, sampleCurve } = await import('../AmbientFX.js');

// ── sampleCurve robustness ──────────────────────────────────────────────────

describe('sampleCurve is NaN-safe and clamps', () => {
    test('non-finite t clamps to the start, not NaN', () => {
        assert.equal(sampleCurve([3, 9], NaN), 3);
        assert.equal(sampleCurve([3, 9], undefined), 3);
    });
    test('out-of-range t clamps to endpoints', () => {
        assert.equal(sampleCurve([3, 9], -5), 3);
        assert.equal(sampleCurve([3, 9], 99), 9);
    });
    test('interior math is unchanged', () => {
        assert.equal(sampleCurve([0, 1], 0.5), 0.5);
        assert.equal(sampleCurve([0, 1, 0], 0.5), 1);
        assert.ok(Math.abs(sampleCurve([2, 7.5], 1) - 7.5) < 1e-9);
    });
});

// ── MIST curves must use normalized life ─────────────────────────────────────

describe('MIST curves sample normalized life', () => {
    test('ShadowWisp (alphaCurve ending at 0) is visible', () => {
        const c = new CanvasStub(1200, 800);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'ShadowWisp', overrides: { count: 120 } });
        let t = 0;
        let total = 0;
        for (let i = 0; i < 600; i++) { ctx.ys.length = 0; pump(t += 16); total += ctx.ys.length; }
        fx.destroy();
        assert.ok(total > 0,
            'ShadowWisp rendered nothing -- MIST life (ms) sampled a [0,1] curve and clamped to its 0 endpoint');
    });

    test('a MIST alphaCurve actually modulates alpha across the field', () => {
        // With a curve that peaks mid-life, a staggered field shows a spread of
        // alpha values rather than one clamped level. MIST alphas are small
        // (base 0.05 + breath), so compare the observed range, not coarse buckets.
        const c = new CanvasStub(1200, 800);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'Aurora', overrides: { count: 200, alphaCurve: [0, 1, 0] } });
        let t = 0;
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < 400; i++) {
            ctx.alphas.length = 0;
            pump(t += 16);
            for (let j = 0; j < ctx.alphas.length; j++) {
                if (ctx.alphas[j] < lo) lo = ctx.alphas[j];
                if (ctx.alphas[j] > hi) hi = ctx.alphas[j];
            }
        }
        fx.destroy();
        assert.ok(hi - lo > 0.01,
            `MIST alphaCurve produced a near-constant alpha (range ${(hi - lo).toFixed(4)}) -- life not normalized before sampling`);
    });
});

// ── sizeCurve reaching zero must not blit a 0-width sprite ───────────────────

describe('sub-pixel drawSize is skipped, not blitted at width 0', () => {
    test('Stardust (sizeCurve [0.5, 0.0]) emits no 0-width blits', () => {
        const c = new CanvasStub(1200, 800);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'Stardust', overrides: { count: 300 } });
        let t = 0;
        let zeroW = 0;
        for (let i = 0; i < 300; i++) { pump(t += 16); }
        for (let i = 0; i < ctx.ws.length; i++) if ((ctx.ws[i] | 0) === 0) zeroW++;
        fx.destroy();
        assert.equal(zeroW, 0, `${zeroW} blits had width 0 -- a shrinking curve popped particles out early`);
    });

    test('a user sizeCurve ending at 0 on any behavior is safe', () => {
        for (const theme of ['Fire', 'Void', 'Snow']) {
            const c = new CanvasStub(1000, 700);
            const ctx = c.getContext('2d');
            const fx = createAmbientFX(c, { theme, overrides: { count: 100, sizeCurve: [1, 0] } });
            let t = 0;
            for (let i = 0; i < 200; i++) { pump(t += 16); }
            let zeroW = 0;
            for (let i = 0; i < ctx.ws.length; i++) if ((ctx.ws[i] | 0) === 0) zeroW++;
            fx.destroy();
            assert.equal(zeroW, 0, `${theme}: ${zeroW} zero-width blits with sizeCurve [1,0]`);
        }
    });
});

// ── curves still do their job ────────────────────────────────────────────────

describe('curves remain functional after the fixes', () => {
    test('ShadowWisp sizeCurve still expands particles', () => {
        const c = new CanvasStub(1200, 800);
        const ctx = c.getContext('2d');
        const fx = createAmbientFX(c, { theme: 'ShadowWisp', overrides: { count: 120 } });
        let t = 0;
        let maxW = 0;
        for (let i = 0; i < 600; i++) { pump(t += 16); }
        for (let i = 0; i < ctx.ws.length; i++) if ((ctx.ws[i] | 0) > maxW) maxW = ctx.ws[i] | 0;
        fx.destroy();
        assert.ok(maxW > 100, `ShadowWisp max draw size ${maxW}px -- sizeCurve [2, 7.5] on size 90 should exceed 100px`);
    });
});

// ── FLOAT field must not collapse (the fix v1.6.0 shipped without) ──────────

describe('FLOAT fields stay on screen and do not pulse', () => {
    const H = 900;
    const STEP = 8.4;
    const SECONDS = 14;

    function sampleField(theme, overrides) {
        const canvas = new CanvasStub(1600, H);
        const ctx = canvas.getContext('2d');
        const fx = createAmbientFX(canvas, { theme });
        if (overrides) fx.updateConfig(overrides);
        let t = 0;
        const centroids = [];
        let maxJump = 0;
        let prev = null;
        for (let f = 0; f < 119 * SECONDS; f++) {
            ctx.ys.length = 0; ctx.ws.length = 0;
            pump(t += STEP);
            if (f % 119 === 0) {
                let sum = 0;
                let n = 0;
                for (let i = 0; i < ctx.ys.length; i++) if ((ctx.ws[i] | 0) > 0) { sum += ctx.ys[i]; n++; }
                if (n > 0) {
                    const cy = sum / n / H;
                    centroids.push(cy);
                    if (prev !== null) maxJump = Math.max(maxJump, Math.abs(cy - prev));
                    prev = cy;
                }
            }
        }
        fx.destroy();
        const mean = centroids.reduce((a, b) => a + b, 0) / centroids.length;
        return { mean, maxJump };
    }

    function sampleAvg(theme, overrides, runs = 3) {
        let mean = 0;
        let maxJump = 0;
        for (let i = 0; i < runs; i++) { const r = sampleField(theme, overrides); mean += r.mean; maxJump += r.maxJump; }
        return { mean: mean / runs, maxJump: maxJump / runs };
    }

    const MAX_MEAN = 0.82;
    const MAX_JUMP = 0.32;

    for (const name of Object.keys(THEMES).filter((k) => THEMES[k].behavior === 'FLOAT')) {
        test(`${name} holds a full field`, () => {
            const { mean, maxJump } = sampleAvg(name, null);
            assert.ok(mean < MAX_MEAN, `${name} collapsed: mean ${mean.toFixed(2)}`);
            assert.ok(maxJump < MAX_JUMP, `${name} pulsed: jump ${maxJump.toFixed(2)}`);
        });
    }

    test('reported scenario: ToxicBubble, count 500, speed 2.0', () => {
        const { mean, maxJump } = sampleAvg('ToxicBubble', { count: 500, speed: 2.0 });
        assert.ok(mean < MAX_MEAN, `collapsed: mean ${mean.toFixed(2)}`);
        assert.ok(maxJump < MAX_JUMP, `pulsed: jump ${maxJump.toFixed(2)}`);
    });
});

// ── the retuned decays are guarded ──────────────────────────────────────────

describe('retuned FLOAT presets keep a screen-crossing decay', () => {
    for (const [name, max] of [['ToxicBubble', 0.0012], ['Stardust', 0.0012], ['Fireflies', 0.0008]]) {
        test(`${name}.decay <= ${max}`, () => {
            assert.ok(THEMES[name].decay <= max, `${name}.decay is ${THEMES[name].decay}`);
        });
    }
});
