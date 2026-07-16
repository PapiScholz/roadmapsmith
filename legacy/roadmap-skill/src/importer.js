'use strict';

const fs = require('fs');
const path = require('path');
const { parseRoadmap } = require('./parser');
const { uniqueBy } = require('./utils');

function importTasks(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  const all = [];

  for (const filePath of paths) {
    let content;
    try {
      content = fs.readFileSync(path.resolve(filePath), 'utf8');
    } catch {
      continue;
    }
    const { tasks } = parseRoadmap(content);
    all.push(...tasks);
  }

  return uniqueBy(all, (t) => t.id);
}

module.exports = { importTasks };
