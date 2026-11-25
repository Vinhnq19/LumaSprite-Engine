# E4 Final Acceptance

**E4 ENGINEERING: APPROVED**

**E4 ARTISTIC BASELINE: APPROVED_WITH_LIMITATIONS**

The Project Owner accepted these two 64 × 64 single-view stylized RPG characters at checkpoint `aa54b4a`.

| Approved asset | Geometry and materials | Immutable references |
| --- | --- | --- |
| Field Surveyor | CharacterSpec v2 geometry revision R2 with M2P. Pivot (30,59), grip (49,33). | [CharacterSpec](../benchmarks/results/e44/packages/r2/character-spec.json) · [Shape lock](../benchmarks/results/e44/packages/r2/shape-lock.json) · [Production manifest](../benchmarks/results/e44/packages/r2/manifest.json) |
| Forest Courier | CharacterSpec v3 geometry revision 1 with E4.4 revised geometry and original M2 ramps. Pivot (32,58). | [CharacterSpec](../benchmarks/results/e44/packages/courier-rev/character-spec.json) · [Shape lock](../benchmarks/results/e44/packages/courier-rev/shape-lock.json) · [Production manifest](../benchmarks/results/e44/packages/courier-rev/manifest.json) |

Both manifests pin the CharacterSpec, geometry lock, part masks, PNG, palette metadata and lineage. Surveyor R2 inherits the R1 lock and Courier revision 1 inherits the E4.3 Courier lock. The E4.4 SHA-256 catalog pins the complete packages. B1 M2P, R1 and the original Courier remain reference assets. [SHA-256 record](e44-benchmark-sha256.txt) · [Review decision](../benchmarks/results/e44/review.md) · [E4.4 gallery](LumaSprite-Engine-E4.4-Report.html)

## Accepted limitations

- Both approved views favor the right-facing side. The historical `three-quarter-right` spec value is the stable view identifier. A stronger three-quarter projection and additional views require future validation.
- Courier's leather and coat contrast is limited in the dark scene.
- E4 evidence covers Engine and Studio production. Target-game runtime validation is pending.
- E4 acceptance covers static poses. Idle animation quality is an independent review.
- E4 regression at closeout matched the historical hash catalogs and passed 58 Engine tests. The original E4.4 Store round-trip results describe the approved assets. [E4.4 verification](e44-test-report.md)

E5.0 and E5.1 were authorized for the Field Surveyor idle. Forest Courier is an approved static source for future work. The first walk-cycle milestone requires Project Owner approval of the idle.
