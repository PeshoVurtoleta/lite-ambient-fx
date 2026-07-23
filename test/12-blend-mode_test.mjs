// @zakkster/lite-ambient-fx -- v1.5.0 blendMode tests
// Verifies validateConfig accepts/rejects blendMode values and that shipped
// v1.5.0 themes declare valid ones.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { THEMES, validateConfig, mergeThemeConfig, VERSION } from '../AmbientFX.js';


const VALID = new Set([
    'source-over', 'lighter', 'screen', 'multiply', 'overlay',
    'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light',
    'soft-light', 'difference', 'exclusion', 'hue', 'saturation',
    'color', 'luminosity',
]);


describe('validateConfig: blendMode', () => {
    test('accepts every canonical blend mode', () => {
        const base = { ...THEMES.Fire };
        for (const m of VALID) {
            assert.doesNotThrow(
                () => validateConfig({ ...base, blendMode: m }),
                `expected blendMode="${m}" to validate`,
            );
        }
    });

    test('accepts an undefined blendMode (backward compat)', () => {
        const base = { ...THEMES.Fire };
        delete base.blendMode;
        assert.doesNotThrow(() => validateConfig(base));
    });

    test('rejects a typoed blendMode with a helpful error', () => {
        const base = { ...THEMES.Fire };
        assert.throws(
            () => validateConfig({ ...base, blendMode: 'scrren' }),
            /blendMode must be one of/,
        );
    });

    test('rejects non-string blendMode', () => {
        const base = { ...THEMES.Fire };
        assert.throws(() => validateConfig({ ...base, blendMode: 42 }));
        assert.throws(() => validateConfig({ ...base, blendMode: null }));
    });
});


describe('shipped v1.5.0 themes: blendMode is set and valid', () => {
    const v15 = ['MoltenGold', 'ShadowWisp', 'Stardust', 'NeonGlitch', 'SolarFlare', 'ToxicBubble'];

    for (const name of v15) {
        test(`${name} declares a valid blendMode`, () => {
            const t = THEMES[name];
            assert.ok(t, `theme ${name} not in registry`);
            assert.equal(typeof t.blendMode, 'string');
            assert.ok(VALID.has(t.blendMode), `${name}.blendMode "${t.blendMode}" is not canonical`);
        });
    }
});


describe('mergeThemeConfig preserves blendMode overrides', () => {
    test('override wins over the theme default', () => {
        const merged = mergeThemeConfig(THEMES.MoltenGold, { blendMode: 'lighter' });
        assert.equal(merged.blendMode, 'lighter');
    });

    test('omitting the override keeps the theme default', () => {
        const merged = mergeThemeConfig(THEMES.MoltenGold, { count: 42 });
        assert.equal(merged.blendMode, 'screen');
    });

    test('empty overrides keep the theme default', () => {
        const merged = mergeThemeConfig(THEMES.MoltenGold, {});
        assert.equal(merged.blendMode, 'screen');
    });
});


test('VERSION reports 1.5.x or higher', () => {
    const [maj, min] = VERSION.split('.').map(Number);
    assert.ok(maj > 1 || (maj === 1 && min >= 5),
        `expected >=1.5.0, got ${VERSION}`);
});
