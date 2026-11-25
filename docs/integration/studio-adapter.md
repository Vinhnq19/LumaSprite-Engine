# Studio Adapter v1

Verified against the local Studio checkout at `bb5c384`. Start the Engine with `npm run serve -- --port 4399`, then launch the built Studio with `LUMASPRITE_ENGINE_PORT=4399` in its environment. In Studio, submit a 32×32 **Prop** with the brief “Wooden supply chest with dark iron bands.” Review the candidate in Studio before deciding whether to apply it.

| Request | Contract |
| --- | --- |
| `GET /v1/capabilities` | Version 1, prop, progress, previews and masks, 32×32 maximum, one frame |
| `POST /v1/jobs` | Strict request JSON, bounded to 64 KiB, one 32×32 frame, binary alpha, nonempty opaque palette |
| `GET /v1/jobs/:id` | Job state and progress, with final version ID when ready |
| `POST /v1/jobs/:id/cancel` | Cancels queued or running work |
| `GET /v1/jobs/:id/results/:version` | Immutable candidate for that job and version |

The server binds only to `127.0.0.1`. The local template fixes canvas at exactly 32×32. Capability limits express maxima, so smaller dimensions can reach the endpoint and receive a field validation error. The planner recognizes a chest brief and defaults to the E2 domed layout. English briefs containing `compact` or `travel` select the corresponding E2 layout. A brief containing “barrel” renders the wide barrel. Add “tall” to select the narrow version. The brief deterministically supplies the seed. The Engine logs structured wood and iron ramp compression, collision and contrast warnings. The v1 response shape stays the same. Barrel and Travel jobs use the E2.4 finish. CLI users can supply a seed directly.

Jobs hold up to 256 receipts in memory with a 15-minute lifetime. Equivalent validated submissions with the same request ID return the original job. Conflicting content returns HTTP 409. Progress advances at the plan and render stages. Canceling an active job stops result publication. Completed jobs retain their immutable version through the receipt lifetime. A restart clears in-memory state.

Each result has protocol version, job and version IDs, name, dimensions, loop and a single frame with duration, canonical base64 RGBA8 and SHA-256 of the decoded bytes. Transparent pixels contain RGBA zero. Opaque pixels use the request palette. Masked requests supply a canonical base64 source RGBA buffer and one byte per pixel. Mask `0` preserves the source pixel. Mask `1` allows an opaque generated pixel to paint over the source. Transparent template pixels preserve the source.

Studio's core Adapter v1 supports more kinds and optional capabilities. The current HTTP transport filters features to progress, previews and masks and asset types to character, prop and icon. Its discovery clamps dimensions to 512×512 and limits to one frame. Its JSON reader caps responses at 2 MiB and defaults to 3 seconds per request. Studio's own job deadline defaults to 30 seconds. The transport verifies the frame hash and canonical base64. Studio binds a preview receipt to a frozen request and confirms the receipt, current revision and explicit approval before applying. The Engine has no access to the Studio project store.

Run `npm run test:studio` for a full preview check against the sibling checkout; set `LUMASPRITE_STUDIO_ROOT` if it lives elsewhere. Studio needs its built UI directory for startup. The test creates a disposable project under Engine's `.cache/` and exercises regular and masked chest candidates, a tall barrel, refusal without approval, and stale revision protection.
