# Fresh ChatGPT workflow validation — September 5, 2026

Tested through browser UI in fresh ChatGPT Work conversations using GPT-5.6 Sol Medium. These are fresh conversations on an existing account, so account memory remains available. Long pasted prompts became text attachments; ChatGPT read them successfully.

## Single-label entry points

| Entry point | Blend | Observed result |
| --- | --- | --- |
| Complete prompt with blend supplied | G. L. Pease Quiet Nights | Researched package; revised writing-area geometry and corrected sRGB metadata. Exact downloaded ZIP passed production importer: one usable label. |
| Instructions first, request second | Orlik Golden Sliced | Instructions initially triggered a prior-scope lookup, stopped manually. Request produced one render. Exact ZIP passed production importer. |
| Complete prompt with no blend | Peterson Early Morning Pipe | Asked which list, suggesting old account memory. Given one explicit blend, generated and revised geometry/encoding. Exact ZIP passed production importer. |
| Request only, protocol absent | Cornell & Diehl Autumn Evening | Asked for authoritative schema instead of inventing it. Continued after instructions supplied; revised geometry/encoding. Exact ZIP passed production importer and browser Save as PDF. |
| Revised instructions only | None | Asked which blends and waited; no old-inventory lookup. |
| Repeat complete prompt with numeric placement guide | Quiet Nights | Produced three renders while chasing the suggested placement band. Reported validated ZIP; download/import pending. Numeric guide was removed. |

## Fixes deployed

- Require tobacco scope to be explicitly supplied or confirmed in the current conversation. Do not retrieve inventories from account memory or other chats. Instructions without a request ask and wait. Verified in the fifth fresh chat.
- Separate failure to load the app's dynamically imported label reader from an invalid ZIP. A stale production tab originally blamed an unchanged valid ZIP after deployment. The new alert offers reload and does not generate an AI repair prompt.
- Clarify that the entire writing-panel outline must remain inside the circular safe inset. An experimental numeric placement band increased revisions, so it was removed rather than called an improvement.

97 tests passed, including scope and stale-module-error regression coverage; lint and production build passed. Deployment: `8985c54d-72ff-4678-88a4-b48a7d7161cb`. Published protocol checked on tintocellar.com.

## Download and print evidence

The embedded browser did not save Library ZIP downloads. A normal Helium browser using the same account successfully downloaded the first four exact files. No user download assistance was required. This is a browser-environment limitation, not a failed ZIP validator.

Files in Downloads:

- `quiet-nights-final.cellarpack.zip`
- `orlik-golden-sliced.cellarpack.zip`
- `peterson-early-morning-pipe.cellarpack.zip`
- `cornell-diehl-autumn-evening.cellarpack.zip`

`tin-to-cellar-autumn-evening-e2e.pdf` was saved using the actual production site's browser print flow. Independently inspected with Poppler and PyMuPDF: one US Letter page (612 × 792 points), 180-point/2.5-inch circular trim at (27,72) points, 198-point bleed image, no extracted text and no website-added writing line or words. Rendered page visually inspected. Physical printer alignment has not been tested.

Four of five generation runs needed artwork revisions before final packaging. Successful import is evidence of structural validity, not a guarantee of exact brand fidelity or first-pass generation.

## Larger batch tests — running

Two additional fresh sessions use the current instructions:

- Nine distinct blends: Quiet Nights, Early Morning Pipe, Golden Sliced, Autumn Evening, Pirate Kake, Nightcap, My Mixture 965, HH Old Dark Fired, Full Virginia Flake.
- Ten distinct blends: the same nine plus Westminster.

Both acknowledged their complete scope, began inspecting package references, and started generating. ZIP completeness, import, and one-/two-page PDF gates remain pending.

## Test chats

- Complete prompt: https://chatgpt.com/c/6a9c841f-33d4-83ea-a1d8-e5f11cf84258
- Split instructions/request: https://chatgpt.com/c/6a9c842c-c748-83ea-8248-b9e740f79c1b
- No supplied blends: https://chatgpt.com/c/6a9c8439-251c-83ea-9474-af054b397a5e
- Missing protocol recovery: https://chatgpt.com/c/6a9c846b-9de0-83ea-b348-656548116fa9
- Revised scope rule: https://chatgpt.com/c/6a9c8490-4954-83ea-8409-5e4ef2a8f4ee
- Repeat Quiet Nights: https://chatgpt.com/c/6a9c85f4-0978-83ea-b173-02766148a6ca
- Nine labels: https://chatgpt.com/c/6a9c88aa-0f34-83ea-bda5-e558e63e4cfc
- Ten labels: https://chatgpt.com/c/6a9c88b3-7fc4-83ea-a93c-64876735b8f5

## Artwork-fidelity rejection

The user rejected the large-batch artwork as insufficiently faithful to the original packages. These runs are NOT accepted end-to-end successes, regardless of archive validation. Follow-up inspection of the actual Orlik 100g image showed that its judge portrait was real; the ten-label model's decision to remove it as invented was wrong. See `artwork-fidelity-experiment-2026-09-05.md` for a controlled comparison using the exact reference image. This supersedes any optimistic interpretation of the earlier model self-reviews.
