'use strict';

const PHASE_ORDER = ['P0', 'P1', 'P2'];

function phaseWeight(phase) {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : PHASE_ORDER.length;
}

function createRoadmapModel(input) {
  return {
    northStar: input.northStar,
    product: input.product || {},
    currentState: input.currentState,
    phases: input.phases,
    steps: input.steps || [],
    phasesDetailed: input.phasesDetailed || [],
    milestones: input.milestones,
    commandBreakdown: input.commandBreakdown,
    exitCriteria: input.exitCriteria,
    risks: input.risks,
    antiGoals: input.antiGoals,
    successCriteria: input.successCriteria || [],
    customSections: input.customSections || [],
    customPhases: input.customPhases || [],
    checkedById: input.checkedById || {}
  };
}

module.exports = {
  PHASE_ORDER,
  createRoadmapModel
};
