// Execute the production worklet payload in a separate JS realm, as Worklets
// does on the UI thread. Jest's Reanimated mock calls the ordinary JS function
// and cannot detect a default parameter reading a closure before hydration.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const babel = require('@babel/core');

const appRoot = resolve(__dirname, '..');
const preset = require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] });
const modules = new Map();
function loadCompiled(relativePath) {
  const filename = resolve(appRoot, relativePath);
  if (modules.has(filename)) return modules.get(filename);
  const source = readFileSync(filename, 'utf8');
  const { code } = babel.transformSync(source, {
    filename, presets: [preset], babelrc: false, configFile: false,
    caller: { name: 'metro', platform: 'ios', isDev: false, isServer: false,
      isReactServer: false, supportsStaticESM: false },
  });
  const exported = {};
  modules.set(filename, exported);
  const localRequire = (name) => name.startsWith('.')
    ? loadCompiled(require('node:path').relative(appRoot, resolve(require('node:path').dirname(filename), `${name}.ts`)))
    : require(name);
  vm.runInNewContext(code, { exports: exported, require: localRequire, global, Error }, { filename });
  return exported;
}

const restored = new Map();
function onUI(value) {
  if (restored.has(value)) return restored.get(value);
  if (typeof value === 'function') {
    assert.ok(value.__workletHash, `UI helper ${value.name} must be workletized`);
    // There are no module-scope constants in this realm. They must be read
    // from __closure inside the body, after default parameters evaluate.
    const fn = vm.runInNewContext(`(${value.__initData.code})`, {});
    const closure = {};
    const callable = (...args) => fn.apply({ __closure: closure }, args);
    restored.set(value, callable);
    for (const [name, captured] of Object.entries(value.__closure)) closure[name] = onUI(captured);
    return callable;
  }
  if (Array.isArray(value)) return value.map(onUI);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, onUI(v)]));
  return value;
}
const motion = loadCompiled('src/baku/motion.ts');
const transport = loadCompiled('src/baku/transport.ts');

test('native animation defaults work on the first result frame', () => {
  assert.equal(onUI(motion.anticipationAt)(0), 2.5);
  assert.equal(onUI(motion.durationFor)(0), 4.2);
  assert.equal(onUI(motion.coatFillAt)(0, 0), 0);
  assert.equal(onUI(motion.poseAt)(0, null).beat, 'notice');
  assert.equal(onUI(motion.poseAt)(.8, 0).beat, 'inhale');
});

test('real compiled helpers run with early and late palettes through every beat', () => {
  for (const readyAt of [null, 0, 3, 8]) {
    for (const time of [0, .8, 1.5, 2.9, 3.24, 4.2, 8.8, 10.05]) {
      const pose = onUI(motion.poseAt)(time, readyAt);
      assert.equal(pose.beat, motion.poseAt(time, readyAt).beat);
      for (const point of [{ x: .203, y: .744 }, { x: .55, y: .61 }, { x: 0, y: 0 }, { x: 1, y: 1 }]) {
        const warped = onUI(motion.deform)(point.x, point.y, pose);
        assert.ok(Number.isFinite(warped.x) && Number.isFinite(warped.y));
      }
      const baku = { x: 118, y: 280, width: 280 };
      const target = { x: 85, y: 440 };
      const ribbon = onUI(transport.inhaleRibbon)(time, readyAt, target, baku, 0);
      assert.ok(Number.isFinite(ribbon.opacity));
      const flight = onUI(transport.chipFlight)(time, readyAt ?? -1, baku, target, 0);
      assert.ok(Number.isFinite(flight.x) && Number.isFinite(flight.scale));
    }
  }
});

test('caller-supplied choreography still overrides the default', () => {
  const timing = { ...motion.TIMING, inhale: 2, chew: 2 };
  assert.equal(onUI(motion.anticipationAt)(0, timing), 4);
  assert.equal(onUI(motion.durationFor)(0, timing), motion.durationFor(0, timing));
});

const hostMotion = loadCompiled('src/baku/host-motion.ts');
test('intake and balloon worklets execute with hydrated native closures', () => {
  const origin = { x: 118, y: 410, width: 280 }, target = { x: 10, y: 754, width: 72 };
  for (const time of [0, .5, 4, 8, 10, 12]) {
    const pose = onUI(motion.performancePoseAt)(time, 8, time, time < 1 ? 1 : 0);
    assert.ok(Number.isFinite(pose.trunkFlare));
    const dust = onUI(hostMotion.intakeDust)(time, .5, 3, { x: 180, y: 300 }, origin, time, 8);
    assert.ok(Number.isFinite(dust.x) && Number.isFinite(dust.opacity));
    const flight = onUI(hostMotion.balloonFlight)(time, 8, origin, target, .2, { width: 390, height: 844 });
    assert.ok(Number.isFinite(flight.x) && Number.isFinite(flight.scale));
  }
  assert.equal(onUI(hostMotion.hostDurationFor)(8), hostMotion.hostDurationFor(8));
});
