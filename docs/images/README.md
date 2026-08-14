# Portfolio Screenshots

These images are sanitized, deterministic captures for the public README. They were generated locally with Playwright against a fresh development server using mocked fictional note data and the test-only renderer/auth settings. No private notes, cookies, provider keys, request bodies, or deployment credentials are present.

| File | State | Source contract |
| --- | --- | --- |
| `notelings-desktop-overview.png` | 1440×900 initialized desktop shell | `e2e/performance-renderer.spec.ts` idle capture |
| `notelings-mobile-overview.png` | 390×844 mobile shell | `e2e/performance-renderer.spec.ts` mobile capture |
| `notelings-delivery-flow.png` | initialized desktop with an active delivery | `e2e/performance-renderer.spec.ts` delivery capture |
| `notelings-knowledge-graph.png` | frozen bipartite graph overlay | `e2e/knowledge-graph.spec.ts` graph layout capture |

The screenshots should be regenerated when the visual contract changes, then reviewed at desktop and mobile sizes before being referenced from `README.md`.
