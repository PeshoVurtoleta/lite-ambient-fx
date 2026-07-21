// @zakkster/lite-ambient-fx — v1.3.0 color pipeline tests
// DOM-free. Pure math + palette bridge + theme interpolation.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseColor,
    formatColor,
    oklchFromHex,
    hexFromOklch,
    lerpOklch,
    colorsFromPalette,
    lerpTheme,
    THEMES,
    validateConfig,
    VERSION,
} from '../AmbientFX.js';


// ─── parseColor / formatColor ────────────────────────────────────────────────

test('parseColor accepts #rrggbb and round-trips through formatColor', () => {
    const cases = [
        '#ff0000', '#00ff00', '#0000ff',
        '#ffffff', '#000000', '#7f7f7f',
        '#ff6600', '#4a90e2', '#c88a6b',
    ];
    for (const hex of cases) {
        const oklch = parseColor(hex);
        const back  = formatColor(oklch[0], oklch[1], oklch[2]);
        assert.equal(back, hex, `round-trip for ${hex}`);
    }
});

test('parseColor accepts #rgb short form', () => {
    const oklch = parseColor('#f00');
    const back  = formatColor(oklch[0], oklch[1], oklch[2]);
    assert.equal(back, '#ff0000');
});

test('parseColor accepts hex without the leading #', () => {
    const a = parseColor('ff6600');
    const b = parseColor('#ff6600');
    assert.equal(a[0], b[0]);
    assert.equal(a[1], b[1]);
    assert.equal(a[2], b[2]);
});

test('parseColor accepts oklch() literal', () => {
    const t = parseColor('oklch(0.6280 0.2577 29.23)');
    assert.ok(Math.abs(t[0] - 0.628) < 0.001);
    assert.ok(Math.abs(t[1] - 0.258) < 0.001);
    assert.ok(Math.abs(t[2] -  29.2) < 0.1);
});

test('parseColor accepts oklch() with % on L and comma separators', () => {
    const t = parseColor('oklch(62.80%, 0.2577, 29.23)');
    assert.ok(Math.abs(t[0] - 0.628) < 0.001);
});

test('parseColor writes into an out buffer without allocating', () => {
    const out = new Float64Array(3);
    const returned = parseColor('#ff6600', out);
    assert.equal(returned, out);
    assert.ok(out[0] > 0);
});

test('parseColor throws on garbage input', () => {
    assert.throws(() => parseColor('nope'));
    assert.throws(() => parseColor('#zzzzzz'));
    assert.throws(() => parseColor('oklch()'));
    assert.throws(() => parseColor(42));
});

test('oklchFromHex is a parseColor alias', () => {
    assert.equal(oklchFromHex, parseColor);
});

test('formatColor gamut-clamps out-of-gamut OKLCH', () => {
    // Absurd chroma → guaranteed out of sRGB gamut. Must still produce
    // a valid 7-char hex, not NaN.
    const hex = formatColor(0.5, 2.0, 30);
    assert.match(hex, /^#[0-9a-f]{6}$/);
});

test('hexFromOklch is a formatColor alias', () => {
    assert.equal(hexFromOklch, formatColor);
});


// ─── lerpOklch ───────────────────────────────────────────────────────────────

test('lerpOklch returns endpoints exactly at t=0 and t=1', () => {
    const a = parseColor('#ff6600');
    const b = parseColor('#4a90e2');
    const out = new Float64Array(3);

    lerpOklch(a, b, 0, out);
    assert.equal(out[0], a[0]);
    assert.equal(out[1], a[1]);
    assert.equal(out[2], a[2]);

    lerpOklch(a, b, 1, out);
    assert.equal(out[0], b[0]);
    assert.equal(out[1], b[1]);
    assert.equal(out[2], b[2]);
});

test('lerpOklch hue takes the shortest arc across 0/360', () => {
    const a = new Float64Array([0.5, 0.2, 350]);
    const b = new Float64Array([0.5, 0.2,  10]);
    const out = new Float64Array(3);

    // Shortest arc is 20° via 0°, not 340° via 180°.
    lerpOklch(a, b, 0.5, out);
    assert.ok(Math.abs(out[2] - 0) < 0.001 || Math.abs(out[2] - 360) < 0.001,
        `expected ~0° got ${out[2]}`);

    // A quarter of the way should be at 355°, not somewhere near 90°.
    lerpOklch(a, b, 0.25, out);
    assert.ok(Math.abs(out[2] - 355) < 0.001, `expected 355° got ${out[2]}`);
});

test('lerpOklch is monotonic in L and C between endpoints', () => {
    const a = new Float64Array([0.2, 0.05, 30]);
    const b = new Float64Array([0.9, 0.20, 30]);   // same hue → no wrap games
    const out = new Float64Array(3);

    let prevL = -Infinity, prevC = -Infinity;
    for (let i = 0; i <= 10; i++) {
        lerpOklch(a, b, i / 10, out);
        assert.ok(out[0] >= prevL, `L monotonic at t=${i / 10}`);
        assert.ok(out[1] >= prevC, `C monotonic at t=${i / 10}`);
        prevL = out[0];
        prevC = out[1];
    }
});

test('lerpOklch returns the same out reference passed in', () => {
    const a = new Float64Array([0.5, 0.1, 30]);
    const b = new Float64Array([0.6, 0.2, 60]);
    const out = new Float64Array(3);
    const ret = lerpOklch(a, b, 0.3, out);
    assert.equal(ret, out);
});


// ─── colorsFromPalette ───────────────────────────────────────────────────────

test('colorsFromPalette passes hex strings through unchanged', () => {
    const out = colorsFromPalette(['#ff0000', '#00ff00', '#0000ff']);
    assert.deepEqual(out, ['#ff0000', '#00ff00', '#0000ff']);
});

test('colorsFromPalette normalizes oklch() strings to hex', () => {
    const out = colorsFromPalette(['oklch(0.628 0.258 29.23)']);
    assert.equal(out.length, 1);
    assert.match(out[0], /^#[0-9a-f]{6}$/);
});

test('colorsFromPalette accepts hueforge ScaleStep shape', () => {
    // Mimics `scale.steps()` output — { step, l, c, h } — the tail-most fields
    // are the ones we care about.
    const steps = [
        { step: '400', l: 0.7, c: 0.15, h:  30 },
        { step: '700', l: 0.5, c: 0.20, h: 260 },
    ];
    const out = colorsFromPalette(steps);
    assert.equal(out.length, 2);
    assert.match(out[0], /^#[0-9a-f]{6}$/);
    assert.match(out[1], /^#[0-9a-f]{6}$/);
});

test('colorsFromPalette accepts { color } wrapper', () => {
    const out = colorsFromPalette([{ color: '#ff6600' }, { color: '#4a90e2' }]);
    assert.deepEqual(out, ['#ff6600', '#4a90e2']);
});

test('colorsFromPalette accepts [position, color] tuples', () => {
    const out = colorsFromPalette([[0, '#ff0000'], [0.5, '#00ff00'], [1, '#0000ff']]);
    assert.deepEqual(out, ['#ff0000', '#00ff00', '#0000ff']);
});

test('colorsFromPalette accepts [position, {l,c,h}] tuples', () => {
    const out = colorsFromPalette([[0, { l: 0.628, c: 0.258, h: 29.23 }]]);
    assert.equal(out.length, 1);
    assert.match(out[0], /^#[0-9a-f]{6}$/);
});

test('colorsFromPalette handles mixed shapes', () => {
    const out = colorsFromPalette([
        '#ff0000',
        { l: 0.867, c: 0.295, h: 142.5 },
        { color: '#0000ff' },
    ]);
    assert.equal(out.length, 3);
    assert.equal(out[0], '#ff0000');
    assert.match(out[1], /^#[0-9a-f]{6}$/);
    assert.equal(out[2], '#0000ff');
});

test('colorsFromPalette resamples with opts.count', () => {
    const stops = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
    const out = colorsFromPalette(stops, { count: 3 });
    assert.equal(out.length, 3);
    // First, middle-ish, last of the source array.
    assert.equal(out[0], '#ff0000');
    assert.equal(out[out.length - 1], '#ff00ff');
});

test('colorsFromPalette returns empty array on empty input', () => {
    assert.deepEqual(colorsFromPalette([]), []);
});

test('colorsFromPalette throws on non-array input', () => {
    assert.throws(() => colorsFromPalette(null));
    assert.throws(() => colorsFromPalette('#ff0000'));
});

test('colorsFromPalette throws on unknown stop shape', () => {
    assert.throws(() => colorsFromPalette([{ foo: 'bar' }]));
});

test('colorsFromPalette output is usable as AmbientConfig.colors', () => {
    const colors = colorsFromPalette([
        { l: 0.7, c: 0.15, h:  30 },
        { l: 0.5, c: 0.20, h: 260 },
    ]);
    const cfg = { ...THEMES.Fire, colors };
    assert.doesNotThrow(() => validateConfig(cfg));
});


// ─── lerpTheme ───────────────────────────────────────────────────────────────

const themeA = {
    behavior: 'EMBER',
    colors: ['#ff6600', '#ffcc00'],
    spark: '#ffff00',
    count: 100,
    wind: { x: -0.1, y: -0.2 },
    decay: 0.005,
    speed: 0.8,
    size: 6,
    alpha: 0.8,
    turbulence: 0.5,
};

const themeB = {
    behavior: 'EMBER',
    colors: ['#0066ff', '#00ccff'],
    spark: '#00ffff',
    count: 200,
    wind: { x: 0.3, y: 0.1 },
    decay: 0.010,
    speed: 1.6,
    size: 10,
    alpha: 0.4,
    turbulence: 0.9,
};

test('lerpTheme returns theme A at t=0 (scalars exact)', () => {
    const out = lerpTheme(themeA, themeB, 0);
    assert.equal(out.count, themeA.count);
    assert.equal(out.decay, themeA.decay);
    assert.equal(out.speed, themeA.speed);
    assert.equal(out.size,  themeA.size);
    assert.equal(out.alpha, themeA.alpha);
    assert.equal(out.turbulence, themeA.turbulence);
    assert.equal(out.wind.x, themeA.wind.x);
    assert.equal(out.wind.y, themeA.wind.y);
});

test('lerpTheme returns theme B at t=1 (scalars exact)', () => {
    const out = lerpTheme(themeA, themeB, 1);
    assert.equal(out.count, themeB.count);
    assert.equal(out.decay, themeB.decay);
    assert.equal(out.speed, themeB.speed);
    assert.equal(out.size,  themeB.size);
    assert.equal(out.alpha, themeB.alpha);
    assert.equal(out.turbulence, themeB.turbulence);
});

test('lerpTheme colors round-trip at endpoints', () => {
    const at0 = lerpTheme(themeA, themeB, 0);
    assert.deepEqual(at0.colors, themeA.colors);
    assert.equal(at0.spark, themeA.spark);

    const at1 = lerpTheme(themeA, themeB, 1);
    assert.deepEqual(at1.colors, themeB.colors);
    assert.equal(at1.spark, themeB.spark);
});

test('lerpTheme rounds count to nearest integer', () => {
    // 100 → 201 at t=0.5 = 150.5 → 151 (banker's round would give 150,
    // but Math.round does half-away-from-zero → 151). Either is acceptable
    // as long as it's an integer.
    const out = lerpTheme(themeA, { ...themeB, count: 201 }, 0.5);
    assert.equal(Number.isInteger(out.count), true);
    assert.ok(out.count === 150 || out.count === 151);
});

test('lerpTheme clamps t to [0, 1]', () => {
    const under = lerpTheme(themeA, themeB, -0.5);
    assert.deepEqual(under.colors, themeA.colors);
    const over  = lerpTheme(themeA, themeB, 1.5);
    assert.deepEqual(over.colors, themeB.colors);
});

test('lerpTheme output validates as an AmbientConfig', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const cfg = lerpTheme(themeA, themeB, t);
        assert.doesNotThrow(() => validateConfig(cfg), `t=${t}`);
    }
});

test('lerpTheme reuses the out object across calls (zero-alloc slot)', () => {
    const scratch = { colors: [], wind: { x: 0, y: 0 } };
    const r1 = lerpTheme(themeA, themeB, 0.25, scratch);
    assert.equal(r1, scratch);

    const colorsRef = scratch.colors;
    const windRef   = scratch.wind;

    const r2 = lerpTheme(themeA, themeB, 0.75, scratch);
    assert.equal(r2, scratch);
    assert.equal(scratch.colors, colorsRef, 'colors array reused');
    assert.equal(scratch.wind,   windRef,   'wind object reused');
});

test('lerpTheme steps behavior at t=0.5 when they differ', () => {
    const misty = { ...themeB, behavior: 'MIST' };

    const before = lerpTheme(themeA, misty, 0.49);
    const after  = lerpTheme(themeA, misty, 0.51);
    assert.equal(before.behavior, 'EMBER');
    assert.equal(after.behavior,  'MIST');
});

test('lerpTheme discrete v1.2 fields step at t=0.5', () => {
    const withDepth = { ...themeB, depthBands: 3 };

    const before = lerpTheme(themeA, withDepth, 0.25);
    const after  = lerpTheme(themeA, withDepth, 0.75);
    assert.equal(before.depthBands, undefined);
    assert.equal(after.depthBands, 3);
});

test('lerpTheme handles color arrays of different lengths (truncates to min)', () => {
    const shorter = { ...themeA, colors: ['#ff0000'] };
    const longer  = { ...themeB, colors: ['#0000ff', '#00ffff', '#00ff00'] };

    const out = lerpTheme(shorter, longer, 0.5);
    assert.equal(out.colors.length, 1);
});

test('lerpTheme wind vector interpolates linearly', () => {
    const out = lerpTheme(themeA, themeB, 0.5);
    // (a.wind.x + b.wind.x) / 2 = (-0.1 + 0.3) / 2 = 0.1
    // (a.wind.y + b.wind.y) / 2 = (-0.2 + 0.1) / 2 = -0.05
    assert.ok(Math.abs(out.wind.x -  0.1)  < 1e-9);
    assert.ok(Math.abs(out.wind.y - -0.05) < 1e-9);
});

test('lerpTheme with THEMES endpoints — day/night recipe smoke test', () => {
    const night = THEMES.Night;
    const fire  = THEMES.Fire;
    if (!night || !fire) return;   // skip if the built-ins aren't loaded

    const scratch = { colors: [], wind: { x: 0, y: 0 } };
    for (let i = 0; i <= 32; i++) {
        const cfg = lerpTheme(night, fire, i / 32, scratch);
        assert.doesNotThrow(() => validateConfig(cfg), `frame ${i}`);
        for (const c of cfg.colors) {
            assert.match(c, /^#[0-9a-f]{6}$/, `frame ${i} color: ${c}`);
        }
    }
});


// ─── Determinism — same inputs must produce identical outputs ────────────────

test('lerpTheme is deterministic: same (a, b, t) → byte-identical output', () => {
    // Sprite-cache growth is bounded only if identical t values produce
    // identical hex. Any drift (e.g. accumulated float error from a mutable
    // scratch) would silently balloon the cache.
    const scratch1 = { colors: [], wind: { x: 0, y: 0 } };
    const scratch2 = { colors: [], wind: { x: 0, y: 0 } };
    const samples = [0, 0.1, 0.25, 0.333, 0.5, 0.618, 0.75, 0.9, 1];

    for (const t of samples) {
        lerpTheme(themeA, themeB, t, scratch1);
        const snapshot1 = scratch1.colors.slice();
        const snapSpark1 = scratch1.spark;

        // Perturb, then come back — result must be identical.
        lerpTheme(themeA, themeB, 1 - t, scratch2);
        lerpTheme(themeA, themeB, t, scratch2);
        assert.deepEqual(scratch2.colors, snapshot1, `colors drift at t=${t}`);
        assert.equal(scratch2.spark, snapSpark1, `spark drift at t=${t}`);
    }
});


// ─── VERSION gate ────────────────────────────────────────────────────────────

test('VERSION reports 1.3.x or higher', () => {
    const [maj, min] = VERSION.split('.').map(Number);
    assert.ok(maj > 1 || (maj === 1 && min >= 3),
        `expected >=1.3.0, got ${VERSION}`);
});
