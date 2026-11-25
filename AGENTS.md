# Working on LumaSprite Engine

- Work in the Engine repository. Inspect sibling LumaSprite Studio code read-only for adapter compatibility and keep its code and project data in Studio.
- Keep the planner, validated AssetSpec, specialized generator, Pixel Core, technical QA and Studio boundary separate. Render from data using integer pixels and local deterministic code.
- Run lint, typecheck, build, tests and smoke for implementation changes. For adapter changes, run the optional Studio preview check against the current Studio checkout.
- Keep credentials and private references outside tracked files. The bootstrap provider is offline and permits zero live calls.
- Review the shipped art at native size. Technical checks and human art approval have separate outcomes.
- Preserve asset provenance and request palette locks. Candidate preview and approval stay in Studio and with the project owner.
- Leave the initial commit and push to the project owner.
