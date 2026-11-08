import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_STEP_PROGRESS,
  CLASSIC_PROGRESS_CONFIG,
  calculateDestinationProgress,
  isOuterTrackProgress,
  positionFromStepProgress,
  progressConfigForState,
  progressToHomeIndex,
} from '../src/game-progress.js';
import { createClassicState } from '../apps/backend/classic-engine.js';
import { createExtendedState } from '../apps/backend/universal-engine.js';
import { getPlayableGeometry } from '../src/game-geometries.js';

const cases = [
  ['CLASSIC', CLASSIC_PROGRESS_CONFIG, 4, ['blue','red','yellow','green']],
  ['HEXA', { mode:'HEXA', trackLength:72, maxOuterSteps:71, homeCells:6, finishStep:78 }, 6, null],
  ['ROYAL', { mode:'ROYAL', trackLength:68, maxOuterSteps:66, homeCells:7, finishStep:74 }, 4, null],
];

function rosterFor(mode, colors) {
  if (colors) return colors.map((color,index)=>({id:mode+'-'+index,username:'Player '+index,color}));
  return getPlayableGeometry(mode).arms.map((arm,index)=>({
    id:mode+'-'+index,username:'Player '+index,color:arm.player.id,
  }));
}

test('all board modes store one progress integer and no duplicated zone/step position', () => {
  for (const [mode, config, players] of cases) {
    const state = mode === 'CLASSIC'
      ? createClassicState(rosterFor(mode, cases[0][3]))
      : createExtendedState(mode, rosterFor(mode));
    assert.equal(state.players.length, players);
    for (const token of Object.values(state.tokens)) {
      assert.equal(token.stepProgress, BASE_STEP_PROGRESS);
      assert.equal(Object.hasOwn(token,'position'), false);
      assert.equal(positionFromStepProgress(token.stepProgress,config).zone,'base');
    }
  }
});

for (const [mode, config] of cases) {
  test(mode+' progress maps base, outer route, home lane and finish without gaps', () => {
    assert.equal(positionFromStepProgress(-1,config).zone,'base');
    assert.equal(positionFromStepProgress(0,config).zone,'track');
    assert.equal(positionFromStepProgress(config.maxOuterSteps,config).zone,'track');
    assert.equal(positionFromStepProgress(config.maxOuterSteps+1,config).zone,'home');
    assert.equal(positionFromStepProgress(config.finishStep-1,config).zone,'home');
    assert.equal(positionFromStepProgress(config.finishStep,config).zone,'finished');
    assert.equal(progressToHomeIndex(config.maxOuterSteps+1,config),0);
    assert.equal(progressToHomeIndex(config.finishStep-1,config),config.homeCells-1);
    assert.equal(isOuterTrackProgress(0,config),true);
    assert.equal(isOuterTrackProgress(config.maxOuterSteps,config),true);
    assert.equal(isOuterTrackProgress(config.maxOuterSteps+1,config),false);
  });

  test(mode+' progress handles base release, outer-to-home entry and exact finish', () => {
    assert.equal(calculateDestinationProgress(-1,5,config),null);
    assert.equal(calculateDestinationProgress(-1,6,config),0);
    assert.equal(calculateDestinationProgress(config.maxOuterSteps-1,1,config),config.maxOuterSteps);
    assert.equal(calculateDestinationProgress(config.maxOuterSteps,1,config),config.maxOuterSteps+1);
    assert.equal(calculateDestinationProgress(config.finishStep-1,1,config),config.finishStep);
    assert.equal(calculateDestinationProgress(config.finishStep-1,2,config),null);
    assert.equal(calculateDestinationProgress(config.finishStep,6,config),null);
  });
}

test('progress state rejects gaps, fractional values and values beyond finish', () => {
  for (const [,config] of cases) {
    for (const invalid of [-2,0.5,config.finishStep+1,Number.NaN]) {
      assert.throws(()=>positionFromStepProgress(invalid,config),/stepProgress/);
    }
  }
});
