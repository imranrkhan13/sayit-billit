# Boundaries

The Vercel deployment is a static baseline replay. It has no API secret, upload
endpoint, shared filesystem cache, tracking, or API spending route. Local image
preview uses a browser Blob and is not uploaded. It cannot extract a new receipt.

Interfaze runs from the local CLI only. Keys come from environment variables.
`.private/`, `.env*`, and provider caches are excluded from Git and deployment.
Private artifacts include source-derived data; do not copy them into public/demo.
Public demo assets contain only the CC0 synthetic corpus. Human review edits live
in browser memory and the explicit downloaded JSON, not on a server.

The local cache uses a global exclusive lock, durable per-stage tombstones,
write-before-send budget state, and no automatic retries. A crash can halt the runner
until manually audited, but cannot silently repeat a request. Do not delete private
cache records to force a retry. The same bytes/stage reuse results even if a prompt
changes; use a separate audited study rather than silently refreshing predictions.
Concurrent processes fail closed. One completed call/second is below 50 req/s.

The conservative reservation is 1,000,000 input + 32,000 output tokens ($1.612 at
$1.50/$3.50 per million). Actual usage settles the reservation; cap > $5 is rejected.
Only enable calls after confirming unused free credits and no billing/top-up. The
software cannot independently verify account billing state or other clients' usage.
Token charges depend on provider accounting; an unexpectedly larger billable usage
halts further calls. Failure/timeout/invalid usage halts all new calls. Invalid record
schema stops that invocation and keeps raw responses; a later call with the same
input reads the cache only. Unknown token usage is not reported as zero.
