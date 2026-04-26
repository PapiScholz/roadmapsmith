'use strict';

const { renderCompact } = require('./compact');
const { renderProfessional } = require('./professional');

function renderBody(model, profile) {
  if (profile === 'professional') return renderProfessional(model);
  if (profile === 'enterprise') {
    throw new Error(
      'roadmapProfile "enterprise" is not yet implemented. ' +
      'Use "professional" instead, or contribute via the plugin registry. ' +
      'See docs/use-cases/ for the extension guide.'
    );
  }
  return renderCompact(model);
}

module.exports = { renderBody };
