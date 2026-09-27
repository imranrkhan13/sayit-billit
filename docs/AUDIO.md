# Audio pilot: pending user recordings

No voice samples were fabricated, synthesized, scraped, or presented as the user's.
No audio accuracy or latency numbers exist yet. The Interfaze CLI accepts a WAV,
MP3, M4A, or WebM as the sole input, or as a second input after an image. It first
transcribes, caches that response, then extracts with the same expense.v1 schema.
Spans refer to the transcript, not verified acoustic truth; absent STT confidence
forces human review. Two stages have separate input-hash cache entries and budgets.

Free offline baseline protocol (not yet run): install whisper.cpp from its official
repository https://github.com/ggml-org/whisper.cpp and obtain its tiny model using the
upstream model download script. Record your own short fictional expense note,
convert locally to 16 kHz mono WAV, run `whisper-cli -m models/ggml-tiny.bin -f note.wav -otxt -oj`,
then apply `src/baseline.ts` rules to transcript lines using `transcriptEvidence`.
The image-specific rules are intentionally weak on speech; freeze any speech rules
using dev notes before held-out testing. Save stdout JSON, transcript, model hash,
recording hash, command/version, latency, and labels alongside predictions.

Audio corpus additions require a manifest entry identifying recorder, explicit
publication consent/license, date, hash, and dev/held-out assignment. Keep real
financial details out of the public corpus. This procedure is a plan, not a shipped
or validated whisper.cpp integration.
