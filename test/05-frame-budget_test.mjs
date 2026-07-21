// @zakkster/lite-ambient-fx -- v1.4.0 frame-budget tests
// Pure state-machine tests. No DOM. No worker.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createFrameBudget, VERSION } from '../AmbientFX.js';


describe('createFrameBudget: construction', () => {
    test('rejects invalid targetMs', () => {
        assert.throws(() => createFrameBudget({ targetMs: 0 }));
        assert.throws(() => createFrameBudget({ targetMs: -5 }));
    });

    test('rejects restoreMs outside (0, targetMs)', () => {
        assert.throws(() => createFrameBudget({ targetMs: 20, restoreMs: 0 }));
        assert.throws(() => createFrameBudget({ targetMs: 20, restoreMs: 20 }));
        assert.throws(() => createFrameBudget({ targetMs: 20, restoreMs: 25 }));
    });

    test('defaults are sensible', () => {
        const b = createFrameBudget();
        assert.equal(b.targetMs, 20);
        assert.equal(b.restoreMs, 14);
        assert.equal(b.minCount, 20);
        assert.equal(b.baseCount, 0);
        assert.equal(b.currentCount, 0);
        assert.equal(b.windowFilled, false);
    });
});


describe('createFrameBudget: no-op paths', () => {
    test('note returns -1 while the window is filling', () => {
        const b = createFrameBudget({ targetMs: 20, restoreMs: 14, cooldown: 0, minCount: 10 });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 20; i++) {
            const n = b.note(50, count);
            assert.equal(n, -1, `frame ${i}`);
        }
        assert.equal(b.windowFilled, false);
    });

    test('healthy frames never trigger degrade', () => {
        let events = 0;
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
            onDegrade: () => events++,
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 200; i++) {
            const n = b.note(16, count);
            if (n >= 0) count = n;
        }
        assert.equal(count, 100);
        assert.equal(events, 0);
    });
});


describe('createFrameBudget: degrade path', () => {
    test('over-budget frames step count down toward the floor', () => {
        const events = [];
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
            onDegrade: e => events.push(e),
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 200; i++) {
            const n = b.note(25, count);
            if (n >= 0) count = n;
        }
        // At 10% steps from base=100 -> 90, 80, 70, 60, 50, 40, 30, 20, 10.
        assert.equal(count, 10);
        assert.ok(events.length >= 8);
        assert.equal(events[0].from, 100);
        assert.equal(events[0].to,    90);
        assert.equal(events[0].reason, 'over-budget');
        assert.equal(events[0].p90, 25);
    });

    test('degrade respects minCount as a floor', () => {
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 40,
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 500; i++) {
            const n = b.note(80, count);
            if (n >= 0) count = n;
        }
        assert.equal(count, 40);
    });

    test('cooldown enforces spacing between adjustments', () => {
        const events = [];
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 60, minCount: 10,
            onDegrade: e => events.push(e),
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 32; i++) {
            const n = b.note(25, count);
            if (n >= 0) count = n;
        }
        assert.ok(events.length <= 1);

        const before = events.length;
        for (let i = 0; i < 30; i++) {
            const n = b.note(25, count);
            if (n >= 0) count = n;
        }
        assert.equal(events.length, before, 'no adjustments during cooldown');
    });
});


describe('createFrameBudget: restore path', () => {
    test('recovered frames step count back up toward baseCount', () => {
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
        });
        b.setBaseCount(100);
        let count = 100;

        for (let i = 0; i < 200; i++) {
            const n = b.note(30, count);
            if (n >= 0) count = n;
        }
        assert.ok(count < 100);

        for (let i = 0; i < 200; i++) {
            const n = b.note(10, count);
            if (n >= 0) count = n;
        }
        assert.equal(count, 100);
    });

    test('restore does not exceed baseCount', () => {
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
        });
        b.setBaseCount(50);
        let count = 50;
        for (let i = 0; i < 500; i++) {
            const n = b.note(5, count);
            if (n >= 0) count = n;
        }
        assert.equal(count, 50);
    });

    test('restore reason is emitted on the up-step', () => {
        const events = [];
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
            onDegrade: e => events.push(e),
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 200; i++) { const n = b.note(30, count); if (n >= 0) count = n; }
        for (let i = 0; i < 200; i++) { const n = b.note(10, count); if (n >= 0) count = n; }

        const restoreEvents = events.filter(e => e.reason === 'restore');
        assert.ok(restoreEvents.length >= 1);
        assert.equal(restoreEvents[0].p90, 10);
    });
});


describe('createFrameBudget: state manipulation', () => {
    test('setBaseCount updates the restore ceiling live', () => {
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
        });
        b.setBaseCount(100);
        let count = 100;

        for (let i = 0; i < 200; i++) { const n = b.note(30, count); if (n >= 0) count = n; }
        b.setBaseCount(200);
        for (let i = 0; i < 500; i++) { const n = b.note(8, count); if (n >= 0) count = n; }

        assert.ok(count > 100);
        assert.ok(count <= 200);
    });

    test('reset clears the window and cooldown', () => {
        const events = [];
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
            onDegrade: e => events.push(e),
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 60; i++) { const n = b.note(30, count); if (n >= 0) count = n; }
        assert.ok(b.windowFilled);

        b.reset();
        assert.equal(b.windowFilled, false);

        const before = events.length;
        for (let i = 0; i < 31; i++) { const n = b.note(30, count); if (n >= 0) count = n; }
        assert.equal(events.length, before);
    });
});


describe('createFrameBudget: no-alloc contract (soft)', () => {
    test('healthy 10k samples produce zero onDegrade calls', () => {
        let events = 0;
        const b = createFrameBudget({
            targetMs: 20, restoreMs: 14, cooldown: 4, minCount: 10,
            onDegrade: () => events++,
        });
        b.setBaseCount(100);
        let count = 100;
        for (let i = 0; i < 10000; i++) {
            const n = b.note(16, count);
            if (n >= 0) count = n;
        }
        assert.equal(events, 0);
        assert.equal(count, 100);
    });
});


test('VERSION reports 1.4.x or higher', () => {
    const [maj, min] = VERSION.split('.').map(Number);
    assert.ok(maj > 1 || (maj === 1 && min >= 4),
        `expected >=1.4.0, got ${VERSION}`);
});
