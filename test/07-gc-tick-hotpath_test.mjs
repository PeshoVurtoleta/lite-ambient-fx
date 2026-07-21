// test/07-gc-tick-hotpath_test.mjs
//
// Zero-GC on the hot path — the ecosystem's headline claim, made falsifiable.
// For each built-in behavior (EMBER, MIST, FLOAT, CHAOS, FALL), warm up the
// tick, then run 5000 frames under a lite-gc-profiler observer and assert
// `maxMajor: 0`. Also emits `count`, `minor`, and `totalMs` so trends are
// visible in the test log even when the gate passes.
//
// Runs without --expose-gc. Precise mode via node's perf_hooks GC observer.
// FIRST-RUN EXPECTATION: strict — will fail if any built-in behavior leaks
// even a single major GC across the measurement window.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GcProfiler, checkNoGc } from '@zakkster/lite-gc-profiler';

import { BEHAVIORS } from '../AmbientFX.js';

const BUILTIN_NAMES = ['EMBER', 'MIST', 'FLOAT', 'CHAOS', 'FALL'];
const N_PARTICLES = 500;
const N_WARMUP    = 500;
const N_MEASURE   = 5000;


// ─── Mock canvas ctx — every 2D method is a no-op ────────────────────────────

function makeMockCtx() {
    return {
        globalAlpha: 1,
        fillStyle: '#000',
        clearRect() {}, fillRect() {}, drawImage() {},
        beginPath() {}, arc() {}, fill() {},
        createRadialGradient() { return { addColorStop() {} }; },
    };
}

// ─── Preallocated sprite for the whole test ──────────────────────────────────
// getSprite returns THIS canvas for every color/size — no cache misses, no
// canvas allocation. Behaviors just receive a reference to draw with.

const _mockSprite = { width: 32, height: 32 };

// ─── Frame factory ───────────────────────────────────────────────────────────

function makeFrame(cfg, W, H) {
    const frame = {
        cfg,
        W, H,
        dt: 16,
        ds: 1,
        timestamp: 0,
        isInit: false,
        getSprite: (_color, _size) => _mockSprite,
        respawn(p, isInit) {
            frame.isInit = isInit;
            BEHAVIORS[cfg.behavior].spawn(p, frame);
        },
    };
    return frame;
}

// ─── Config for each behavior — plausible values, doesn't need to match a
//     shipped theme exactly. What matters is the tick loop stays hot.

function makeConfigFor(behavior) {
    return {
        behavior,
        colors: ['#ff6600', '#ffcc00', '#ff9900'],
        spark: '#ffff88',
        count: N_PARTICLES,
        wind: { x: 0.05, y: -0.1 },
        decay: 0.005,
        speed: 1.0,
        size: 8,
        alpha: 0.8,
        turbulence: 0.4,
        stretch: 1.5,     // FALL only, ignored elsewhere
    };
}


function _makeParticle() {
    return {
        id: 0, color: '', spriteCanvas: null,
        z: 0, life: 0, x: 0, y: 0, size: 0,
        vx: 0, vy: 0, decay: 0, maxAlpha: 0,
        anchorX: 0, anchorY: 0, pulseOffset: 0,
    };
}

function _populatePool(behavior, frame) {
    const pool = new Array(N_PARTICLES);
    for (let i = 0; i < N_PARTICLES; i++) {
        pool[i] = _makeParticle();
        frame.isInit = true;
        BEHAVIORS[behavior].spawn(pool[i], frame);
    }
    return pool;
}


async function _measureBehavior(behavior) {
    const cfg = makeConfigFor(behavior);
    const frame = makeFrame(cfg, 800, 600);
    const cx = makeMockCtx();
    const pool = _populatePool(behavior, frame);

    const tick = BEHAVIORS[behavior].tick;

    // Warmup — let V8 settle. No profiling.
    for (let i = 0; i < N_WARMUP; i++) {
        frame.dt = 16;
        frame.ds = 1;
        frame.timestamp = i * 16;
        tick(pool, cx, frame);
    }

    // Force a baseline GC if available; otherwise the observer sees whatever
    // young-gen debris the warmup left behind.
    if (global.gc) global.gc();

    const profiler = new GcProfiler().start();

    for (let i = 0; i < N_MEASURE; i++) {
        frame.dt = 16;
        frame.ds = 1;
        frame.timestamp = (N_WARMUP + i) * 16;
        tick(pool, cx, frame);
    }

    // Perf_hooks delivers GC entries between microtasks. Drain.
    await new Promise((r) => setTimeout(r, 100));

    const summary = profiler.summary();
    profiler.stop();
    return summary;
}


// ─── Per-behavior gate ───────────────────────────────────────────────────────

for (const name of BUILTIN_NAMES) {
    test(`hot-path: ${name}.tick — no major GC over ${N_MEASURE} frames`, async () => {
        if (!BEHAVIORS[name]) {
            throw new Error(`BEHAVIORS.${name} not exported from ../AmbientFX.js`);
        }

        const summary = await _measureBehavior(name);
        const gc = summary.gc;

        // Log every run so trends are visible even on green.
        console.log(
            `  ${name}: count=${gc.count} minor=${gc.minor} major=${gc.major} ` +
            `totalMs=${gc.totalMs.toFixed(2)} maxMs=${gc.maxMs.toFixed(2)}`
        );

        const report = checkNoGc(summary, { maxMajor: 0 });
        assert.ok(report.ok,
            `${name}.tick triggered a major GC on the measured hot path.\n` +
            `Full summary: ${JSON.stringify(gc, null, 2)}\n` +
            `Violations: ${JSON.stringify(report.violations, null, 2)}\n\n` +
            `A major (Mark-Sweep-Compact) collection in the render loop is a\n` +
            `frame-drop by construction. The most common causes in ambient-fx:\n` +
            `  - object literal '{}' inside the tick loop\n` +
            `  - Array#map / #filter / #slice on the particle array\n` +
            `  - .toFixed() / .toLocaleString() on numeric channels\n` +
            `  - un-cached document.querySelector inside a callback\n` +
            `  - fresh event object or bind() in a per-frame call`,
        );
    });
}


// ─── Aggregate: allocation budget across all behaviors ───────────────────────

test('hot-path: aggregate — combined minor-GC budget across all 5 behaviors', async () => {
    let totalMinor = 0;
    let totalMajor = 0;
    for (const name of BUILTIN_NAMES) {
        if (!BEHAVIORS[name]) continue;
        const summary = await _measureBehavior(name);
        totalMinor += summary.gc.minor;
        totalMajor += summary.gc.major;
    }
    console.log(`  aggregate: minor=${totalMinor} major=${totalMajor}`);

    // Majors: hard zero.
    assert.equal(totalMajor, 0, `${totalMajor} major GC(s) across the behavior set`);

    // Minors: soft budget. 5 behaviors × 5000 frames = 25000 hot-path frames.
    // Even with ambient young-gen activity, expect < 40 minors total. If this
    // trips, something in the tick loop grew a small allocation — worth
    // investigating even without a major.
    assert.ok(totalMinor < 40,
        `${totalMinor} minor GC(s) across ${BUILTIN_NAMES.length * N_MEASURE} hot-path frames — ` +
        `above soft budget of 40. Check for new short-lived allocations in tick bodies.`);
});
