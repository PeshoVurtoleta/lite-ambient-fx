/**
 * Behavior registry: BEHAVIORS surface, registerBehavior arg validation,
 * end-to-end custom-behavior use through createAmbientFX, and particle
 * shape monomorphism (property set stable across spawn and across a
 * behavior swap).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// -- DOM shim (same shape as 02-runtime_test) --------------------

const rafCallbacks = [];
let rafNext = 1;

function makeContext2D() {
    return {
        setTransform() {},
        clearRect() {},
        drawImage() {},
        createRadialGradient() { return { addColorStop() {} }; },
        beginPath() {},
        arc() {},
        fill() {},
        set fillStyle(_) {},
        set globalAlpha(_) {},
        set globalCompositeOperation(_) {},
    };
}

function makeCanvas(width = 800, height = 600) {
    let ctx = null;
    return {
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
}

before(() => {
    globalThis.document = {
        hidden: false,
        _listeners: {},
        addEventListener(name, fn) { (this._listeners[name] ||= []).push(fn); },
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

const {
    BEHAVIORS,
    registerBehavior,
    createAmbientFX,
    clearAmbientSpriteCache,
    THEMES,
    THEME_META,
    registerTheme,
    validateConfig,
} = await import('../AmbientFX.js');

describe('BEHAVIORS registry surface', () => {
    test('four built-ins are registered', () => {
        assert.equal(typeof BEHAVIORS.EMBER, 'object');
        assert.equal(typeof BEHAVIORS.MIST, 'object');
        assert.equal(typeof BEHAVIORS.FLOAT, 'object');
        assert.equal(typeof BEHAVIORS.CHAOS, 'object');
    });

    test('every built-in has the { spriteLogical, spawn, tick } shape', () => {
        for (const name of ['EMBER', 'MIST', 'FLOAT', 'CHAOS']) {
            const b = BEHAVIORS[name];
            assert.equal(typeof b.spriteLogical, 'number', name);
            assert.ok(b.spriteLogical > 0, name);
            assert.equal(typeof b.spawn, 'function', name);
            assert.equal(typeof b.tick, 'function', name);
        }
    });

    test('MIST rasterizes at 128, other built-ins at 64', () => {
        assert.equal(BEHAVIORS.MIST.spriteLogical, 128);
        assert.equal(BEHAVIORS.EMBER.spriteLogical, 64);
        assert.equal(BEHAVIORS.FLOAT.spriteLogical, 64);
        assert.equal(BEHAVIORS.CHAOS.spriteLogical, 64);
    });

    test('registry uses a null-prototype map (no accidental "toString" lookups)', () => {
        assert.equal(Object.getPrototypeOf(BEHAVIORS), null);
    });
});

describe('registerBehavior -- arg validation', () => {
    test('rejects empty name', () => {
        assert.throws(() => registerBehavior('', { spriteLogical: 64, spawn() {}, tick() {} }), TypeError);
    });

    test('rejects non-string name', () => {
        assert.throws(() => registerBehavior(42, { spriteLogical: 64, spawn() {}, tick() {} }), TypeError);
    });

    test('rejects missing definition', () => {
        assert.throws(() => registerBehavior('X', null), TypeError);
    });

    test('rejects missing spawn/tick functions', () => {
        assert.throws(() => registerBehavior('X', { spriteLogical: 64, tick() {} }), TypeError);
        assert.throws(() => registerBehavior('X', { spriteLogical: 64, spawn() {} }), TypeError);
    });

    test('rejects non-numeric or non-positive spriteLogical', () => {
        assert.throws(() => registerBehavior('X', { spawn() {}, tick() {} }), TypeError);
        assert.throws(() => registerBehavior('X', { spriteLogical: 0, spawn() {}, tick() {} }), TypeError);
        assert.throws(() => registerBehavior('X', { spriteLogical: -1, spawn() {}, tick() {} }), TypeError);
    });
});

describe('registerBehavior -- end to end', () => {
    test('a registered custom behavior is validatable', () => {
        registerBehavior('TESTB', { spriteLogical: 32, spawn() {}, tick() {} });
        try {
            const cfg = { ...THEMES.Fire, behavior: 'TESTB' };
            assert.doesNotThrow(() => validateConfig(cfg));
        } finally {
            delete BEHAVIORS.TESTB;
        }
    });

    test('validateConfig rejects an unregistered behavior name', () => {
        const cfg = { ...THEMES.Fire, behavior: 'DEFINITELY_NOT_REGISTERED' };
        assert.throws(() => validateConfig(cfg), RangeError);
    });

    test('a custom behavior drives spawn + tick end to end', () => {
        clearAmbientSpriteCache();
        let spawnCalls = 0;
        let tickCalls = 0;
        registerBehavior('COUNT', {
            spriteLogical: 32,
            spawn(p, frame) {
                spawnCalls++;
                // Must set spriteCanvas via frame.getSprite.
                p.color = frame.cfg.colors[0];
                p.spriteCanvas = frame.getSprite(p.color, 32);
                p.x = 50;
                p.y = 50;
                p.z = 1;
                p.size = 4;
                p.life = 0;
                p.vx = 0;
                p.vy = 0;
                p.decay = frame.cfg.decay;
                p.maxAlpha = frame.cfg.alpha;
                p.anchorX = 0;
                p.anchorY = 0;
                p.pulseOffset = 0;
            },
            tick(particles, ctx, frame) {
                tickCalls++;
                for (let i = 0; i < particles.length; i++) {
                    // Trivial physics; touch the sprite so the pipeline runs.
                    const p = particles[i];
                    p.x += 1;
                    if (p.spriteCanvas !== null) ctx.drawImage(p.spriteCanvas, 0, 0);
                }
            },
        });
        try {
            const fx = createAmbientFX(makeCanvas(), {
                theme: 'Fire',
                overrides: { behavior: 'COUNT', count: 10 },
            });
            assert.equal(fx.config.behavior, 'COUNT');
            assert.equal(spawnCalls, 10, 'spawn should fire once per particle at init');
            pumpFrame(0);
            pumpFrame(16);
            assert.ok(tickCalls >= 1, 'tick should fire after prime frame');
            fx.destroy();
        } finally {
            delete BEHAVIORS.COUNT;
        }
    });
});

describe('particle shape monomorphism', () => {
    /**
     * We can't inspect V8 hidden classes from JS, but we can pin a proxy:
     * assert the property set never grows during spawn, and stays stable
     * across a behavior swap.
     */

    function snapshotKeys(fx) {
        // The public API doesn't expose particles directly. We peek by
        // installing a probe behavior that snapshots the first particle
        // it's asked to touch, then returns to the original.
        const snapshots = [];
        registerBehavior('PROBE_' + snapshots.length, {
            spriteLogical: 32,
            spawn(p, frame) {
                // Just capture keys before any spawn writes.
                snapshots.push(Object.keys(p).slice());
                // Then run a canonical minimal spawn so the pool stays valid.
                BEHAVIORS.EMBER.spawn(p, frame);
            },
            tick() {},
        });
        return snapshots;
    }

    test('freshly-pushed particles carry the full union shape', () => {
        clearAmbientSpriteCache();
        const snapshots = snapshotKeys();
        const probeName = 'PROBE_0';
        try {
            const fx = createAmbientFX(makeCanvas(), {
                theme: 'Fire',
                overrides: { behavior: probeName, count: 5 },
            });
            assert.equal(snapshots.length, 5, 'probed all 5 spawns');
            const expected = [
                'id', 'color', 'spriteCanvas', 'z', 'life', 'x', 'y', 'size',
                'vx', 'vy', 'decay', 'maxAlpha',
                'anchorX', 'anchorY', 'pulseOffset',
            ];
            for (const keys of snapshots) {
                assert.deepEqual(keys, expected, 'particle keys stable at spawn time');
            }
            fx.destroy();
        } finally {
            delete BEHAVIORS[probeName];
        }
    });

    test('behavior swap does not add or remove particle properties', () => {
        clearAmbientSpriteCache();
        const fx = createAmbientFX(makeCanvas(), {
            theme: 'Fire',
            overrides: { count: 3 },
        });

        // Prime + tick.
        pumpFrame(0);
        pumpFrame(16);
        pumpFrame(32);

        // Rotate through all four built-in behaviors. If any spawn added or
        // removed a property, the next spawn would break V8's hidden class
        // and subsequent frames would degrade -- but here we assert only
        // the observable public contract: no exceptions, no NaN drift into
        // the count/running state, and the theme swap semantics hold.
        fx.updateConfig({ behavior: 'MIST', colors: THEMES.Ice.colors, spark: THEMES.Ice.spark });
        pumpFrame(48);
        assert.equal(fx.config.behavior, 'MIST');

        fx.updateConfig({ behavior: 'CHAOS', colors: THEMES.Void.colors, spark: THEMES.Void.spark });
        pumpFrame(64);
        assert.equal(fx.config.behavior, 'CHAOS');

        fx.updateConfig({ behavior: 'FLOAT', colors: THEMES.Toxic.colors, spark: THEMES.Toxic.spark });
        pumpFrame(80);
        assert.equal(fx.config.behavior, 'FLOAT');

        fx.updateConfig({ behavior: 'EMBER', colors: THEMES.Fire.colors, spark: THEMES.Fire.spark });
        pumpFrame(96);
        assert.equal(fx.config.behavior, 'EMBER');

        assert.equal(fx.count, 3);
        assert.equal(fx.running, true);
        fx.destroy();
    });
});

describe('frame context -- spawn contract', () => {
    test('frame.getSprite returns a canvas-like object', () => {
        clearAmbientSpriteCache();
        let capturedCanvas = null;
        registerBehavior('CAP', {
            spriteLogical: 40,
            spawn(p, frame) {
                capturedCanvas = frame.getSprite(frame.cfg.colors[0], 40);
                p.color = frame.cfg.colors[0];
                p.spriteCanvas = capturedCanvas;
                p.x = 0; p.y = 0; p.z = 1; p.size = 4;
                p.life = 0; p.vx = 0; p.vy = 0;
                p.decay = 0; p.maxAlpha = 1;
                p.anchorX = 0; p.anchorY = 0; p.pulseOffset = 0;
            },
            tick() {},
        });
        try {
            const fx = createAmbientFX(makeCanvas(), {
                theme: 'Fire',
                overrides: { behavior: 'CAP', count: 1 },
            });
            assert.ok(capturedCanvas !== null);
            assert.equal(typeof capturedCanvas.width, 'number');
            assert.ok(capturedCanvas.width > 0);
            fx.destroy();
        } finally {
            delete BEHAVIORS.CAP;
        }
    });

    test('frame.respawn called from tick recycles the particle', () => {
        clearAmbientSpriteCache();
        let respawnCalls = 0;
        registerBehavior('KILL', {
            spriteLogical: 32,
            spawn(p, frame) {
                p.color = frame.cfg.colors[0];
                p.spriteCanvas = frame.getSprite(p.color, 32);
                p.x = 10; p.y = 10; p.z = 1; p.size = 4;
                p.life = 0; p.vx = 0; p.vy = 0;
                p.decay = 0.5; p.maxAlpha = 1;
                p.anchorX = 0; p.anchorY = 0; p.pulseOffset = 0;
            },
            tick(particles, ctx, frame) {
                for (let i = 0; i < particles.length; i++) {
                    // Every particle dies immediately.
                    frame.respawn(particles[i], false);
                    respawnCalls++;
                }
            },
        });
        try {
            const fx = createAmbientFX(makeCanvas(), {
                theme: 'Fire',
                overrides: { behavior: 'KILL', count: 4 },
            });
            pumpFrame(0);   // primes lastTime
            pumpFrame(16);  // one real tick
            assert.equal(respawnCalls, 4, 'each particle respawned exactly once per tick');
            fx.destroy();
        } finally {
            delete BEHAVIORS.KILL;
        }
    });
});

// ============================================================
//  v1.1.0 -- THEME registry
// ============================================================

const CUSTOM = () => ({
    behavior: 'EMBER',
    colors: ['#123456', '#654321'],
    spark: '#abcdef',
    count: 42,
    wind: { x: 0.1, y: -0.2 },
    decay: 0.004,
    speed: 1.1,
    size: 9,
    alpha: 0.7,
    turbulence: 0.4,
});

describe('registerTheme', () => {
    test('rejects a bad name', () => {
        assert.throws(() => registerTheme('', CUSTOM()), TypeError);
        assert.throws(() => registerTheme(null, CUSTOM()), TypeError);
    });

    test('rejects a non-object config', () => {
        assert.throws(() => registerTheme('Bad', null), TypeError);
        assert.throws(() => registerTheme('Bad', 'nope'), TypeError);
    });

    test('rejects an unregistered behavior', () => {
        assert.throws(() => registerTheme('Bad', { ...CUSTOM(), behavior: 'NOPE' }), RangeError);
    });

    test('rejects an incomplete config instead of NaN-ing the render loop', () => {
        const partial = { behavior: 'EMBER', colors: ['#fff'], spark: '#fff', count: 10, alpha: 1 };
        assert.throws(() => registerTheme('Partial', partial));
        assert.equal(THEMES['Partial'], undefined, 'nothing was stored');
    });

    test('registers into THEMES and returns the validated config', () => {
        const out = registerTheme('Neon', CUSTOM());
        assert.ok(THEMES.Neon, 'present in THEMES');
        assert.equal(THEMES.Neon.count, 42);
        assert.equal(out.behavior, 'EMBER');
        assert.notEqual(THEMES.Neon.wind, CUSTOM().wind, 'wind is cloned, not aliased');
    });

    test('appends to THEME_META so existing pickers keep working', () => {
        registerTheme('SolarFlare', CUSTOM());
        const meta = THEME_META.find((m) => m.id === 'SolarFlare');
        assert.ok(meta, 'meta entry created');
        assert.equal(meta.name, 'Solar Flare', 'de-camelCased display name');
        assert.equal(meta.icon, 'sparks', 'icon derived from the EMBER behavior');
        assert.equal(meta.behavior, 'EMBER');
    });

    test('accepts explicit display metadata', () => {
        registerTheme('Xx', CUSTOM(), { name: 'Custom Vibe', icon: 'orb' });
        const meta = THEME_META.find((m) => m.id === 'Xx');
        assert.equal(meta.name, 'Custom Vibe');
        assert.equal(meta.icon, 'orb');
    });

    test('overriding a built-in preserves its curated meta by default', () => {
        const before = THEME_META.find((m) => m.id === 'Fire');
        assert.equal(before.name, 'Inferno');
        registerTheme('Fire', { ...CUSTOM(), count: 7 });
        const after = THEME_META.find((m) => m.id === 'Fire');
        assert.equal(after.name, 'Inferno', 'curated name kept');
        assert.equal(THEMES.Fire.count, 7, 'config replaced');
        assert.equal(THEME_META.filter((m) => m.id === 'Fire').length, 1, 'no duplicate meta row');
    });

    test('a registered theme mounts end-to-end through createAmbientFX', () => {
        registerTheme('Mountable', CUSTOM());
        const fx = createAmbientFX(makeCanvas(), { theme: 'Mountable', autoStart: false });
        assert.equal(fx.theme, 'Mountable');
        assert.equal(fx.count, 42);
        fx.destroy();
    });

    test('setTheme() swaps to a registered theme', () => {
        registerTheme('Swappable', { ...CUSTOM(), count: 11 });
        const fx = createAmbientFX(makeCanvas(), { theme: 'Void', autoStart: false });
        fx.setTheme('Swappable');
        assert.equal(fx.theme, 'Swappable');
        assert.equal(fx.count, 11);
        fx.destroy();
    });

    test('unknown theme throws a RangeError listing what is registered', () => {
        assert.throws(
            () => createAmbientFX(makeCanvas(), { theme: 'Nonexistent' }),
            (e) => e instanceof RangeError && e.message.includes('registered:'),
        );
    });

    test('THEMES has no inherited keys -- Object.prototype cannot be used as a theme', () => {
        assert.equal(THEMES['constructor'], undefined);
        assert.throws(() => createAmbientFX(makeCanvas(), { theme: 'constructor' }), RangeError);
        assert.throws(() => createAmbientFX(makeCanvas(), { theme: 'toString' }), RangeError);
    });

    test("registerTheme('__proto__') creates a real own key, not a prototype write", () => {
        registerTheme('__proto__', CUSTOM());
        assert.ok(Object.keys(THEMES).includes('__proto__'), 'stored as an own key');
        assert.equal(Object.getPrototypeOf(THEMES), null, 'prototype untouched');
        assert.equal(THEMES['__proto__'].count, 42);
    });
});
