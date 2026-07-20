# Releasing roadmapsmith

Release está automatizado end-to-end. Dos comandos:

```bash
npm version patch          # o minor / major
git push --follow-tags
```

## Qué pasa bajo el capó

1. `npm version` bumpea `package.json`.
2. El hook `version` de npm corre `scripts/sync-skills.js --fix`, que propaga la nueva versión a los 4 manifests mirrored:
   - `.claude-plugin/plugin.json`
   - `.codex-plugin/plugin.json`
   - `plugins/roadmapsmith/.codex-plugin/plugin.json`
   - `skills.json`
3. `git add -A` stagea los cambios; `npm version` crea el commit + tag con todos los mirrors adentro.
4. `git push --follow-tags` sube commit y tag.
5. `.github/workflows/release.yml` se dispara con el cambio de versión en `main`, compara local vs. publicado, corre `npm publish --access public`, y crea el GitHub release con notas auto-generadas.
6. `prepublishOnly` corre `sync-skills.js --check` como safety net final — publish aborta si algún mirror está desincronizado.

## Reglas

- **Nunca** correr `npm publish` a mano.
- **Nunca** editar la `version` de un manifest mirrored a mano — source of truth es `package.json`. Drift falla en CI (`.github/workflows/mirror-check.yml`) y en `prepublishOnly`.
- Si `mirror-check` rompe, correr `npm run sync-skills` local y commitear el fix.

## Contexto arquitectónico

Ver la sección **Publishing** de [`../CLAUDE.md`](../CLAUDE.md) para el diseño completo del pipeline y los invariantes del layout post-v1.3.0 (skills-only distribution).
