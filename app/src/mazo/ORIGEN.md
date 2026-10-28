# Origen de esta carpeta

Copia del formato de mazo de **Aula Trivial**, para que un mismo archivo sea
válido en los dos juegos. **No cambies las reglas aquí**: si el formato
evoluciona, se cambia primero en el Trivial y se vuelve a copiar.

- Repositorio: `fcarros/Trivial-Antigravity`, rama `v2`
- Commit: `b7f393649c55ce8a611fdc6aaeb9a2aed7d2b2ec` (2026-10-13)

| Archivo | Origen | Cambios |
|---|---|---|
| `mazo.ts` | `game-core/src/mazo.ts` | Ninguno |
| `colores.ts` | `game-core/src/colores.ts` | Ninguno |
| `azar.ts` | `game-core/src/azar.ts` | Ninguno |
| `mazo.test.ts` | `game-core/src/mazo.test.ts` | Ninguno |
| `pruebas.ts` | `game-core/src/pruebas.ts` | Solo `crearMazo()`; el resto depende del motor del Trivial |
| `docs/formato-mazo.md` | `docs/formato-mazo.md` | Nota inicial sobre Aula Quiz |

Para comprobar que la copia sigue igual:

```bash
gh api "repos/fcarros/Trivial-Antigravity/contents/game-core/src/mazo.ts?ref=v2" \
  -H "Accept: application/vnd.github.raw" | diff - app/src/mazo/mazo.ts
```
