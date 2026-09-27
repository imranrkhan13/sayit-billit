# Labeling rubric v1 — frozen before model evaluation

The nine fictional receipts and their labels were authored together; the labels
were then visually checked against the rendered images. This is an
agent-authored, single-reviewer pilot, **not independent human annotation**.
No claim of blinded or inter-annotator validation is made.

- Merchant: printed store name, preserving punctuation and internal spacing.
- Date: ISO YYYY-MM-DD only if unambiguous. `03/09/26` is null without a locale.
- Currency: explicit ISO code. A bare `$` is null, never silently USD.
- Items: ordered printed purchase rows; each has a name and decimal line price.
  Do not treat subtotal, tax, payment, or balance as items. Quantities are out of scope.
- Total: payable total; `BALANCE DUE` counts in this pilot, unlike cash tendered.
- Tax: printed tax only. Missing tax is null; do not derive tax from arithmetic.
- Unknown/illegible/conflicting values: null. An abstention is not a correct positive.
- Source: actual OCR line box or exact transcript character span. Quotes must match
  one source line uniquely; ambiguous matches force review.
- Confidence: OCR recognition confidence capped by extraction confidence, not a
  calibrated probability of financial correctness. Absent confidence maps to a
  conservative zero gate score, with an explicit reason.

`data/manifest.json` fixes 3 dev / 6 held-out before baseline OCR. Rules and threshold
candidate grid were authored before inspecting held-out predictions. All receipts
share the same rendering family, so this split cannot establish generalization.
Threshold selection uses only dev: maximize accepted fields subject to zero observed
accepted errors. Select the lower threshold on a coverage tie. Missing evidence,
invalid formats, and ambiguous matches always require review independently.
Interfaze has no calibration data: **all its fields require review**.

Metrics: exact case-sensitive string equality, ordered item slots, union of expected
and predicted slots. Accuracy includes correct null abstentions. Per-field precision
= correct non-null predictions / non-null predictions. Recall = correct non-null
predictions / non-null labels. Wrong substitutions are both false positives and
false negatives. Zero denominators are null/N/A, never 100%.
Flag precision = wrong flagged fields / all flagged fields. Error-flag recall = wrong
flagged fields / all wrong fields. Report review rate too to expose over-flagging.
High-score wrong means score >= selected threshold, whether or not another guard
forced review. Accepted-wrong means wrong and no review flag.

For a real extension: collect independently hand-labeled user-recorded audio,
freeze speaker-disjoint dev/test splits, and obtain a second reviewer before claims.
