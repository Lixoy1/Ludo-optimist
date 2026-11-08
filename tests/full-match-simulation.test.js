import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUniversalState, rollUniversalDice, applyUniversalMove, assertUniversalState,
} from '../apps/backend/universal-engine.js';
import { calculateDestinationProgress, progressConfigForState } from '../src/game-progress.js';
import { getPlayableGeometry } from '../src/game-geometries.js';

const modes = [
  { mode:'CLASSIC', colors:['blue','red','yellow','green'], players:4 },
  { mode:'HEXA', players:6 },
  { mode:'ROYAL', players:4 },
];

function rosterFor(mode, colors) {
  if(colors) return colors.map((color,index)=>({
    id:mode.toLowerCase()+'-bot-'+index,
    username:'BOT '+(index+1),
    color,
  }));
  return getPlayableGeometry(mode).arms.map((arm,index)=>({
    id:mode.toLowerCase()+'-bot-'+index,
    username:'BOT '+(index+1),
    color:arm.player.id,
  }));
}

function makeDice(seed) {
  let value=seed>>>0;
  return ()=> {
    value=(Math.imul(value,1664525)+1013904223)>>>0;
    return 1+(value%6);
  };
}

function chooseProgressGreedy(state,playerId,legalTokenIds,dice) {
  const config=progressConfigForState(state);
  return legalTokenIds
    .map(id=>({id,destination:calculateDestinationProgress(state.tokens[id].stepProgress,dice,config)}))
    .sort((a,b)=>b.destination-a.destination || a.id.localeCompare(b.id))[0].id;
}

for(const spec of modes) {
  test(spec.mode+' full automated match completes with server-legal bot moves only',()=>{
    const state0=createUniversalState(spec.mode,rosterFor(spec.mode,spec.colors));
    const dice=makeDice(spec.mode==='CLASSIC'?121:spec.mode==='HEXA'?272:368);
    let state=state0;
    let rolls=0,moves=0,skips=0;
    const maxActions=20_000;
    while(state.phase==='playing' && rolls<maxActions) {
      const playerId=state.currentPlayer;
      const rolled=rollUniversalDice(state,playerId,dice());
      state=rolled.state;
      rolls+=1;
      if(rolled.skipped) skips+=1;
      if(rolled.legalTokenIds.length) {
        const tokenId=chooseProgressGreedy(state,playerId,rolled.legalTokenIds,state.dice);
        const result=applyUniversalMove(state,playerId,tokenId);
        state=result.state;
        moves+=1;
      }
      assert.equal(assertUniversalState(state),true);
    }
    assert.equal(state.phase,'finished',spec.mode+' must finish within '+maxActions+' rolls');
    assert.ok(state.winner);
    const winner=state.players.find(player=>player.id===state.winner);
    assert.equal(winner.status,'finished');
    assert.equal(Object.values(state.tokens).filter(token=>token.owner===state.winner&&token.stepProgress===state.finishStep).length,4);
    assert.ok(rolls>0&&moves>0);
    assert.ok(skips>=0);
  });
}
