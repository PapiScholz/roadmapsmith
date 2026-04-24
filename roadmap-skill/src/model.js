'use strict';

const PHASE_ORDER = ['P0', 'P1', 'P2'];

function phaseWeight(phase) {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : PHASE_ORDER.length;
}

function createRoadmapModel(input) {
  return {
    northStar: input.northStar,
    currentState: input.currentState,
    phases: input.phases,
    milestones: input.milestones,
    commandBreakdown: input.commandBreakdown,
    exitCriteria: input.exitCriteria,
    risks: input.risks,
    antiGoals: input.antiGoals,
    customSections: input.customSections || []
  };
}

module.exports = {
  PHASE_ORDER,
  createRoadmapModel,
  phaseWeight
};
