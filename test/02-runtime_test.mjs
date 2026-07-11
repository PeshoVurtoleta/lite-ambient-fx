/**
 * Runtime surface: createAmbientFX lifecycle under a minimal DOM shim.
 * The shim mocks just enough -- canvas 2d context, document.createElement,
 * requestAnimationFrame, ResizeObserver -- to exercise mount, theme swap,
 * config update, pause/resume, and destroy.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// -- DOM shim ---------------------------------------------------
// Installed before importing AmbientFX.js so its `document` references bind
// to the shim, then removed after the suite.

const rafCallbacks = [];
let rafNext = 1;

function makeContext2D() {
    const state = { calls: [] };
    return {
        __state: state,
        setTransform(...a) { state.calls.push(['setTransform', ...a]); },
        clearRect(...a) { state.calls.push(['clearRect', ...a]); },
        drawImage(...a) { state.calls.push(['drawImage', a.length]); },
        createRadialGradient() {
            return { addColorStop() {} };
        },
        beginPath() {},
        arc() {},
        fill() {},
        set fillStyle(v) { state.lastFill = v; },
        get fillStyle() { return state.lastFill; },
        set globalAlpha(v) { state.lastAlpha = v; },
        get globalAlpha() { return state.lastAlpha; },
        set globalCompositeOperation(v) { state.lastComp = v; },
        get globalCompositeOperation() { return state.lastComp; },
    };
}

function makeCanvas(width = 800, height = 600) {
    let ctx = null;
    const c = {
        __isCanvas: true,
        width,
        height,
        clientWidth: width,
        clientHeight: height,
        parentElement: null,
        getContext(kind) {
            if (kind !== '2d') return null;
            if (!ctx) ctx = makeContext2D();
            return ctx;
        },
    };
    return c;
}

before(() => {
    globalThis.document = {
        hidden: false,
        _listeners: {},
        addEventListener(name, fn) {
            (this._listeners[name] ||= []).push(fn);
        },
        removeEventListener(name, fn) {
            const arr = this._listeners[name];
            if (!arr) return;
            const i = arr.indexOf(fn);
            if (i >= 0) arr.splice(i, 1);
        },
        createElement(tag) {
            if (tag === 'canvas') return makeCanvas(64, 64);
            return {};
        },
    };
    globalThis.window = { devicePixelRatio: 2 };
    globalThis.requestAnimationFrame = (fn) => {
        const id = rafNext++;
        rafCallbacks.push({ id, fn });
        return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
        const i = rafCallbacks.findIndex((c) => c.id === id);
        if (i >= 0) rafCallbacks.splice(i, 1);
    };
    // Absent by design -- the module has a `typeof ResizeObserver` guard.
    globalThis.ResizeObserver = undefined;
});

after(() => {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    delete globalThis.ResizeObserver;
});

function pumpFrame(timestamp) {
    const batch = rafCallbacks.splice(0, rafCallbacks.length);
    for (const { fn } of batch) fn(timestamp);
}

const { createAmbientFX, THEMES, clearAmbientSpriteCache } = await import('../AmbientFX.js');

describe('createAmbientFX -- argument validation', () => {
    test('throws on missing canvas', () => {
        assert.throws(() => createAmbientFX(null), TypeError);
    });

    test('throws on non-canvas object', () => {
        assert.throws(() => createAmbientFX({}), TypeError);
    });

    test('throws on unknown theme', () => {
        assert.throws(() => createAmbientFX(makeCanvas(), { theme: 'Nope' }), RangeError);
    });
});

describe('createAmbientFX -- lifecycle', () => {
    test('boots with a valid canvas', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        assert.equal(fx.theme, 'Fire');
        assert.equal(fx.count, THEMES.Fire.count);
        assert.equal(fx.running, true);
        fx.destroy();
    });

    test('honors autoStart:false', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Void', autoStart: false });
        assert.equal(fx.running, false);
        fx.resume();
        assert.equal(fx.running, true);
        fx.destroy();
    });

    test('config getter returns a defensive copy', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Ice' });
        const snap = fx.config;
        snap.count = 9999;
        snap.wind.x = -42;
        assert.equal(fx.config.count, THEMES.Ice.count);
        assert.equal(fx.config.wind.x, THEMES.Ice.wind.x);
        fx.destroy();
    });
});

describe('createAmbientFX -- theme swap', () => {
    test('setTheme swaps behavior and repopulates particles', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        assert.equal(fx.config.behavior, 'EMBER');
        fx.setTheme('Void');
        assert.equal(fx.config.behavior, 'CHAOS');
        assert.equal(fx.theme, 'Void');
        assert.equal(fx.count, THEMES.Void.count);
        fx.destroy();
    });

    test('setTheme on an unknown name throws and leaves the instance untouched', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Toxic' });
        assert.throws(() => fx.setTheme('Blorp'), RangeError);
        assert.equal(fx.theme, 'Toxic');
        fx.destroy();
    });
});

describe('createAmbientFX -- updateConfig', () => {
    test('changes count and rebuilds particle array', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Toxic' });
        fx.updateConfig({ count: 25 });
        assert.equal(fx.count, 25);
        fx.updateConfig({ count: 40 });
        assert.equal(fx.count, 40);
        fx.destroy();
    });

    test('shallow-merges wind partial', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Ice' });
        const originalY = fx.config.wind.y;
        fx.updateConfig({ wind: { x: 3 } });
        assert.equal(fx.config.wind.x, 3);
        assert.equal(fx.config.wind.y, originalY);
        fx.destroy();
    });

    test('rejects invalid alpha at update time', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        assert.throws(() => fx.updateConfig({ alpha: 5 }), RangeError);
        fx.destroy();
    });

    test('behavior switch via updateConfig re-inits', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        fx.updateConfig({ behavior: 'CHAOS' });
        assert.equal(fx.config.behavior, 'CHAOS');
        fx.destroy();
    });
});

describe('createAmbientFX -- pause / resume / destroy', () => {
    test('pause stops the raf chain, resume restarts it', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        pumpFrame(16);
        pumpFrame(32);
        fx.pause();
        assert.equal(fx.running, false);
        // Pending callback should have been cancelled.
        assert.equal(rafCallbacks.length, 0);
        fx.resume();
        assert.equal(fx.running, true);
        assert.ok(rafCallbacks.length >= 1);
        fx.destroy();
    });

    test('pause and resume are idempotent', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        fx.pause();
        fx.pause();
        assert.equal(fx.running, false);
        fx.resume();
        fx.resume();
        assert.equal(fx.running, true);
        fx.destroy();
    });

    test('destroy is idempotent and stops the loop', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Frost' });
        fx.destroy();
        fx.destroy();
        assert.equal(fx.running, false);
        assert.equal(rafCallbacks.length, 0);
    });

    test('setTheme is a no-op after destroy', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        fx.destroy();
        fx.setTheme('Void');
        assert.equal(fx.running, false);
    });
});

describe('createAmbientFX -- frame loop', () => {
    test('single frame runs without throwing across every mode', () => {
        for (const name of ['Fire', 'Night', 'Ice', 'Frost', 'Toxic', 'Void']) {
            clearAmbientSpriteCache();
            const fx = createAmbientFX(makeCanvas(), { theme: name });
            // First pump primes lastTime, second actually renders.
            pumpFrame(0);
            pumpFrame(16);
            pumpFrame(32);
            fx.destroy();
        }
    });

    test('dt clamping keeps the sim stable across huge gaps (tab-wake sim)', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        pumpFrame(0);
        // Simulate a 10-second tab freeze -- dt should clamp to 50ms internally.
        pumpFrame(10_000);
        pumpFrame(10_016);
        fx.destroy();
    });
});

describe('clearAmbientSpriteCache -- targeted eviction', () => {
    test('evicts only matching colors when a list is provided', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire' });
        // Cache is now populated from Fire's palette.
        clearAmbientSpriteCache(['#ff4500']);
        // Should still be usable -- a subsequent frame will re-prime.
        pumpFrame(0);
        pumpFrame(16);
        fx.destroy();
    });
});
