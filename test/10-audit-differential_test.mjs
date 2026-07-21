// test/10-audit-differential_test.mjs
//
// Sanity check for the audit environment itself. Runs a KNOWN-CLEAN tick loop
// and a KNOWN-LEAKY tick loop through lite-gc-profiler and asserts the leaky
// one produces measurably more GC activity. If this test fails, the audit is
// broken — do NOT trust the ambient-fx findings.
//
// Modeled on lite-gc-profiler's own test/02-gc-live: a pooled tick that mutates
// one preallocated struct in place vs a leaky tick that allocates fresh objects
// per particle per frame. Deterministic differential.
//
// Run with `--expose-gc` for the tightest signal, but the perf_hooks GC observer
// runs without it. This test does not require --expose-gc.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GcProfiler } from '@zakkster/lite-gc-profiler';

const N_PARTICLES = 500;
const N_FRAMES    = 3000;

// ─── Known-clean: preallocated pool, in-place mutation only ──────────────────

function cleanTickHarness() {
    const pool = new Array(N_PARTICLES);
    for (let i = 0; i < N_PARTICLES; i++) {
        pool[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, alpha: 0 };
    }
    // A single reused frame object.
    const frame = { W: 400, H: 300, dt: 16, ds: 1, timestamp: 0 };

    return function tick(t) {
        frame.timestamp = t;
        for (let i = 0; i < pool.length; i++) {
            const p = pool[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life += 0.005;
            p.alpha = p.life < 0.2 ? p.life * 5 : 1 - (p.life - 0.2) / 0.8;
            if (p.life >= 1) {
                p.x = Math.random() * frame.W;
                p.y = frame.H + 20;
                p.vx = (Math.random() - 0.5) * 0.4;
                p.vy = -0.5 - Math.random() * 0.5;
                p.life = 0;
            }
        }
    };
}

// ─── Known-leaky: fresh object per particle per frame ────────────────────────

function leakyTickHarness() {
    let pool = new Array(N_PARTICLES).fill(null);
    for (let i = 0; i < N_PARTICLES; i++) {
        pool[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, alpha: 0 };
    }
    return function tick(t) {
        // The canonical anti-pattern: rebuild every particle each frame.
        const next = new Array(N_PARTICLES);
        for (let i = 0; i < pool.length; i++) {
            const p = pool[i];
            next[i] = {
                x: p.x + p.vx,
                y: p.y + p.vy,
                vx: p.vx,
                vy: p.vy,
                life: p.life + 0.005,
                alpha: p.life < 0.2 ? p.life * 5 : 1 - (p.life - 0.2) / 0.8,
            };
            if (next[i].life >= 1) {
                next[i] = {
                    x: Math.random() * 400,
                    y: 320,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: -0.5 - Math.random() * 0.5,
                    life: 0,
                    alpha: 0,
                };
            }
        }
        pool = next;
    };
}

function _measureUnderProfiler(tick, frames) {
    // Warm up: JIT settles, escape analysis stabilizes.
    for (let i = 0; i < 500; i++) tick(i * 16);
    // Optional force-GC to normalize starting heap.
    if (global.gc) global.gc();

    const gc = new GcProfiler().start();
    for (let i = 0; i < frames; i++) tick(i * 16);
    // GC events are delivered asynchronously — let the observer drain.
    return new Promise((resolve) => {
        setTimeout(() => {
            const summary = gc.summary();
            gc.stop();
            resolve(summary);
        }, 100);
    });
}


test('audit environment: clean tick produces zero major GC', async () => {
    const summary = await _measureUnderProfiler(cleanTickHarness(), N_FRAMES);
    // The clean loop should produce zero majors. Minors are allowed
    // (V8's ambient young-gen activity from surrounding code) but should be
    // rare.
    assert.equal(summary.gc.major, 0,
        `clean tick unexpectedly triggered ${summary.gc.major} major GC(s):\n${JSON.stringify(summary.gc, null, 2)}`);
});

test('audit environment: leaky tick produces measurable GC activity', async () => {
    const summary = await _measureUnderProfiler(leakyTickHarness(), N_FRAMES);
    // The leaky loop allocates ~N_PARTICLES fresh objects per frame across
    // N_FRAMES frames = 1.5M short-lived objects. This has to move the needle.
    const totalGcs = summary.gc.count;
    assert.ok(totalGcs > 0,
        `leaky tick did not trigger any GC — audit environment may not be counting.\n` +
        `Summary: ${JSON.stringify(summary.gc, null, 2)}`);
});

test('audit environment: leaky tick strictly exceeds clean tick in GC totals', async () => {
    // Run both. The differential is the sanity check.
    const clean = await _measureUnderProfiler(cleanTickHarness(), N_FRAMES);
    const leaky = await _measureUnderProfiler(leakyTickHarness(), N_FRAMES);

    assert.ok(leaky.gc.count > clean.gc.count,
        `expected leaky.gc.count (${leaky.gc.count}) > clean.gc.count (${clean.gc.count}).\n` +
        `If clean and leaky look identical, the profiler isn't reading GC events —\n` +
        `check that @zakkster/lite-gc-profiler was installed and that node has perf_hooks.\n` +
        `clean: ${JSON.stringify(clean.gc)}\nleaky: ${JSON.stringify(leaky.gc)}`);
});
