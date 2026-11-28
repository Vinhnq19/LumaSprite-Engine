# AI integration contract draft

**Draft for a future phase.** The Engine v1 component package is the intake contract. A local human-authored PNG, a curated component and a future model proposal all pass through the same bounded PNG, palette, alpha, mask, metadata and revision validation.

A future `ImageCandidateProvider` may expose this local file boundary.

```ts
interface ImageCandidateProvider {
  candidate(): Promise<{ manifestPath: string }>;
}
```

The returned path names a local `component.json` and its sibling layer PNGs and masks. The application calls `buildComponentPackage` to verify the candidate and returns its manifest and RGBA digests. Provider responses are untrusted. Provenance stays with each layer. Record the original source and grant, any dataset or model identity needed for traceability, and use `review-only` until production rights have been established. Owner art approval is independent of the technical receipt.

The Windows sample uses a local authored QA fixture against this exact file boundary. Model or API integration, private credentials, dataset ingestion and training are for a later authorized phase. Training should define a rights ledger, evaluation split and acceptance rubric before collecting or using assets.

[Component contract](engine-cli-api.md#artist-authored-png-or-components) · [Known limits](known-limitations.md)
