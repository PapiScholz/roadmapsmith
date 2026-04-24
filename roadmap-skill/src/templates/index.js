'use strict';

const fs = require('fs');
const path = require('path');

function readTemplate(name) {
  const absolutePath = path.resolve(__dirname, '..', '..', 'templates', name);
  return fs.readFileSync(absolutePath, 'utf8');
}

function replaceTokens(content, replacements) {
  let result = content;
  for (const [key, value] of Object.entries(replacements || {})) {
    const token = `{{${key}}}`;
    result = result.split(token).join(String(value));
  }
  return result;
}

function renderRoadmapTemplate(replacements = {}) {
  return replaceTokens(readTemplate('roadmap.template.md'), replacements);
}

function renderAgentsTemplate(replacements = {}) {
  return replaceTokens(readTemplate('agents.template.md'), replacements);
}

module.exports = {
  renderAgentsTemplate,
  renderRoadmapTemplate
};
