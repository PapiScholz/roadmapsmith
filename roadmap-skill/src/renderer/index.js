'use strict';

const { renderProfessional } = require('./professional');

function renderBody(model) {
  return renderProfessional(model);
}

module.exports = { renderBody };
