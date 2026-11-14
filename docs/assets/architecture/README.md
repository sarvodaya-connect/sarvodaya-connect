# Architecture figures

Provided by the project owner on 11 November 2026. Referenced from the root README.

- `current-test.png`: current TEST environment as reported by the owner, including
  the last-tested Bedrock account-access failure. This is not a live AWS inventory.
- `sarvoai-proposed.png`: proposed AI workflow; dashed components are not deployed.

The AI figure is a conceptual design. Runtime code must return query embeddings
from Bedrock to the retrieval tool before the tool queries the search index. Every
model/embedding invocation needs its own spend reservation/reconciliation; an
initial request-level check is insufficient. The final generated answer returns
to the API for validation. OpenSearch is a proposed choice pending cost review.
Do not interpret an arrow as a deployed private endpoint or network route.

Keep these originals and their status captions together when sharing. Update the
images and captions when the deployment or design changes; do not relabel the
proposed diagram as deployed.
