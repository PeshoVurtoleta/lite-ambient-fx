// test/09-color-pipeline-gc_test.mjs
//
// v1.3.0 color pipeline allocation profile. `lerpTheme(a, b, t, scratch)` is
// designed to reuse the scratch's `colors` array and `wind` object across
// calls — the only unavoidable per-call allocations are fresh hex strings for
// each palette slot (strings are immutable). This test asserts:
//
//   - `maxMajor: 0` across 10 000 lerpTheme calls (hard gate)
//   - `maxMinor <= 20` (soft budget — the hex strings themselves land in the
//     nursery but shouldn't drive frequent scavenges when they're 7 chars each)
//
// FIRST-RUN EXPECTATION: passes on the reference implementation. Any change to
// lerpTheme that grows an object per call (e.g. reallocating scratch.colors,
// or writing scratch.wind = {} instead of mutating) will fail here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GcProfiler, checkNoGc } from '@zakkster/lite-gc-profiler';

import { lerpTheme, parseColor, formatColor, lerpOklch } from '../AmbientFX.js';

const N_WARMUP  = 500;
const N_MEASURE = 10000;

const THEME_A = {
    behavior: 'EMBER',
    colors: ['#ff6600', '#ffcc00', '#ff9900'],
    spark: '#ffff88',
    count: 200, wind: { x: -0.1, y: -0.3 },
    decay: 0.006, speed: 1.0, size: 6, alpha: 0.85, turbulence: 0.4,
};
const THEME_B = {
    behavior: 'EMBER',
    colors: ['#003366', '#0066cc', '#0099ff'],
    spark: '#66ccff',
    count: 300, wind: { x: 0.05, y: -0.1 },
    decay: 0.004, speed: 0.6, size: 8, alpha: 0.5, turbulence: 0.6,
};


test('lerpTheme with scratch — no major GC over 10 000 calls', async () => {
    if (typeof lerpTheme !== 'function') {
        throw new Error('lerpTheme not exported from ../AmbientFX.js (v1.3.0 required)');
    }
    const scratch = { colors: [], wind: { x: 0, y: 0 } };

    // Warmup — populate slots, let V8 settle string internalization.
    for (let i = 0; i < N_WARMUP; i++) {
        lerpTheme(THEME_A, THEME_B, i / N_WARMUP, scratch);
    }
    if (global.gc) global.gc();

    const gc = new GcProfiler().start();

    // Drive t at a varied cadence — sine so we visit both endpoints and midpoint.
    for (let i = 0; i < N_MEASURE; i++) {
        const t = 0.5 + 0.5 * Math.sin(i * 0.017);
        lerpTheme(THEME_A, THEME_B, t, scratch);
    }

    await new Promise((r) => setTimeout(r, 100));
    const summary = gc.summary();
    gc.stop();

    console.log(
        `  lerpTheme: count=${summary.gc.count} minor=${summary.gc.minor} ` +
        `major=${summary.gc.major} totalMs=${summary.gc.totalMs.toFixed(2)} ` +
        `maxMs=${summary.gc.maxMs.toFixed(2)}`
    );

    const report = checkNoGc(summary, { maxMajor: 0 });
    assert.ok(report.ok,
        `lerpTheme triggered ${summary.gc.major} major GC(s) over ${N_MEASURE} calls.\n` +
        `Likely regressions:\n` +
        `  - scratch.colors reallocated (e.g. \`out.colors = new Array(n)\` on every call)\n` +
        `  - scratch.wind rebuilt (\`out.wind = { x, y }\` instead of mutating in place)\n` +
        `  - hex output changed to \`oklch()\` strings (variable-length, escape more)\n` +
        `Summary: ${JSON.stringify(summary.gc, null, 2)}`,
    );

    // Soft budget on minors. This is the hex-string churn budget.
    assert.ok(summary.gc.minor <= 20,
        `lerpTheme triggered ${summary.gc.minor} minor GC(s) — above soft budget of 20.\n` +
        `The nursery is shouldering fresh hex strings; if this is above 20 the scratch\n` +
        `is likely leaking a per-call object outside just the strings.`);
});


test('parseColor with out buffer — zero-alloc over 100 000 calls', async () => {
    if (typeof parseColor !== 'function') {
        throw new Error('parseColor not exported from ../AmbientFX.js (v1.3.0 required)');
    }
    const out = new Float64Array(3);
    const hexes = ['#ff6600', '#4a90e2', '#c88a6b', '#000000', '#ffffff'];

    for (let i = 0; i < 500; i++) parseColor(hexes[i % hexes.length], out);
    if (global.gc) global.gc();

    const gc = new GcProfiler().start();
    for (let i = 0; i < 100000; i++) parseColor(hexes[i % hexes.length], out);
    await new Promise((r) => setTimeout(r, 100));
    const s = gc.summary();
    gc.stop();

    console.log(
        `  parseColor: count=${s.gc.count} minor=${s.gc.minor} major=${s.gc.major} ` +
        `totalMs=${s.gc.totalMs.toFixed(2)}`
    );
    assert.equal(s.gc.major, 0, `parseColor(out) triggered ${s.gc.major} major GC(s)`);
    // parseColor should be effectively zero-alloc with `out`. Tight bound.
    assert.ok(s.gc.minor <= 5, `parseColor(out) triggered ${s.gc.minor} minor GC(s) — expected ≤ 5`);
});


test('lerpOklch — zero-alloc over 100 000 calls', async () => {
    if (typeof lerpOklch !== 'function') {
        throw new Error('lerpOklch not exported from ../AmbientFX.js (v1.3.0 required)');
    }
    const a = new Float64Array([0.6, 0.15, 30]);
    const b = new Float64Array([0.5, 0.20, 260]);
    const out = new Float64Array(3);

    for (let i = 0; i < 500; i++) lerpOklch(a, b, (i & 63) / 64, out);
    if (global.gc) global.gc();

    const gc = new GcProfiler().start();
    for (let i = 0; i < 100000; i++) lerpOklch(a, b, (i & 63) / 64, out);
    await new Promise((r) => setTimeout(r, 100));
    const s = gc.summary();
    gc.stop();

    console.log(`  lerpOklch: minor=${s.gc.minor} major=${s.gc.major}`);
    assert.equal(s.gc.major, 0);
    assert.ok(s.gc.minor <= 3,
        `lerpOklch triggered ${s.gc.minor} minor GC(s) — should be strictly zero-alloc with typed arrays`);
});
