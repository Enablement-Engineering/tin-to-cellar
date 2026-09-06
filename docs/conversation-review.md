# Conversation review and example design

Reviewed on 2026-09-06. This review separates the chat's claims from independently inspected files and website results. Examples in protocol 0.0.15 model concise communication; they do not replace the workflow or guarantee model behavior.

## Evidence

- [Create cellar labels](https://chatgpt.com/c/6a9d2256-ee38-83ea-8fd0-ef1d108b3675): inspected the saved chat. It asked the user to paste a long exact repair message; a shorter reference to its prepared brief subsequently produced an isolated image. Preserved scoped-turn notes record that Continue had triggered an extra image before review. Detailed commands and hashes in later responses were partly prompted by explicit diagnostic requests, so those are appropriate audit output rather than evidence that all technical detail should be forbidden.
- [Request complete protocol](https://chatgpt.com/c/6a9d2b94-7da8-83ea-8eff-435807b9903f): inspected the saved chat. Its final response claimed no unresolved limitations and listed schemas, geometry and hashes. The untouched ZIP imported, but independent proofs and a second review found text outside the safe guide. Import success did not establish visual correctness.
- [Request protocol prompt](https://chatgpt.com/c/6a9d2461-17c4-83ea-bf0c-cf5e717ccf89): preserved download/import evidence in `output/protocol-r10-e2e/work-run.md` records a valid ZIP with the manifest inside an enclosing folder. Repacking exposed a separate Westminster writing-panel defect. These were two different failures.
- [Request Instructions](https://chatgpt.com/c/6a9d3379-bb84-83ea-a735-aaada5162124): the completed review in `output/protocol-r12-e2e/run.md` records seven isolated calls, no extra user cues after the complete prompt, original ZIP acceptance and a correct site preview. Original proof pixels matched independent rerenders. Full-copy delivery worked; hosted retrieval did not. This is the successful pattern to retain.

## Cases and example choices

| Case | What to retain or change | User-facing example |
| --- | --- | --- |
| A real choice blocks progress | Offer two or three numbered options and accept ordinary replies; do not make routine work a menu | “Which packaging design would you like?” |
| Routine progress | State the next useful action; do not narrate tool calls | “I'll check the lettering and date space before creating the ZIP.” |
| Continue after an image | Resume review first; don't generate merely to resume | “I'll check the image already made, then finish the remaining labels and ZIP.” |
| Long repair prompt demanded | The agent composes its own image brief | “The date space is too close to the edge. I'll move it inward and check it again.” |
| Composite image | Reject it, preserve good labels, obey per-label limits | “That image combined the labels, so I won't use it.” |
| Repeated isolation failure | Report a real capability limit; no endless Continue loop | “This chat can't reliably keep the labels separate. I've stopped rather than use the combined image.” |
| ZIP layout failure | Repair packaging only and reopen the replacement | “The ZIP was packaged incorrectly. I'll rebuild it using the existing labels.” |
| Import passes but artwork looks wrong | Separate structural acceptance from visual judgment | “The site accepted the file, but that doesn't settle whether the lettering fits.” |
| Download fails | Recover the existing artifact before any new generation | “I'll check the saved ZIP and provide a fresh download.” |
| Audit requested | Share actual evidence and limitations; don't suppress technical detail | “I can share the saved proofs and measurements for inspection.” |
| Successful delivery | One ZIP link, printing link and short next action | “Your labels are ready. Download the ZIP, then choose it on the printing page.” |

The protocol examples include conditions for these statements so they cannot serve as canned success claims. Few-shot copy can improve communication and reinforce sequencing, but it cannot supply missing reference-selection controls or certify artwork. No new image-generation end-to-end pass is claimed for this copy-only update.
