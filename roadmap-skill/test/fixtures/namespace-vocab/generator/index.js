'use strict';

// Generic roadmap profile generation — produces tasks from archetype detection.
// Does NOT include domain-specific web/landing profiles (those live in generator/profiles/).
function generateProfile(archetype) {
  if (archetype === 'web-landing') {
    return { profile: 'web', domain: 'landing', metadata: {}, roadmap: [] };
  }
  return { profile: 'generic', domain: null, metadata: {}, roadmap: [] };
}

function generateTasks(profile) {
  return profile.roadmap || [];
}

module.exports = { generateProfile, generateTasks };
