import { base } from '@lifeos/eslint-config';

// The composition root — the ONE place allowed to import skills + connectors together
// with the core (ADR-0001). No dependency-direction boundary applies here by design.
export default [...base];
