# Contributing to Voxels

Contributions should solve a clear problem or deliver a practical improvement. Meeting this standard makes a proposal ready for review; it does not guarantee a merge. Repository maintainers decide based on project direction, evidence, compatibility, and maintenance cost.

## Proposal requirements

Include the following in an issue or pull request. Keep the detail proportional to the change; a small documentation fix can be explained in a few sentences.

1. **Title:** Name the improvement and its intended outcome.
2. **Problem and value:** Explain the current behavior, who is affected, and why the change matters. Link an existing issue when available; for bugs, include reproduction steps and expected behavior.
3. **Proposed solution:** Describe the change, its scope, and the resulting behavior. Explain meaningful tradeoffs or alternatives, and identify breaking changes or migration needs.
4. **Validation:** State how success will be checked. For a pull request, report the checks actually run and their results, including any failures or checks not run. Include screenshots or recordings for visible changes and measurements for performance claims when relevant.
5. **References:** Link relevant documentation, specifications, research, related issues, or prior implementations. Explain how each reference supports the proposal. Write “Not applicable” when none are needed.

Use the improvement proposal issue template to discuss substantial changes before investing in implementation. Small, focused fixes may go directly to a pull request. A proposal can describe a validation plan; a completed pull request must provide validation results.

## Ready for merge

- Keep each pull request focused on one coherent improvement. Avoid unrelated refactors, dependencies, or formatting changes.
- Follow [AGENTS.md](AGENTS.md) and the [setup guide](install.md). Update affected documentation and add focused regression coverage for changed behavior where appropriate.
- Preserve parcel ownership, delegated build rights, access controls, and compatibility between full and partial nodes. Explain any intentional changes to these guarantees explicitly.
- Run `pnpm run precommit` and `pnpm test` before committing. Database tests must use the isolated runner (`pnpm run test:db`), never a live application database.
- Resolve relevant review feedback and merge conflicts; applicable required checks must pass before merge. Clearly document remaining limitations.
- Submit only material you have the right to contribute. Keep secrets, private data, and unrelated generated artifacts out of the pull request. Contributions are licensed under the repository's [MIT License](LICENSE).

Maintainers may request revisions or decline proposals that lack a clear benefit, sufficient evidence, or a maintainable implementation. Accepted pull requests are squash-merged into `main`; obsolete contribution branches can then be removed.
