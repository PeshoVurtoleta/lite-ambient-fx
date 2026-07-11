/**
 * Config surface: THEMES shape, mergeThemeConfig, validateConfig,
 * sinLut wrap, envelopeAlpha curves, VERSION parity.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The main file assumes a DOM. We only import the pure helpers here; canvas-
// backed pieces stay untested at the unit level and get exercised by the
// demo. The pure helpers are stateless and safe to import in Node.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'AmbientFX.js'), 'utf8');

// Load in a stripped Node context. The module top level touches document
// only inside function bodies, so the import itself is DOM-free.
const {
    VERSION,
    THEMES,
    THEME_META,
    mergeThemeConfig,
    validateConfig,
    deltaScale,
    sinLut,
    envelopeAlpha,
} = await import('../AmbientFX.js');

describe('VERSION parity', () => {
    test('exported VERSION matches package.json', () => {
        const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
        assert.equal(VERSION, pkg.version);
    });

    test('VERSION appears verbatim in the source', () => {
        assert.ok(src.includes("VERSION = '" + VERSION + "'"));
    });
});

describe('THEMES surface', () => {
    const NAMES = ['Fire', 'Night', 'Ice', 'Frost', 'Toxic', 'Void'];

    test('exactly six themes ship', () => {
        assert.deepEqual(Object.keys(THEMES).sort(), NAMES.slice().sort());
    });

    test('every theme is a valid config', () => {
        for (const name of NAMES) {
            assert.doesNotThrow(() => validateConfig(THEMES[name]), 'theme ' + name);
        }
    });

    test('every theme has the full behavior/palette shape', () => {
        for (const name of NAMES) {
            const t = THEMES[name];
            assert.ok(['EMBER', 'MIST', 'FLOAT', 'CHAOS'].includes(t.behavior), name);
            assert.ok(Array.isArray(t.colors) && t.colors.length >= 1, name);
            assert.equal(typeof t.spark, 'string', name);
            assert.equal(typeof t.wind.x, 'number', name);
            assert.equal(typeof t.wind.y, 'number', name);
        }
    });

    test('THEME_META covers every theme with a matching behavior', () => {
        assert.equal(THEME_META.length, NAMES.length);
        for (const m of THEME_META) {
            assert.ok(THEMES[m.id], 'meta id ' + m.id);
            assert.equal(THEMES[m.id].behavior, m.behavior, 'meta behavior ' + m.id);
        }
    });

    test('cross-behavior coverage: every behavior appears', () => {
        const seen = new Set();
        for (const name of NAMES) seen.add(THEMES[name].behavior);
        assert.deepEqual(Array.from(seen).sort(), ['CHAOS', 'EMBER', 'FLOAT', 'MIST']);
    });
});

describe('mergeThemeConfig', () => {
    test('clones wind so callers cannot mutate the base', () => {
        const base = THEMES.Fire;
        const merged = mergeThemeConfig(base, null);
        merged.wind.x = 999;
        assert.notEqual(base.wind.x, 999);
    });

    test('shallow-merges wind partials', () => {
        const merged = mergeThemeConfig(THEMES.Fire, { wind: { x: 1 } });
        assert.equal(merged.wind.x, 1);
        assert.equal(merged.wind.y, THEMES.Fire.wind.y);
    });

    test('overrides scalar fields', () => {
        const merged = mergeThemeConfig(THEMES.Fire, { count: 42, alpha: 0.5 });
        assert.equal(merged.count, 42);
        assert.equal(merged.alpha, 0.5);
        assert.equal(merged.behavior, 'EMBER');
    });

    test('replaces colors array in full when overridden', () => {
        const merged = mergeThemeConfig(THEMES.Fire, { colors: ['#000'] });
        assert.deepEqual(merged.colors, ['#000']);
    });
});

describe('validateConfig', () => {
    test('accepts a valid config', () => {
        assert.doesNotThrow(() => validateConfig(THEMES.Void));
    });

    test('rejects null and non-objects', () => {
        assert.throws(() => validateConfig(null), TypeError);
        assert.throws(() => validateConfig('nope'), TypeError);
    });

    test('rejects unknown behavior', () => {
        const bad = { ...THEMES.Fire, behavior: 'SPARKLE' };
        assert.throws(() => validateConfig(bad), RangeError);
    });

    test('rejects empty colors', () => {
        const bad = { ...THEMES.Fire, colors: [] };
        assert.throws(() => validateConfig(bad), TypeError);
    });

    test('rejects non-integer count', () => {
        const bad = { ...THEMES.Fire, count: 3.14 };
        assert.throws(() => validateConfig(bad), RangeError);
    });

    test('rejects negative count', () => {
        const bad = { ...THEMES.Fire, count: -1 };
        assert.throws(() => validateConfig(bad), RangeError);
    });

    test('rejects alpha outside [0,1]', () => {
        assert.throws(() => validateConfig({ ...THEMES.Fire, alpha: -0.1 }), RangeError);
        assert.throws(() => validateConfig({ ...THEMES.Fire, alpha: 1.5 }), RangeError);
    });
});

describe('deltaScale', () => {
    test('is 1 at the 60fps reference', () => {
        assert.equal(deltaScale(16), 1);
    });

    test('scales linearly', () => {
        assert.equal(deltaScale(32), 2);
        assert.equal(deltaScale(8), 0.5);
    });
});

describe('sinLut', () => {
    test('index 0 is 0', () => {
        assert.equal(sinLut(0), 0);
    });

    test('index 90 is 1 (within Float32 precision)', () => {
        assert.ok(Math.abs(sinLut(90) - 1) < 1e-6);
    });

    test('wraps negative indices without NaN', () => {
        assert.ok(!Number.isNaN(sinLut(-1)));
        assert.ok(!Number.isNaN(sinLut(-720)));
    });

    test('agrees with Math.sin at unit indices, mod float error', () => {
        for (const i of [0, 30, 45, 60, 90, 180, 270, 359]) {
            const lut = sinLut(i);
            const real = Math.sin(i * (Math.PI / 180));
            assert.ok(Math.abs(lut - real) < 1e-6, 'i=' + i);
        }
    });

    test('is stable across the mod-360 boundary', () => {
        assert.equal(sinLut(0), sinLut(360));
        assert.equal(sinLut(1), sinLut(361));
    });
});

describe('envelopeAlpha -- EMBER curve', () => {
    test('is zero at life=0', () => {
        assert.equal(envelopeAlpha('EMBER', 0, 1), 0);
    });

    test('peaks at life=0.2 (transition point)', () => {
        assert.ok(Math.abs(envelopeAlpha('EMBER', 0.2, 1) - 1) < 1e-9);
    });

    test('fades to zero at life=1', () => {
        assert.ok(Math.abs(envelopeAlpha('EMBER', 1, 1)) < 1e-9);
    });

    test('respects maxAlpha as amplitude', () => {
        assert.ok(Math.abs(envelopeAlpha('EMBER', 0.2, 0.5) - 0.5) < 1e-9);
    });

    test('is continuous around the transition', () => {
        const before = envelopeAlpha('EMBER', 0.199, 1);
        const after = envelopeAlpha('EMBER', 0.201, 1);
        assert.ok(Math.abs(before - after) < 0.02);
    });
});

describe('envelopeAlpha -- FLOAT curve', () => {
    test('fade-in slope 0..0.1', () => {
        assert.ok(Math.abs(envelopeAlpha('FLOAT', 0.05, 1) - 0.5) < 1e-9);
    });

    test('sustains at maxAlpha in 0.1..0.9', () => {
        assert.equal(envelopeAlpha('FLOAT', 0.3, 1), 1);
        assert.equal(envelopeAlpha('FLOAT', 0.5, 1), 1);
        assert.equal(envelopeAlpha('FLOAT', 0.8, 1), 1);
    });

    test('fade-out slope 0.9..1', () => {
        assert.ok(Math.abs(envelopeAlpha('FLOAT', 0.95, 1) - 0.5) < 1e-9);
    });
});

describe('envelopeAlpha -- MIST and CHAOS pass through', () => {
    test('MIST returns maxAlpha untouched (shaped elsewhere)', () => {
        assert.equal(envelopeAlpha('MIST', 0.5, 0.7), 0.7);
    });

    test('CHAOS returns maxAlpha untouched (shaped elsewhere)', () => {
        assert.equal(envelopeAlpha('CHAOS', 0.5, 0.9), 0.9);
    });
});
