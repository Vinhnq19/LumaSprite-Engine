# Known limitations

| Area | v1 scope |
| --- | --- |
| Artist input | 8-bit, non-interlaced RGBA PNG. Up to 128 × 128, 16 layers and 64 colors. Binary alpha with transparent black. Revisions recolor one layer within its fixed ownership and allowed mask. |
| Interoperability | Component metadata stays in a sidecar. Studio imports layers or the composite through its existing PNG workflow. The localhost adapter remains a 32 × 32 prop service. Native scene ZIPs are a separate contract. |
| Runtime | Unity verification targets E8.5 on Windows x64. Physical keyboard playthrough and visible-window HUD remain `NOT_RUN`. Scripted navigation, interactions and save/reload are separate evidence. |
| Artistic approval | The E9.H1 and E10.1 art research remains review evidence. A technically valid package still requires human visual and rights acceptance for production. |
| Distribution | Windows RC scope is `INTERNAL_USE_ONLY`. Public distribution and game-ready art are both `NOT_APPROVED`. The repository has no project redistribution license recorded. |
| v2 | Multiview components, transforms, animation assembly UI, native component documents in Studio and other deployment targets. |
| AI phase | Dataset rights, data curation, labeling, held-out evaluation, training and inference need a separate Owner decision. |

[Internal acceptance](v1-internal-release.md) · [Scope decision](v1-scope.md) · [Report index](reports/INDEX.md)
