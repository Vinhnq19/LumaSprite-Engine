# Bootstrap report

The first runnable Engine slice validates an AssetSpec, draws the supply chest as four layers, performs technical raster checks and writes PNG. Seeds 42 and 43 use the same design and differ in strap layout and lock position. The code runs offline with two runtime dependencies, Zod and pngjs. [Benchmark gallery](../benchmarks/results/sample/README.md)

The Engine communicates with the actual Studio v1 HTTP API through a loopback candidate flow. A disposable Studio fixture exercised normal and masked previews, locked pixel preservation and revision protection. The default Studio palette visibly compresses the authored color ramps. [Studio adapter](integration/studio-adapter.md) · [Art review](art-quality/review.md)

The DeepSeek scaffold reads configuration from the environment and tests JSON response validation, timeouts, usage logging, budget and errors using fake replies. The real-call limit is zero. [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)

The proposed initial commit contains source, tests, npm configuration and lockfile, CI, documentation, the benchmark brief, and the small PNG and JSON review samples. Generated runs, dependencies, cache, graph exports and local environment files are ignored. Source and art review precede the owner's initial commit.
