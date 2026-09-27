# SayIt BillIt: what the pilot actually established

**September 27, 2026 · Incomplete image pilot · $0 API spend**

SayIt BillIt asks a practical question: can an expense value carry enough evidence
that a freelancer can check it quickly? The prototype keeps source material next
to the record. Selecting a field highlights its actual OCR line box. Missing values
stay missing, review reasons remain visible, and corrections are stored separately
from original predictions.

## What Interfaze got right and wrong

**Not measured.** No free-credit key was confirmed, so no Interfaze call was made.
There is no honest basis to claim it handled messy bills well or poorly. Its docs
provide the primitives the design needs: structured output, OCR precontext with boxes
and recognition confidence, and audio transcription metadata. A local adapter uses
those primitives, caches raw responses, logs token charges, and stops on failure.
It still needs a real protocol validation run. Audio notes were not supplied by the
user, so voice extraction and whisper.cpp comparison remain unmeasured.

## What the offline baseline revealed

Nine original fictional receipts were rendered with clean, faded, rotated, ambiguous,
and creased variants. Three were assigned to development and six to held-out before
OCR. Labels were authored with the content and visually checked by the agent; this
is not independent human annotation. Tesseract plus deliberately small rules got
52 of 54 held-out field slots right (96.3%). It flagged one of two errors (50% error
recall), while only one of four flags was an error (25% flag precision).

The important failure was “Oil” becoming “0il” at 92% recognition confidence. The
review gate accepted it. The other error, a missing 24.20 total introduced by
“BALANCE DUE,” was flagged. Average cached original OCR latency was 103 ms/document;
API tokens and API dollar cost were zero. Those figures exclude model initialization,
hardware and electricity, and cannot predict performance on real photographs.

## Why a high accuracy figure is not enough

No dev fields were wrong. The declared threshold objective therefore chose zero
on a coverage tie. Reporting that uncomfortable outcome is more useful than choosing
a threshold after seeing held-out errors. All Interfaze results will require review
until their own calibration set exists. Recognition confidence is not semantic
correctness: accurate letters can still belong to the wrong amount or date.

## Next evidence needed

Confirm free access without a card; run a bounded Interfaze pilot with genuine raw
responses; collect the user's explicitly licensed voice recordings; implement and
run whisper.cpp tiny on exactly the same audio; and obtain independent human labels.
Freeze a new, more diverse held-out split before tuning again. The current app is a
public, reproducible portfolio slice, not a completed comparison or accounting tool.
No winner is declared and no Interfaze result has been invented.
