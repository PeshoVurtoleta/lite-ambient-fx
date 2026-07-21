// test/08-leak-lifecycle_test.mjs
//
// Lifecycle leak audit for lite-ambient-fx. Installs lite-leak's kernels
// (timer, listener, observer, async-retention) on globalThis DOM stubs,
// then mount/destroy the instance N times and assert:
//
//   1. `tracker.audit()` returns no findings (no orphaned timers, listeners,
//      observers, or AbortControllers)
//   2. `domSnapshot()` returns to baseline between cycles (direct DOM
//      measurement, independent of the kernel readings — a double-check)
//   3. No growth in either metric across N cycles
//
// FIRST-RUN EXPECTATION: passes on a clean ambient-fx implementation. Fails
// with actionable finding output if `destroy()` forgets to:
//   - remove the window pointermove listener
//   - disconnect the ResizeObserver watching the canvas
//   - cancelAnimationFrame the render loop
//   - removeEventListener from the matchMedia list
//
// This test does not require --expose-gc.

import './_helpers/dom-install.mjs';   // MUST come first
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    createLeakTracker,
    createTimerOrphanKernel,
    createListenerOrphanKernel,
    createObserverOrphanKernel,
    createAsyncRetentionKernel,
} from '@zakkster/lite-leak';

import { makeCanvas, domSnapshot, resetDomState } from './_helpers/dom-stub.mjs';
import { createAmbientFX } from '../AmbientFX.js';

const N_CYCLES = 100;


// ─── Tracker + kernels shared across every cycle ─────────────────────────────

const _findings = [];
const _warnings = [];

const tracker = createLeakTracker({
    name: 'ambient-fx-lifecycle',
    onFinding: (f) => _findings.push(f),
    // Warnings fire at set-time for no-owner allocations. Ambient-fx sets its
    // timers/listeners outside a lite-signal owner context (it's not a
    // reactive library), so we want warnOnNoOwner: false on every kernel.
    onWarning: (w) => _warnings.push(w),
});

const uninstallers = [
    tracker.registerKernel(createTimerOrphanKernel({ warnOnNoOwner: false })),
    tracker.registerKernel(createListenerOrphanKernel({ warnOnNoOwner: false })),
    tracker.registerKernel(createObserverOrphanKernel({ warnOnNoOwner: false })),
    tracker.registerKernel(createAsyncRetentionKernel({ warnOnNoOwner: false })),
];


// ─── Test 1: single mount/destroy — DOM returns to baseline ──────────────────

test('single mount+destroy: DOM state returns to baseline', () => {
    _findings.length = 0;
    const before = domSnapshot();

    const canvas = makeCanvas(400, 300);
    const fx = createAmbientFX(canvas, { theme: 'Fire' });
    const during = domSnapshot();
    fx.destroy();

    // We're allowed to have MORE state during the instance's life, but
    // strictly-equal to baseline once destroyed.
    const after = domSnapshot();
    assert.deepEqual(after, before,
        `destroy() left DOM state above baseline:\n` +
        `  before:  ${JSON.stringify(before)}\n` +
        `  during:  ${JSON.stringify(during)}\n` +
        `  after:   ${JSON.stringify(after)}\n` +
        `Delta ${JSON.stringify(_diff(before, after))}. See CHANGES for which resource(s) leaked.`);
});


// ─── Test 2: N cycles — bounded growth ───────────────────────────────────────

test(`${N_CYCLES} mount+destroy cycles: DOM state stays at baseline`, () => {
    _findings.length = 0;
    const baseline = domSnapshot();

    for (let i = 0; i < N_CYCLES; i++) {
        const canvas = makeCanvas(400, 300);
        const fx = createAmbientFX(canvas, { theme: (i & 1) ? 'Night' : 'Fire' });
        fx.destroy();
    }

    const final = domSnapshot();
    assert.deepEqual(final, baseline,
        `after ${N_CYCLES} cycles, DOM state grew:\n` +
        `  baseline: ${JSON.stringify(baseline)}\n` +
        `  final:    ${JSON.stringify(final)}\n` +
        `Delta:      ${JSON.stringify(_diff(baseline, final))}`);
});


// ─── Test 3: kernel audit — no findings across N cycles ──────────────────────

test(`${N_CYCLES} mount+destroy cycles: tracker.audit() returns empty`, () => {
    _findings.length = 0;

    for (let i = 0; i < N_CYCLES; i++) {
        const canvas = makeCanvas(400, 300);
        const fx = createAmbientFX(canvas, { theme: 'Fire' });
        fx.destroy();
    }

    const auditFindings = tracker.audit();
    assert.equal(auditFindings.length, 0,
        `tracker.audit() reported ${auditFindings.length} findings after ${N_CYCLES} cycles:\n` +
        auditFindings.slice(0, 10).map((f, i) =>
            `  [${i}] ${f.kind} reason=${f.reason} tag=${JSON.stringify(f.tag)}`
        ).join('\n') +
        (auditFindings.length > 10 ? `\n  ...and ${auditFindings.length - 10} more` : ''));
});


// ─── Test 4: destroy on already-destroyed is idempotent ──────────────────────

test('destroy() is idempotent — double-destroy does not leak or throw', () => {
    _findings.length = 0;
    const baseline = domSnapshot();

    const canvas = makeCanvas(400, 300);
    const fx = createAmbientFX(canvas, { theme: 'Fire' });
    fx.destroy();
    assert.doesNotThrow(() => fx.destroy(), 'second destroy() should not throw');

    const after = domSnapshot();
    assert.deepEqual(after, baseline, `double-destroy grew DOM state: ${JSON.stringify(_diff(baseline, after))}`);
});


// ─── Test 5: theme swap during life doesn't leak listeners ───────────────────

test('setTheme during life: listeners do not accumulate', () => {
    _findings.length = 0;
    const before = domSnapshot();

    const canvas = makeCanvas(400, 300);
    const fx = createAmbientFX(canvas, { theme: 'Fire' });

    // 20 theme swaps
    for (let i = 0; i < 20; i++) {
        fx.setTheme(i & 1 ? 'Night' : 'Fire');
    }

    const midway = domSnapshot();
    fx.destroy();
    const after = domSnapshot();

    assert.deepEqual(after, before,
        `theme swaps grew retained state:\n` +
        `  before:  ${JSON.stringify(before)}\n` +
        `  midway:  ${JSON.stringify(midway)}\n` +
        `  after:   ${JSON.stringify(after)}`);
});


// ─── Utility ─────────────────────────────────────────────────────────────────

function _diff(a, b) {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        if (a[k] !== b[k]) out[k] = { was: a[k], now: b[k] };
    }
    return out;
}


// ─── Teardown ────────────────────────────────────────────────────────────────

test('teardown: uninstall kernels', () => {
    for (const off of uninstallers) off();
    resetDomState();
});
