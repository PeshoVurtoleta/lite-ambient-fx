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

// -- matchMedia shim (v1.1.0 reduced-motion) --------------------
// `mediaState.reduce` drives the query; `fireReduceChange()` simulates the user
// flipping the OS setting mid-session so we can assert live re-derivation.
const mediaState = { reduce: false, lists: [] };
function makeMatchMedia(query) {
    const list = {
        media: query,
        get matches() { return query.includes('reduce') ? mediaState.reduce : false; },
        _listeners: [],
        addEventListener(name, fn) { if (name === 'change') this._listeners.push(fn); },
        removeEventListener(name, fn) {
            const i = this._listeners.indexOf(fn);
            if (i >= 0) this._listeners.splice(i, 1);
        },
    };
    mediaState.lists.push(list);
    return list;
}
function fireReduceChange(value) {
    mediaState.reduce = value;
    for (const l of mediaState.lists) {
        for (const fn of l._listeners.slice()) fn({ matches: value });
    }
}
function totalReduceListeners() {
    return mediaState.lists.reduce((n, l) => n + l._listeners.length, 0);
}

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
        // The pointer pass caches this at resize rather than reading it per move.
        getBoundingClientRect() {
            return { left: 0, top: 0, width, height, right: width, bottom: height };
        },
    };
    return c;
}

// Dispatch a synthetic pointer event to whatever the instance bound on window.
function firePointer(type, clientX, clientY, pointerType = 'mouse') {
    const arr = globalThis.window._listeners[type];
    if (!arr) return;
    for (const fn of arr.slice()) fn({ clientX, clientY, pointerType });
}
function windowListenerCount() {
    let n = 0;
    for (const k of Object.keys(globalThis.window._listeners)) {
        n += globalThis.window._listeners[k].length;
    }
    return n;
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
    globalThis.window = {
        devicePixelRatio: 2,
        matchMedia: makeMatchMedia,
        _listeners: {},
        addEventListener(name, fn) { (this._listeners[name] ||= []).push(fn); },
        removeEventListener(name, fn) {
            const arr = this._listeners[name];
            if (!arr) return;
            const i = arr.indexOf(fn);
            if (i >= 0) arr.splice(i, 1);
        },
    };
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

const { createAmbientFX, THEMES, BEHAVIORS, clearAmbientSpriteCache, sampleDepth } = await import('../AmbientFX.js');

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

// ============================================================
//  v1.1.0 -- prefers-reduced-motion
// ============================================================

describe('prefers-reduced-motion', () => {
    test('no degrade when the query does not match', () => {
        mediaState.reduce = false;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        assert.equal(fx.reducedMotion, false);
        assert.equal(fx.config.count, THEMES.Fire.count);
        assert.equal(fx.config.speed, THEMES.Fire.speed);
        fx.destroy();
    });

    test('degrades count, speed and turbulence when the query matches', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        assert.equal(fx.reducedMotion, true);
        assert.ok(fx.config.count <= 40 && fx.config.count >= 8, 'count clamped: ' + fx.config.count);
        assert.ok(fx.config.speed < THEMES.Fire.speed);
        assert.ok(fx.config.turbulence < THEMES.Fire.turbulence);
        assert.equal(fx.count, fx.config.count, 'pool sized from the degraded count');
        fx.destroy();
        mediaState.reduce = false;
    });

    test('preserves the palette so the theme stays recognizable', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Aurora', autoStart: false });
        assert.deepEqual(fx.config.colors, THEMES.Aurora.colors);
        assert.equal(fx.config.spark, THEMES.Aurora.spark);
        assert.equal(fx.config.behavior, THEMES.Aurora.behavior);
        fx.destroy();
        mediaState.reduce = false;
    });

    test('baseConfig always reports the undegraded request', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        assert.equal(fx.baseConfig.count, THEMES.Fire.count);
        assert.notEqual(fx.config.count, fx.baseConfig.count);
        fx.destroy();
        mediaState.reduce = false;
    });

    test('reducedMotion: false opts out entirely', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false, reducedMotion: false });
        assert.equal(fx.reducedMotion, false);
        assert.equal(fx.config.count, THEMES.Fire.count);
        fx.destroy();
        mediaState.reduce = false;
    });

    test('degrade survives setTheme', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        fx.setTheme('Abyss');
        assert.equal(fx.theme, 'Abyss');
        assert.ok(fx.config.count <= 40, 'still degraded after setTheme: ' + fx.config.count);
        assert.ok(fx.config.speed < THEMES.Abyss.speed);
        fx.destroy();
        mediaState.reduce = false;
    });

    test('degrade survives updateConfig -- the user preference outranks the count knob', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        fx.updateConfig({ count: 500 });
        assert.equal(fx.baseConfig.count, 500, 'the request is remembered');
        assert.ok(fx.config.count <= 40, 'but the render config stays degraded');
        fx.destroy();
        mediaState.reduce = false;
    });

    test('restores full motion live when the OS setting is flipped off', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        assert.ok(fx.config.count <= 40);

        fireReduceChange(false);
        assert.equal(fx.reducedMotion, false);
        assert.equal(fx.config.count, THEMES.Fire.count, 'restored without a reload');
        assert.equal(fx.count, THEMES.Fire.count, 'pool re-sized');

        fireReduceChange(true);
        assert.equal(fx.reducedMotion, true);
        assert.ok(fx.config.count <= 40, 're-degraded');

        fx.destroy();
        mediaState.reduce = false;
    });

    test('destroy() removes the media listener (no leak)', () => {
        mediaState.reduce = false;
        const before = totalReduceListeners();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        assert.equal(totalReduceListeners(), before + 1, 'listener attached');
        fx.destroy();
        assert.equal(totalReduceListeners(), before, 'listener detached');
    });

    test('reducedMotion: false attaches no media listener at all', () => {
        const before = totalReduceListeners();
        const fx = createAmbientFX(makeCanvas(), { autoStart: false, reducedMotion: false });
        assert.equal(totalReduceListeners(), before);
        fx.destroy();
    });
});

// ============================================================
//  v1.2.0 -- FALL behavior
// ============================================================

describe('FALL behavior', () => {
    // Drive BEHAVIORS.FALL directly against the {spawn, tick} contract. This is
    // the only way to observe particle state -- the pool is closed over.
    function fallHarness(cfg, n) {
        const particles = [];
        const sprite = { __sprite: true };
        const frame = {
            cfg,
            W: 800,
            H: 600,
            dt: 16,
            ds: 1,
            timestamp: 0,
            isInit: false,
            getSprite: () => sprite,
            respawn: (p) => { p.__respawned = (p.__respawned | 0) + 1; BEHAVIORS.FALL.spawn(p, frame); },
        };
        for (let i = 0; i < n; i++) {
            const p = {
                id: i, color: '', spriteCanvas: null, z: 0, life: 0, x: 0, y: 0, size: 0,
                vx: 0, vy: 0, decay: 0, maxAlpha: 0, anchorX: 0, anchorY: 0, pulseOffset: 0,
                terminal: 0, driftPhase: 0, driftSpeed: 0, driftAmp: 0,
            };
            BEHAVIORS.FALL.spawn(p, frame);
            particles.push(p);
        }
        const ctx = makeContext2D();
        return { particles, frame, ctx };
    }

    test('particles fall -- the gap the other four behaviors left', () => {
        const cfg = { ...THEMES.Snow, wind: { x: 0, y: 0 }, turbulence: 0 };
        const h = fallHarness(cfg, 40);
        // Park everyone mid-screen so nobody culls out during the window.
        for (const p of h.particles) { p.y = 100; p.vy = 0; }
        const y0 = h.particles.map((p) => p.y);
        for (let f = 0; f < 30; f++) {
            h.frame.timestamp = f * 16;
            BEHAVIORS.FALL.tick(h.particles, h.ctx, h.frame);
        }
        for (let i = 0; i < h.particles.length; i++) {
            const p = h.particles[i];
            if (p.__respawned) continue;
            assert.ok(p.y > y0[i], 'particle ' + i + ' moved down: ' + y0[i] + ' -> ' + p.y);
        }
    });

    test('vy accelerates toward the particle terminal velocity and clamps there', () => {
        const cfg = { ...THEMES.Snow, wind: { x: 0, y: 0 }, turbulence: 0, decay: 0 };
        const h = fallHarness(cfg, 25);
        for (const p of h.particles) { p.y = 0; p.vy = 0; }
        for (let f = 0; f < 400; f++) {
            for (const p of h.particles) p.y = 100;    // hold them on-screen
            BEHAVIORS.FALL.tick(h.particles, h.ctx, h.frame);
        }
        for (const p of h.particles) {
            assert.ok(p.vy <= p.terminal + 1e-6, 'vy clamped: ' + p.vy + ' <= ' + p.terminal);
            assert.ok(p.vy > p.terminal * 0.99, 'vy reached terminal: ' + p.vy);
            assert.ok(p.terminal > 0 && p.terminal <= cfg.speed + 1e-9);
        }
    });

    test('terminal velocity is depth-correlated -- near flakes outrun far ones', () => {
        const h = fallHarness({ ...THEMES.Snow }, 400);
        let near = null;
        let far = null;
        for (const p of h.particles) {
            if (near === null || p.z > near.z) near = p;
            if (far === null || p.z < far.z) far = p;
        }
        assert.ok(near.z - far.z > 0.4, 'depth bands are separated');
        assert.ok(near.terminal > far.terminal, 'near falls faster');
        assert.ok(near.size > far.size, 'near is bigger');
        assert.ok(near.maxAlpha > far.maxAlpha, 'near is more opaque');
    });

    test('turbulence sways particles horizontally; zero turbulence does not', () => {
        const swayCfg = { ...THEMES.Snow, wind: { x: 0, y: 0 }, turbulence: 3 };
        const stillCfg = { ...THEMES.Snow, wind: { x: 0, y: 0 }, turbulence: 0 };
        for (const [cfg, shouldMove] of [[swayCfg, true], [stillCfg, false]]) {
            const h = fallHarness(cfg, 30);
            for (const p of h.particles) { p.y = 50; }
            const x0 = h.particles.map((p) => p.x);
            for (let f = 0; f < 20; f++) {
                for (const p of h.particles) p.y = 50;
                BEHAVIORS.FALL.tick(h.particles, h.ctx, h.frame);
            }
            const moved = h.particles.filter((p, i) => Math.abs(p.x - x0[i]) > 0.01).length;
            if (shouldMove) assert.ok(moved > 20, 'sway displaced ' + moved + '/30');
            else assert.equal(moved, 0, 'no sway at turbulence 0');
        }
    });

    test('particles below the floor are recycled back to the top', () => {
        const h = fallHarness({ ...THEMES.Snow }, 10);
        for (const p of h.particles) { p.y = 5000; }
        BEHAVIORS.FALL.tick(h.particles, h.ctx, h.frame);
        for (const p of h.particles) {
            assert.equal(p.__respawned, 1, 'respawned once');
            assert.ok(p.y < 0, 'respawned above the top edge: ' + p.y);
        }
    });

    test('stretch elongates the sprite along the fall vector (Rain), not Snow', () => {
        function drawnHeights(cfg) {
            const h = fallHarness(cfg, 12);
            const heights = [];
            for (const p of h.particles) { p.y = 300; p.vy = p.terminal; p.life = 0.5; }
            const ctx = {
                globalAlpha: 1,
                drawImage(_s, _x, _y, w, hh) { heights.push([w, hh]); },
            };
            BEHAVIORS.FALL.tick(h.particles, ctx, h.frame);
            return heights;
        }
        const snow = drawnHeights({ ...THEMES.Snow });
        assert.ok(snow.length > 0);
        for (const [w, hh] of snow) assert.equal(w, hh, 'snow draws square (round blob)');

        const rain = drawnHeights({ ...THEMES.Rain });
        assert.ok(rain.length > 0);
        let stretched = 0;
        for (const [w, hh] of rain) if (hh > w) stretched++;
        assert.ok(stretched > 0, 'rain draws elongated streaks');
    });

    test('Snow and Rain both mount and render through FALL', () => {
        for (const theme of ['Snow', 'Rain']) {
            const canvas = makeCanvas(800, 600);
            const fx = createAmbientFX(canvas, { theme, overrides: { count: 30 } });
            pumpFrame(0);
            pumpFrame(16);
            pumpFrame(32);
            const calls = canvas.getContext('2d').__state.calls;
            assert.ok(calls.some((c) => c[0] === 'drawImage'), theme + ' drew sprites');
            assert.equal(fx.config.behavior, 'FALL');
            fx.destroy();
        }
    });

    test('Rain carries a stretch, Snow does not', () => {
        assert.ok(THEMES.Rain.stretch > 1, 'rain streaks');
        assert.equal(THEMES.Snow.stretch, undefined, 'snow stays round');
    });

    test('FALL survives a zero-turbulence, zero-wind config without NaN', () => {
        const canvas = makeCanvas(400, 300);
        const fx = createAmbientFX(canvas, {
            theme: 'Snow',
            overrides: { count: 10, turbulence: 0, wind: { x: 0, y: 0 } },
        });
        for (let t = 0; t <= 320; t += 16) pumpFrame(t);
        assert.equal(fx.count, 10);
        fx.destroy();
    });
});

// ============================================================
//  v1.2.0 -- pointer reactivity
// ============================================================

describe('pointer reactivity', () => {
    test('defaults to off and binds no listeners', () => {
        const before = windowListenerCount();
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', autoStart: false });
        assert.equal(fx.pointer.mode, 'off');
        assert.equal(windowListenerCount(), before, 'no pointer listeners when off');
        fx.destroy();
    });

    test('repel binds listeners and destroy() releases them', () => {
        const before = windowListenerCount();
        const fx = createAmbientFX(makeCanvas(), {
            theme: 'Fire',
            autoStart: false,
            pointer: { mode: 'repel' },
        });
        assert.ok(windowListenerCount() > before, 'listeners attached');
        fx.destroy();
        assert.equal(windowListenerCount(), before, 'listeners released');
    });

    test('setPointer("off") unbinds live; setPointer("attract") re-binds', () => {
        const before = windowListenerCount();
        const fx = createAmbientFX(makeCanvas(), {
            theme: 'Fire',
            autoStart: false,
            pointer: { mode: 'repel', radius: 100, strength: 5 },
        });
        fx.setPointer({ mode: 'off' });
        assert.equal(windowListenerCount(), before, 'unbound');
        assert.equal(fx.pointer.mode, 'off');

        fx.setPointer({ mode: 'attract' });
        assert.ok(windowListenerCount() > before, 'rebound');
        assert.equal(fx.pointer.mode, 'attract');
        assert.equal(fx.pointer.radius, 100, 'partial update keeps the radius');
        assert.equal(fx.pointer.strength, 5, 'partial update keeps the strength');
        fx.destroy();
    });

    test('rejects a bad spec at construction and at setPointer', () => {
        assert.throws(
            () => createAmbientFX(makeCanvas(), { pointer: { mode: 'shove' } }),
            RangeError,
        );
        const fx = createAmbientFX(makeCanvas(), { autoStart: false, pointer: { mode: 'repel' } });
        assert.throws(() => fx.setPointer({ radius: -5 }), RangeError);
        assert.equal(fx.pointer.radius, 140, 'spec unchanged after a rejected update');
        fx.destroy();
    });

    test('pointer spec getter is a defensive copy', () => {
        const fx = createAmbientFX(makeCanvas(), { autoStart: false, pointer: { mode: 'repel' } });
        const a = fx.pointer;
        a.radius = 9999;
        assert.equal(fx.pointer.radius, 140, 'mutating the copy does not leak in');
        fx.destroy();
    });

    test('a touch pointerup ends the interaction; a mouse pointerup does not', () => {
        const fx = createAmbientFX(makeCanvas(), { theme: 'Fire', pointer: { mode: 'repel' } });
        firePointer('pointermove', 100, 100, 'mouse');
        firePointer('pointerup', 100, 100, 'mouse');
        pumpFrame(0);
        pumpFrame(16);   // still hovering -- no throw, still running
        assert.ok(fx.running);

        firePointer('pointermove', 100, 100, 'touch');
        firePointer('pointerup', 100, 100, 'touch');
        pumpFrame(32);
        assert.ok(fx.running);
        fx.destroy();
    });

    test('the pointer pass runs for every behavior, including custom ones', () => {
        // The pass lives in the instance loop, not in any tick(), so a behavior
        // registered by a third party gets pointer reactivity without knowing it.
        for (const theme of ['Fire', 'Ice', 'Toxic', 'Void', 'Snow']) {
            const canvas = makeCanvas(800, 600);
            const fx = createAmbientFX(canvas, {
                theme,
                overrides: { count: 25 },
                pointer: { mode: 'repel', radius: 200, strength: 30 },
            });
            firePointer('pointermove', 400, 300);
            for (let t = 0; t <= 96; t += 16) pumpFrame(t);
            assert.equal(fx.count, 25, theme + ' pool intact');
            fx.destroy();
        }
    });

    test('reduced motion disables pointer reactivity (WCAG 2.3.3)', () => {
        mediaState.reduce = true;
        const fx = createAmbientFX(makeCanvas(), {
            theme: 'Fire',
            pointer: { mode: 'repel', strength: 50 },
        });
        assert.equal(fx.reducedMotion, true);
        firePointer('pointermove', 100, 100);
        for (let t = 0; t <= 64; t += 16) pumpFrame(t);
        // Still mounted and sane -- the pass short-circuits rather than moving anything.
        assert.ok(fx.running);
        fx.destroy();
        mediaState.reduce = false;
    });
});
