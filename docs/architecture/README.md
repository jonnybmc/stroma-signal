# Architecture — diagrams (public OSS)

_Last updated: 2026-05-13_

Visual views of the Signal Core architecture. Each diagram is the canonical reference for one shape of question. Together with the trust artifacts ([`PRIVACY.md`](../../PRIVACY.md), [`docs/sub-processors.md`](../sub-processors.md), [`docs/data-retention-sla.md`](../data-retention-sla.md), [`docs/right-to-erasure.md`](../right-to-erasure.md), [`SECURITY.md`](../../SECURITY.md)) and the developer-facing references ([`docs/signal-technical-reference.md`](../signal-technical-reference.md), [`docs/data-flow-core.md`](../data-flow-core.md), [`docs/ad-context-capture.md`](../ad-context-capture.md)), they form the complete architectural picture for Signal Core.

---

## Index

| # | Title | Format | Audience |
|---|---|---|---|
| [D3](./sequence-ad-context-capture.md) | Ad-context capture — sequence diagram | Mermaid `sequenceDiagram` | Anyone reasoning about when the optional capture fires and what's persisted |
| [D4b](./class-ad-context.md) | Ad-context capture — class diagram (schema) | Mermaid `classDiagram` | Anyone consuming or extending `SignalAdContextCaptureV1` |
| [D6b](./deployment-core.md) | Signal Core — physical deployment view | Mermaid `flowchart` with trust boundaries | Procurement / DPO / security review |

The diagram in [`docs/data-flow-core.md`](../data-flow-core.md) (one level up) is the **macro view** of the Signal Core surface — read that one first, then drill into D3 / D4b / D6b for specific topics.

---

## Reading order

1. **[`docs/data-flow-core.md`](../data-flow-core.md)** — macro Signal Core flow (5 minutes). Start here.
2. **[D6b deployment-core.md](./deployment-core.md)** — where each Signal Core surface physically runs + trust-boundary matrix (10 minutes). Procurement-oriented.
3. **[D3 sequence-ad-context-capture.md](./sequence-ad-context-capture.md)** — lifecycle of the opt-in ad-context capture module, end-to-end (10 minutes). Developer-oriented.
4. **[D4b class-ad-context.md](./class-ad-context.md)** — `SignalAdContextCaptureV1` schema (10 minutes). Schema-oriented.

Total: roughly 35 minutes to walk the architectural set cold.

---

## Discipline

Every diagram file carries a **Drift detection** section at the bottom listing changes that require the diagram to update in the same PR. The intent: code or contract changes that affect an architectural boundary or schema get matched-pair diagram updates rather than letting the visual reference go stale.

Other rules:
- All diagrams use Mermaid 11.x-safe syntax (quoted labels, no HTML in unquoted labels, no parens in edge labels)
- Diagrams are markdown-embedded so they render in GitHub UI without external tooling
- A diagram revision lands with a short rationale in its commit message

---

## Cross-references

- **Operator-facing trust artifacts:** [`PRIVACY.md`](../../PRIVACY.md), [`docs/sub-processors.md`](../sub-processors.md), [`docs/data-retention-sla.md`](../data-retention-sla.md), [`docs/right-to-erasure.md`](../right-to-erasure.md), [`SECURITY.md`](../../SECURITY.md)
- **Developer-facing references:** [`docs/signal-technical-reference.md`](../signal-technical-reference.md), [`docs/data-flow-core.md`](../data-flow-core.md), [`docs/ad-context-capture.md`](../ad-context-capture.md), [`docs/spa-ssr-caveats.md`](../spa-ssr-caveats.md)
- **Architecture decisions:** [decisions/](./decisions/) _(currently empty — public-side decisions land here as they emerge; the project's current architectural decisions about Signal Core are codified in the trust artifacts above)_

---

## Future additions

Diagrams that aren't yet useful enough to ship but are reserved as the public OSS surface grows:

- **D-Core component diagram** — what lives where across the public OSS workspaces. Would document the relationship between `@stroma-labs/signal`, `@stroma-labs/signal-contracts`, the `/r` Tier Report app, and the SDK init wizard. Reserved for when the public surface grows enough to warrant a unified component view; currently the workspace structure is small enough that the README + `signal-technical-reference.md` together convey it.
- **D-Core state diagram for SDK lifecycle** — capture lifecycle, sink fan-out states, error / fallback paths. Reserved for when the SDK's internal state machine grows beyond what `signal-technical-reference.md` describes inline.

These are intentional gaps. They land when there's a real reader question they answer.
