export const BASE_STEP_PROGRESS = -1;
export const CLASSIC_PROGRESS_CONFIG = Object.freeze({
  mode:'CLASSIC',
  trackLength:52,
  maxOuterSteps:50,
  homeCells:5,
  finishStep:56,
});

export function progressConfigForState(state) {
  if (!state || typeof state !== 'object') throw new TypeError('A game state is required.');
  if (state.mode === 'CLASSIC') return CLASSIC_PROGRESS_CONFIG;
  const config = {
    mode:state.mode,
    trackLength:state.trackLength,
    maxOuterSteps:state.maxOuterSteps,
    homeCells:state.homeCellCount,
    finishStep:state.finishStep,
  };
  assertProgressConfig(config);
  return config;
}

export function assertProgressConfig(config) {
  if (!config || !Number.isInteger(config.trackLength) || config.trackLength < 1 ||
      !Number.isInteger(config.maxOuterSteps) || config.maxOuterSteps < 0 ||
      !Number.isInteger(config.homeCells) || config.homeCells < 1 ||
      config.finishStep !== config.maxOuterSteps + config.homeCells + 1) {
    throw new TypeError('Invalid board progress configuration.');
  }
  return true;
}

export function positionFromStepProgress(stepProgress, config) {
  assertProgressConfig(config);
  if (!Number.isInteger(stepProgress) || stepProgress < BASE_STEP_PROGRESS ||
      stepProgress > config.finishStep) {
    throw new RangeError('Token stepProgress is outside the configured route.');
  }
  if (stepProgress === BASE_STEP_PROGRESS) return { zone:'base', step:BASE_STEP_PROGRESS };
  if (stepProgress <= config.maxOuterSteps) return { zone:'track', step:stepProgress };
  if (stepProgress < config.finishStep) return { zone:'home', step:stepProgress };
  return { zone:'finished', step:config.finishStep };
}

export function calculateDestinationProgress(stepProgress, dice, config) {
  const position = positionFromStepProgress(stepProgress, config);
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) {
    throw new RangeError('Dice must be an integer from 1 to 6.');
  }
  if (position.zone === 'finished') return null;
  if (position.zone === 'base') return dice === 6 ? 0 : null;
  const destination = stepProgress + dice;
  return destination <= config.finishStep ? destination : null;
}

export function isOuterTrackProgress(stepProgress, config) {
  return Number.isInteger(stepProgress) &&
    stepProgress >= 0 && stepProgress <= config.maxOuterSteps;
}

export function progressToHomeIndex(stepProgress, config) {
  const position = positionFromStepProgress(stepProgress, config);
  if (position.zone !== 'home') return null;
  return stepProgress - (config.maxOuterSteps + 1);
}
