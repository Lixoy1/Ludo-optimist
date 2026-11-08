import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalState, extendedGlobalTrackIndex, rollUniversalDice, applyUniversalMove, assertUniversalState } from '../apps/backend/universal-engine.js';
import { globalTrackIndex as classicGlobalTrackIndex } from '../apps/backend/classic-engine.js';
import { getPlayableGeometry } from '../src/game-geometries.js';
import { progressConfigForState, positionFromStepProgress } from '../src/game-progress.js';

const modes = [
  { mode:'CLASSIC', players:2, colors:['blue','red'], trackLength:52, maxOuterSteps:50, homeCells:5, finishStep:56 },
  { mode:'HEXA', players:6, trackLength:72, maxOuterSteps:71, homeCells:6, finishStep:78 },
];

function makeRoster(spec) {
  if (spec.colors) return spec.colors.map((color,index)=>({
    id:spec.mode.toLowerCase()+'-'+index,username:'Player '+index,color,
  }));
  return getPlayableGeometry(spec.mode).arms.map((arm,index)=>({
    id:spec.mode.toLowerCase()+'-'+index,username:'Player '+index,color:arm.player.id,
  }));
}
function makeState(spec) {
  return createUniversalState(spec.mode,makeRoster(spec));
}
function tokenId(playerId,index=0) { return playerId+':'+index; }

for (const spec of modes) {
  test(spec.mode+' engine maps every player local outer progress to a unique global route cell',()=>{
    const state=makeState(spec);
    assert.equal(state.players.length,spec.players);
    assert.equal(state.trackLength,spec.trackLength);
    for(const player of state.players) {
      const indexes=Array.from({length:spec.maxOuterSteps+1},(_,step)=>
        state.mode==='CLASSIC'
          ? classicGlobalTrackIndex(player.color,step)
          : extendedGlobalTrackIndex(state,player,step)
      );
      assert.equal(new Set(indexes).size,indexes.length);
      assert.ok(indexes.every(index=>Number.isInteger(index)&&index>=0&&index<spec.trackLength));
    }
  });

  test(spec.mode+' engine transitions from final outer cell into first home cell exactly once',()=>{
    const state=makeState(spec);
    const player=state.players[0],id=tokenId(player.id);
    state.tokens[id].stepProgress=spec.maxOuterSteps;
    state.currentPlayer=player.id;
    const rolled=rollUniversalDice(state,player.id,1);
    assert.deepEqual(rolled.legalTokenIds,[id]);
    const moved=applyUniversalMove(rolled.state,player.id,id);
    assert.equal(moved.state.tokens[id].stepProgress,spec.maxOuterSteps+1);
    assert.equal(moved.state.lastAction.fromProgress,spec.maxOuterSteps);
    assert.equal(moved.state.lastAction.toProgress,spec.maxOuterSteps+1);
    assert.equal(moved.state.lastAction.from.zone,'track');
    assert.equal(moved.state.lastAction.to.zone,'home');
    assert.equal(moved.state.lastAction.to.step,spec.maxOuterSteps+1);
    assert.equal(positionFromStepProgress(moved.state.tokens[id].stepProgress,progressConfigForState(moved.state)).zone,'home');
    assert.equal(assertUniversalState(moved.state),true);
  });

  test(spec.mode+' engine rejects an overshoot from the final home cell',()=>{
    const state=makeState(spec);
    const player=state.players[0],id=tokenId(player.id);
    state.tokens[id].stepProgress=spec.finishStep-1;
    state.currentPlayer=player.id;
    const rolled=rollUniversalDice(state,player.id,2);
    assert.deepEqual(rolled.legalTokenIds,[]);
    assert.equal(rolled.state.dice,null);
    assert.equal(rolled.turnAdvanced,true);
    assert.equal(state.tokens[id].stepProgress,spec.finishStep-1);
  });

  test(spec.mode+' engine finishes a token only on an exact roll and records progress transition',()=>{
    const state=makeState(spec);
    const player=state.players[0],id=tokenId(player.id);
    state.tokens[id].stepProgress=spec.finishStep-1;
    state.currentPlayer=player.id;
    const rolled=rollUniversalDice(state,player.id,1);
    const moved=applyUniversalMove(rolled.state,player.id,id);
    assert.equal(moved.state.tokens[id].stepProgress,spec.finishStep);
    assert.equal(moved.state.lastAction.from.zone,'home');
    assert.equal(moved.state.lastAction.to.zone,'finished');
    assert.equal(moved.state.lastAction.fromProgress,spec.finishStep-1);
    assert.equal(moved.state.lastAction.toProgress,spec.finishStep);
    assert.equal(moved.state.phase,'playing');
    assert.equal(moved.bonusRoll,true);
    assert.equal(assertUniversalState(moved.state),true);
  });

  test(spec.mode+' engine ends the match when the fourth token reaches exact finish',()=>{
    const state=makeState(spec);
    const player=state.players[0],owned=Object.values(state.tokens).filter(token=>token.owner===player.id);
    for(const token of owned.slice(0,3))token.stepProgress=spec.finishStep;
    owned[3].stepProgress=spec.finishStep-1;
    state.currentPlayer=player.id;
    const rolled=rollUniversalDice(state,player.id,1);
    const moved=applyUniversalMove(rolled.state,player.id,owned[3].id);
    assert.equal(moved.state.phase,'finished');
    assert.equal(moved.state.winner,player.id);
    assert.equal(moved.state.players[0].status,'finished');
    assert.ok(moved.state.players[0].finishedAt!==null);
    assert.equal(moved.state.tokens[owned[3].id].stepProgress,spec.finishStep);
  });
}
