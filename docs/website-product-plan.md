# Tin to Cellar — Website Product Plan

Status: historical broader plan. The current UI scope is defined in [the simplified workflow](simplified-workflow.md).
Scope: website experience only; no implementation design
Product principle: the agent creates a portable artwork pack; Tin to Cellar validates, arranges, and prints it accurately.

## 1. Product summary

Tin to Cellar helps a pipe-tobacco collector turn a list of blends and optional visual references into recognizable, original jar-label artwork, then arrange that artwork on a reliable print sheet.

The website has two related but independent jobs:

1. **Configure a generation request.** It collects the tobacco list, desired label geometry, art direction, and inspiration references, then generates a prefilled ChatGPT link and copyable prompts for ChatGPT or Codex.
2. **Prepare a Cellar Pack for print.** It imports a `.cellarpack.zip`, validates its artwork and metadata, lets the user compose sheets, and exports or prints them at physical size.

This separation is foundational:

- **Artwork geometry** describes one finished label: shape, finished dimensions, bleed, safe region, image crop, and write-in region.
- **Sheet layout** describes how label instances are imposed on paper: page size, margins, rows, columns, pitch, rotation, and printable area.

A circular 2.5-inch artwork can therefore be printed on Avery 94502, laid out freely on full-sheet sticker paper, exported as an individual image, or placed on a future compatible stock without regenerating the art.

## 2. Problem statement

Collectors can find or generate attractive tobacco imagery, but converting it into useful jar labels requires several different skills: researching the real tin, giving an image model coherent art direction, reserving a writable date area, sizing artwork correctly, understanding label-sheet geometry, and printing without browser scaling. Existing image-generation workflows do not reliably package the images and metadata needed by a print tool, while generic design tools make exact label-sheet setup tedious.

Tin to Cellar should let a non-designer complete this workflow while preserving control over provenance, visual adaptation, physical dimensions, and local privacy.

## 3. Goals and outcomes

### User goals

- A first-time user can produce a complete generation prompt without already knowing what technical or art-direction questions to ask.
- A user can import a valid Cellar Pack and reach an accurate print preview without manually entering information already present in the pack.
- A user can make a test print, correct printer alignment, and print final labels at 100% physical scale with confidence.
- A user can understand which real package references informed each generated design and choose among variants without that information appearing on the printed label.
- A user can complete the MVP workflow without creating an account or uploading artwork to Tin to Cellar servers.

### Product-learning goals

- Validate that users can successfully move from prompt generation to pack import across separate ChatGPT/Codex and browser sessions.
- Learn which surface presets, shapes, and failure cases occur frequently enough to merit first-class support.
- Determine whether users prefer handwritten dates, typed dates, or a mix without prematurely adding inventory-management features.

### Suggested validation measures for a consent-based beta

The MVP is analytics-free. Validation should use opt-in interviews, an optional post-export feedback form that opens only on request, and user-supplied diagnostic files.

- At least 8 of 10 moderated participants generate or obtain a pack and successfully import it without facilitator intervention.
- At least 8 of 10 can explain the difference between label size and sheet choice after using the configurator once.
- At least 9 of 10 produce a calibration sheet whose measured reference mark is within the documented tolerance after following instructions.
- At least 80% of tested malformed packs yield an error that participants can correctly act upon.

## 4. Non-goals for MVP

- Generating images inside the Tin to Cellar website. Generation occurs in ChatGPT, Codex, or another compatible agent.
- User accounts, cloud projects, shared galleries, or server-side asset storage.
- QR codes, tasting-note databases, cellar inventory, aging reminders, or purchase tracking.
- Public redistribution of source tin imagery.
- A promise of trademark approval or exact reproduction of commercial packaging. The workflow produces recognizable, original adaptations and records research provenance.
- Supporting every commercial label stock at launch. MVP proves a preset plus general full-sheet/custom workflows.
- Automatic extraction of untrusted ZIP contents into a server environment.

## 5. Personas and jobs to be done

### The occasional cellaring hobbyist

Has a home inkjet printer and a few jars. Wants labels that feel related to the original tins but does not know print terminology.

**Job:** “When I move tobacco into jars, help me create attractive labels I can identify at a glance and date by hand without learning a design tool.”

### The meticulous collector

Maintains many blends and values consistent naming, dates, provenance, and archival quality. May print several sheets and revisit a project.

**Job:** “When I prepare a cellar batch, let me inspect and arrange every label deliberately, verify its source inspiration, and print it predictably.”

### The creative customizer

Brings tin photographs, historical imagery, or a house style. Wants control over shape, proportions, crop, and variants.

**Job:** “When I have a visual idea, carry it through generation and printing without forcing me into one Avery product or a generic template.”

### The prompt-first ChatGPT user

May arrive with only tobacco names. Wants the assistant to research real packages and ask the missing questions.

**Job:** “When I do not know how to direct the process, launch a conversation that guides me and returns files the website understands.”

### The file-oriented Codex user

Is comfortable downloading a skill or copying a structured prompt. Values deterministic validation and correctly assembled ZIP output.

**Job:** “When artwork is generated, package it reproducibly and tell me what failed before I import it.”

## 6. Experience principles

1. **Physical truth over screen resemblance.** Inches, bleed, printable area, and 100% scale are first-class concepts.
2. **Research before resemblance.** The generator must first research the actual tin/package artwork and record sources before making a recognizable adaptation.
3. **Adapt, do not counterfeit.** Explain that the result is original cellar art informed by visual characteristics, not a replacement commercial label.
4. **One source of geometry truth.** The pack describes artwork; the selected stock describes imposition. The UI never silently rewrites one to match the other.
5. **The artwork makes room; HTML supplies precision.** Generated art includes a light, visually integrated blank date-writing surface. The website adds crisp `JARRED` or `CELLARED` text and a writing line inside its declared region.
6. **Local by default.** Browsing a ZIP and editing a project should not send files off-device.
7. **Recoverable exploration.** Reordering, cropping, duplication, removal, calibration, and variant selection can be undone or reset.
8. **Provenance is visible but never printed unintentionally.** Sources and variant notes belong in inspection UI and optional metadata exports, not the label face.

## 7. End-to-end journey

### Stage A — Configure the request

1. User starts a new project.
2. User pastes tobacco names, one per line, or leaves the list empty.
3. User chooses a label shape and finished size, or starts from a stock preset.
4. User chooses bleed and date-field behavior.
5. User optionally adds reference URLs and identifies local inspiration files they plan to attach later.
6. The site displays a concise request summary and identifies missing or contradictory choices.

If the tobacco list is empty, the generated prompt explicitly asks the agent to interview the user about blends, manufacturer ambiguity, label count, geometry, date-field wording, reference materials, desired similarity, and deliverable format before beginning research or generation.

### Stage B — Handoff to an agent

1. User selects **Create in ChatGPT**, **Copy prompt**, or **Copy for Codex**.
2. The ChatGPT action opens `https://chatgpt.com/?prompt=<encoded prompt>`.
3. The prompt instructs the agent to perform preliminary visual research for every blend, resolve ambiguous products, cite the source pages/images used, derive recognizable visual characteristics, and then generate original adaptations.
4. If the website listed local files, the prompt asks the user to attach them in the destination conversation. The website does not imply that local files travel through the deep link.
5. The agent creates artwork, metadata, a contact sheet, and a validated `.cellarpack.zip`.

### Stage C — Import and inspect

1. User returns and drops/selects the pack.
2. Tin to Cellar parses it locally and validates schema version, paths, file types, image dimensions, declared geometry, normalized regions, and references.
3. The site shows blocking errors, recoverable warnings, or an import summary.
4. User previews each blend, provenance, research-derived art direction, and available generated variants.
5. User selects one variant per label where needed.

### Stage D — Compose a sheet

1. User selects Avery 94502, full-sheet sticker paper, or a custom sheet definition.
2. The site creates label instances from selected artwork.
3. User reorders by drag or keyboard/click controls, duplicates labels, removes instances, and inserts blank slots.
4. User adjusts crop/zoom per instance where the stock’s aperture requires it.
5. User previews finished edge, bleed, safe area, and non-printable zones.

### Stage E — Calibrate and print

1. User prints a low-ink calibration page on plain paper.
2. User measures a reference length and, for pre-cut stock, checks offset against the sheet.
3. User enters X/Y offset and, only where justified, scale correction.
4. Site shows the applied calibration and warns against conflicting browser/printer scaling.
5. User prints at 100% or exports PDF/HTML for later printing.
6. User may also export individual label images.

## 8. Epics and prioritized user stories

Priorities: **P0** is required for a useful public MVP; **P1** is a deliberate fast follow; **P2** preserves future direction.

### Epic 1 — Project configurator and agent handoff

#### TTC-01 — Enter a tobacco list (P0)

**Story:** As a hobbyist with known blends, I want to paste one tobacco per line so that I can configure a batch quickly.

**Acceptance criteria**

- Given a list with blank lines and surrounding whitespace, when it is parsed, then the preview shows clean entries without blank items.
- The original entered spelling remains available; the site does not silently “correct” manufacturer or blend names.
- Duplicate-looking entries are flagged for review rather than removed automatically.
- Each item can include an optional manufacturer and per-blend note.

#### TTC-02 — Begin without a list (P0)

**Story:** As a user who is still deciding what I need, I want to launch a guided agent conversation so that the agent asks all relevant questions before generating anything.

**Acceptance criteria**

- Given no tobacco names, when a prompt is generated, then it instructs the agent to conduct a structured interview before research or image generation.
- The interview covers blend identity, manufacturers where ambiguous, quantity, shape, finished size, bleed, print method/stock, date-writing treatment, desired fidelity, inspiration, and output pack.
- The page explains that the empty-list path continues in the agent rather than on the site.

#### TTC-03 — Define artwork geometry independently (P0)

**Story:** As a customizer, I want to set shape, finished dimensions, units, and bleed independently of sheet stock so that artwork can be reused across layouts.

**Acceptance criteria**

- Supported MVP shapes are circle, oval, rectangle/rounded rectangle, and custom aspect ratio.
- Width, height, and bleed display in inches and millimeters without changing the underlying physical size when units are switched.
- A circle cannot have conflicting finished width and height without a clear correction choice.
- Invalid, zero, negative, or implausibly large values block prompt generation and explain the valid range.
- The summary visibly distinguishes “label artwork” from “print sheet.”

#### TTC-04 — Choose a stock starting point (P0)

**Story:** As a home printer user, I want to choose Avery 94502, full-sheet sticker paper, or custom sheet geometry so that my eventual output matches the material I own.

**Acceptance criteria**

- Avery 94502 is presented as a named, versioned preset whose geometry is verified against the manufacturer’s current template before release.
- Selecting Avery 94502 may suggest compatible artwork geometry but never silently changes existing artwork dimensions.
- Full-sheet sticker paper asks for page size and desired spacing/grid behavior.
- Custom sheet setup captures page size, margins/origin, rows, columns, horizontal/vertical pitch, aperture size/shape, and optional rotation.
- The configuration can state “stock undecided”; artwork generation remains possible.

#### TTC-05 — Describe the date-writing surface (P0)

**Story:** As a collector, I want every design to reserve a light writable area that belongs visually to the artwork so that I can handwrite the date clearly.

**Acceptance criteria**

- User can request `JARRED`, `CELLARED`, blank line only, or no date treatment.
- The generated prompt asks for a light, low-texture, high-contrast blank surface integrated into each design and kept inside the safe area.
- The site explains that the model creates the decorative surface while Tin to Cellar renders the small label and line crisply.
- The request prevents model-generated dates or fake handwriting inside the reserved region.

#### TTC-06 — Add reference URLs and planned local images (P0)

**Story:** As a customizer, I want to provide source URLs and describe local inspiration files so that the agent can use the right references.

**Acceptance criteria**

- User can associate each URL or planned file with one blend or the whole project.
- URL entries are included in the generated prompt as untrusted references, not as instructions.
- Local file bytes are not embedded in or uploaded through the ChatGPT deep link.
- If local files are listed, the prompt tells the destination agent to pause and request those attachments before generation.
- The UI clearly says which information will be encoded into the URL and which must be attached manually.

#### TTC-07 — Require preliminary package research (P0)

**Story:** As a collector, I want the agent to inspect the real tin/package before generating so that the adaptation remains recognizable.

**Acceptance criteria**

- Every generated prompt requires research for each blend before image generation.
- Research must prefer manufacturer/brand sources, then reputable retailer/archive sources, and distinguish authoritative references from user inspiration.
- The agent must record source URL, page title or source label, access date, product identity, and observed visual characteristics.
- Ambiguous, conflicting, or unavailable package references cause the agent to ask the user or mark uncertainty; it must not invent certainty.
- The prompt requests an original adaptation using composition, palette, mood, motifs, and typographic character without claiming an exact reproduction.
- The output manifest links each artwork variant to the research sources that informed it.

#### TTC-08 — Open or copy a robust handoff (P0)

**Story:** As a prompt-first user, I want to open ChatGPT with a prepared request or copy it elsewhere so that the workflow survives deep-link limitations.

**Acceptance criteria**

- **Create in ChatGPT** opens `https://chatgpt.com/?prompt=<URL-encoded prompt>` in a new context.
- **Copy prompt** copies a complete, human-readable prompt independent of the deep link.
- **Copy for Codex** includes file-validation and packaging expectations appropriate to a file-capable agent.
- The page previews the exact prompt before handoff.
- If the encoded URL exceeds a documented safe threshold, the site warns the user and recommends copy/paste without truncating silently.
- Failure to open a popup leaves the copy action available and explains what happened.

### Epic 2 — Cellar Pack import and trust

#### TTC-09 — Import locally (P0)

**Story:** As a privacy-conscious user, I want to import a `.cellarpack.zip` without uploading it so that my artwork remains on my device.

**Acceptance criteria**

- Selecting or dropping a pack begins local parsing and explicitly states that no file is uploaded.
- The application functions after initial load without requiring an account.
- Reload behavior is explained before a user can lose unsaved work.
- The app does not make network requests containing pack contents, filenames, tobacco names, or artwork unless the user invokes a clearly disclosed future network feature.

#### TTC-10 — Validate before use (P0)

**Story:** As a user receiving files from an agent, I want the site to validate the pack so that malformed or unsafe contents cannot create misleading output.

**Acceptance criteria**

- Validation checks schema support, required metadata, unique IDs, path safety, declared/actual image dimensions, supported image formats, file-size/count limits, geometry ranges, region bounds, source references, and missing assets.
- Executable content, absolute paths, traversal paths, symlinks, nested archives, and unexpected active HTML/script files are rejected or ignored according to a documented policy.
- Blocking errors identify the affected file/label and a concrete corrective action.
- Non-blocking warnings can be acknowledged without being lost.
- No sheet is presented as print-ready while blocking errors remain.

#### TTC-11 — Inspect artwork, variants, and provenance (P0)

**Story:** As a careful collector, I want to see each label’s artwork, variant choices, and research basis so that I can choose confidently.

**Acceptance criteria**

- The inspection view shows blend, maker, artwork geometry, variant names, and a thumbnail/contact view.
- Each variant shows its recorded sources and a concise list of observed/adapted visual characteristics.
- Unverified or user-supplied sources are visually distinguished from stronger research sources.
- Source/provenance information is excluded from print output by default and cannot appear accidentally because of a print stylesheet failure.
- A user can choose one variant per blend before sheet composition; a sensible declared default may be preselected.

#### TTC-12 — Repair limited metadata safely (P1)

**Story:** As a user with an almost-valid pack, I want to correct harmless metadata omissions so that I do not need to regenerate all artwork.

**Acceptance criteria**

- Only non-destructive fields such as display name, maker, default variant, or date-field wording can be changed in the browser.
- The application never fabricates provenance or silently changes image geometry.
- User edits are identified separately from generator-supplied metadata in any re-exported pack.

### Epic 3 — Sheet composition

#### TTC-13 — Select or define sheet geometry (P0)

**Story:** As a printer owner, I want to select a stock preset or enter custom sheet measurements so that slots align with my paper.

**Acceptance criteria**

- Stock selection does not mutate source artwork geometry.
- The UI previews sheet outline, printable area, slot apertures, pitch, margins, and orientation.
- Impossible layouts (slots beyond the page, overlaps, invalid pitch) are blocked with measurements explaining the conflict.
- Custom definitions can be named and saved locally for reuse.
- Presets expose their version/source and can be reset to canonical geometry.

#### TTC-14 — Create and manage label instances (P0)

**Story:** As a collector printing a batch, I want to duplicate, remove, and insert blank slots so that the sheet matches the number and order of jars I have.

**Acceptance criteria**

- A label may appear in multiple slots without duplicating the underlying artwork asset.
- Removing an instance does not delete the source label from the imported pack.
- Blank slots remain visibly empty in both preview and print output.
- Overflow labels continue onto additional pages rather than disappearing.
- Page and label counts update immediately.

#### TTC-15 — Reorder accessibly (P0)

**Story:** As a mouse, touch, or keyboard user, I want to reorder labels so that I can control sheet placement using my preferred input method.

**Acceptance criteria**

- Pointer users can drag an instance to a new slot with a clear insertion target.
- Click/tap users can select an instance and choose a destination or move it by one position.
- Keyboard users can invoke move mode, navigate targets, commit/cancel, and receive position announcements.
- Focus remains on the moved item after the operation.
- Reordering is undoable and does not alter artwork files.

#### TTC-16 — Adjust crop and zoom nondestructively (P0)

**Story:** As a customizer, I want to reposition and zoom artwork within a slot so that important imagery survives the physical cut.

**Acceptance criteria**

- Crop/zoom operates on a label instance and preserves the original asset.
- Finished edge, bleed boundary, safe area, and reserved date region can be shown while adjusting.
- Reset returns to the manifest-declared default framing.
- The app warns when the image lacks sufficient pixels for the intended printed size at the documented quality threshold.
- The app does not imply that zoom can restore missing resolution.

#### TTC-17 — Render the writable date treatment (P0)

**Story:** As a collector, I want crisp date-field microcopy and a generous writing line over the artwork’s light surface so that the field prints clearly and remains usable by hand.

**Acceptance criteria**

- The site renders `JARRED`, `CELLARED`, or the selected alternative as HTML/vector text rather than relying on text generated in the bitmap.
- The line, type, and contrast remain legible at actual printed size.
- The overlay stays inside both the manifest-declared write-in region and finished-label safe area.
- A visual warning appears if the declared surface is too small or too close to the cut edge.
- Users can toggle the wording without regenerating artwork.
- The light writable background comes from the artwork; if it is absent or too dark, the label is flagged rather than silently covered with an unrelated opaque patch.

#### TTC-18 — Inspect guides without printing them (P0)

**Story:** As a printer user, I want to toggle safe, bleed, cut, and printable-area guides so that I can catch layout problems without putting guides on finished labels.

**Acceptance criteria**

- Each guide type can be toggled independently and has a legend.
- The preview unmistakably distinguishes cut edge from bleed extent.
- Production print and export omit guides by default.
- A separate explicitly labeled calibration/debug output may include guides.

### Epic 4 — Calibration, print, and export

#### TTC-19 — Make a low-risk test print (P0)

**Story:** As a home printer user, I want a plain-paper calibration page so that I can verify size and alignment before consuming label stock.

**Acceptance criteria**

- Calibration output contains a measurable reference segment and page/stock alignment marks.
- Instructions tell the user to print at 100% / Actual Size and disable Fit/Shrink/Scale-to-fit.
- The user can record measured length and X/Y alignment offsets.
- Scale correction is treated separately from positional offset and includes a warning that printer-driver scaling should be corrected first.
- Calibration values are stored locally per printer/stock profile when the user chooses to save them.

#### TTC-20 — Print at physical size (P0)

**Story:** As a user with label stock loaded, I want an exact-size final print view so that labels align with the sheet apertures.

**Acceptance criteria**

- Print output declares physical page and label dimensions, not viewport-relative dimensions.
- Before printing, the UI shows page size, stock, orientation, calibration profile, and expected scale.
- The final output excludes navigation, controls, provenance, warnings, shadows, and preview-only guides.
- The system warns when the browser reports a page-size/orientation mismatch where detection is possible.
- A printed calibration ruler can be measured against a stated tolerance; the app does not claim alignment solely from an on-screen preview.

#### TTC-21 — Export PDF and self-contained HTML (P0)

**Story:** As a user who may print later or elsewhere, I want portable PDF and HTML outputs so that I can preserve the prepared sheet.

**Acceptance criteria**

- PDF preserves page size, label geometry, crop, overlay text, page count, and calibration selection.
- Self-contained HTML includes required artwork/assets without depending on remote URLs.
- Both outputs omit provenance and controls from printed pages while retaining a human-readable project summary outside the print region where appropriate.
- Exported filenames are safe, understandable, and do not expose local source paths.
- Export failure leaves the project intact and offers a corrective action.

#### TTC-22 — Export individual labels (P0)

**Story:** As a user printing outside Tin to Cellar, I want individual final label images so that I can use another print service or cutter workflow.

**Acceptance criteria**

- Export can include selected variants or all composed labels.
- Each image has documented pixel dimensions, physical-size metadata where supported, finished/bleed interpretation, and whether the date overlay is included.
- Filenames are deterministic and collision-safe.
- Export does not bake preview guides unless explicitly requested as a diagnostic option.

### Epic 5 — Local continuity and quality assurance

#### TTC-23 — Preserve work locally (P1)

**Story:** As a returning user, I want to save and reopen a project locally so that I do not have to repeat composition work.

**Acceptance criteria**

- User can explicitly save/download a project file containing arrangement and references to included assets.
- Browser-local autosave, if offered, shows storage usage and can be deleted.
- A user can clear all locally stored Tin to Cellar data from within the product.
- Version incompatibilities are reported before any migration attempt.

#### TTC-24 — Produce a support bundle without artwork (P1)

**Story:** As a user with a print or import problem, I want to export non-sensitive diagnostics so that I can ask for help without sharing proprietary images or tobacco history.

**Acceptance criteria**

- Diagnostic export excludes artwork and source images by default.
- It includes app version, schema version, anonymized geometry, validation codes, browser print capabilities, and calibration settings.
- The user sees and can review the exact diagnostic contents before saving.

## 9. State, error, and empty-state model

### Configurator states

- **Fresh:** Two clear paths—“I have a tobacco list” and “Help me figure it out.”
- **Partially configured:** Preserve inputs, identify only blocking gaps, and explain why each is needed.
- **No list:** Valid state; agent-interview mode is shown in the summary.
- **Ambiguous blend entries:** Flag for agent research/clarification, not a website autocomplete guess.
- **Local inspiration listed:** Persistent reminder that files must be attached after opening ChatGPT/Codex.
- **Prompt too long for robust deep linking:** Keep prompt intact, emphasize copy actions, and never silently truncate.
- **Deep link blocked:** Explain popup/browser behavior and expose a one-action copy fallback.

### Import states

- **No pack:** Show accepted extension, privacy promise, a sample manifest link, and how to return from ChatGPT/Codex.
- **Reading:** Show local progress for large packs without implying upload.
- **Valid:** Summarize labels, variants, dimensions, warnings, and sources before composition.
- **Valid with warnings:** Allow continuation after warnings are reviewed; retain a warnings panel.
- **Invalid:** Separate pack-level, file-level, and label-level errors. Preserve the report after the user chooses another file.
- **Unsupported future schema:** Explain supported versions and preserve the original file untouched.
- **Resource-limit failure:** State which size/count limit was exceeded and why the limit exists.
- **Missing/unreadable image:** Identify the manifest entry and path; do not substitute a blank label unnoticed.

### Composition states

- **No labels selected:** Explain variant selection and offer to add all defaults.
- **Slots available:** Empty slots are visibly distinct from blank white artwork.
- **Overflow:** Add pages automatically and report how many labels remain on each page.
- **Geometry mismatch:** Explain whether artwork is smaller, larger, or has a different aspect ratio than the stock aperture; offer crop, contain, or stock change without mutating the source.
- **Low resolution:** Display intended pixels-per-inch and a quality warning; allow deliberate continuation.
- **Invalid write-in region:** Flag the label and prevent misleading “ready” status until corrected, hidden, or explicitly accepted.
- **Unsaved changes:** Warn before destructive navigation when local recovery is not guaranteed.

### Print/export states

- **Not calibrated:** Printing remains possible, but the product recommends plain-paper calibration and labels the risk.
- **Page mismatch:** Show expected versus detected/selected page settings where possible.
- **Exporting:** Keep editing disabled only for the affected action; do not discard the project on failure.
- **Export complete:** Identify exactly what was saved, page count, stock geometry, and whether guides/date overlay were included.

## 10. Accessibility requirements

- Meet WCAG 2.2 AA for the website UI.
- All configurator controls have persistent labels, instructions, validation associations, and error summaries.
- Color is never the only way to distinguish bleed, safe, cut, provenance quality, selection, errors, or warnings.
- Label thumbnails and generated artwork use meaningful names; source images receive accessible descriptions from metadata when available.
- Drag-and-drop has complete click/tap and keyboard alternatives, including destination announcement and undo.
- Canvas-like previews expose an equivalent semantic list of pages, slots, labels, positions, and warnings.
- Zoom controls do not depend on gestures; values can be adjusted numerically and reset.
- Focus order follows visual workflow and remains stable after reorder, import error, and modal dismissal.
- Status messages for import, validation, reorder, and export use appropriate live-region behavior without excessive announcements.
- Controls and important preview indicators meet target-size and contrast requirements.
- Print instructions do not rely only on screenshots; they include platform-neutral text.
- Motion is minimal and respects reduced-motion preferences.

## 11. Privacy, security, and trust boundaries

### Local-first MVP commitments

- No account required.
- No behavioral analytics, advertising pixels, remote error replay, or session recording.
- No pack, image, manifest, tobacco list, source URL, or generated prompt is uploaded by Tin to Cellar.
- Project state is memory-only unless the user explicitly saves locally or opts into clearly disclosed browser storage.
- Any third-party links are visible actions. Opening ChatGPT is a boundary crossing; the page summarizes what prompt text will be sent in the URL.
- Local image attachments selected/planned in the configurator are not represented as transmitted to ChatGPT. The destination conversation must request them.

### ZIP and document safety

- Treat every pack as untrusted input even when created by an agent.
- Validate paths, MIME signatures, image decode results, decompressed totals, compression ratios, entry counts, schema depth, and string lengths.
- Never execute pack content, inject metadata as HTML, or fetch embedded remote references automatically.
- Source URLs are displayed as inert/escaped text until the user chooses to open them.
- Use a strict, documented allowlist of media formats and schema fields.
- Preserve the original pack; validation and browser edits operate on a derived project model.

### Visual/IP trust

- Show sources and adaptation notes during review.
- Never claim manufacturer endorsement.
- Require the generator to distinguish observations from interpretation and report missing/conflicting references.
- Keep reference imagery and provenance out of printable output unless the user deliberately exports a separate research report.

## 12. Technical-risk and validation stories

These are framed around user-visible trust, not internal architecture tasks.

### RISK-01 — Deep-link compatibility

**Story:** As a user, I want the prepared request to survive browser and ChatGPT URL limitations so that I do not arrive with an incomplete prompt.

**Validation:** Test encoded punctuation, Unicode tobacco names, multiline prompts, maximum practical lengths, authentication redirects, mobile browsers, popup blocking, and changes to ChatGPT query handling. Treat deep linking as a convenience, never the only handoff.

### RISK-02 — Physical-size fidelity

**Story:** As a printer user, I want a measurable proof that output scale is correct so that I do not waste label stock.

**Validation:** Establish a print test matrix across major browsers, macOS/Windows print dialogs, Letter/A4, common inkjet drivers, PDF viewers, and borderless modes. Measure output, not screenshots. Publish known limitations and a tolerance.

### RISK-03 — Preset correctness and drift

**Story:** As an Avery user, I want the named preset to correspond to the current physical product so that the sheet aligns.

**Validation:** Store preset version and provenance; compare against manufacturer template and physical sample before release. Provide user-adjustable calibration rather than treating published geometry as sufficient proof.

### RISK-04 — ZIP exhaustion and hostile metadata

**Story:** As a local-first user, I want imports to remain responsive and safe even when a pack is malformed.

**Validation:** Fuzz traversal, ZIP bombs, extreme image dimensions, corrupted decoders, duplicate filenames, Unicode confusables, cyclic/deep JSON, huge source lists, nested archives, scripts disguised as images, and unsupported schema versions.

### RISK-05 — Browser memory pressure

**Story:** As a user with many high-resolution labels, I want a clear limit and recoverable behavior so that the tab does not crash and lose my work.

**Validation:** Define supported pack/asset/count limits from low-memory device tests; decode thumbnails separately from export-resolution assets; show resource estimates and save-state advice before risky operations.

### RISK-06 — PDF and HTML parity

**Story:** As a user choosing an export format, I want equivalent physical geometry so that format choice does not change alignment.

**Validation:** Use golden geometry fixtures and physical measurements to compare direct print, PDF printed at actual size, and self-contained HTML. Verify fonts, image orientation metadata, clipping, color/background printing, and multipage overflow.

### RISK-07 — Write-in usability

**Story:** As a collector writing by hand, I want the light date surface to remain usable after image generation, clipping, and print so that decorative art does not obscure the date.

**Validation:** Test surface dimensions, luminance/texture, inkjet output, common pen/pencil types, overlay contrast, and distance from cut edge on representative shapes. Use a declared minimum region and flag nonconforming packs.

### RISK-08 — Research/provenance completeness

**Story:** As a collector, I want to know when an adaptation lacks a reliable real-package reference so that recognizability is not presented as verified.

**Validation:** Use fixture packs with authoritative, conflicting, user-provided, dead, and absent sources. Confirm the UI reflects source strength and uncertainty without blocking legitimate user-directed inspiration.

### RISK-09 — Accessibility of visual composition

**Story:** As a keyboard or screen-reader user, I want the same composition power as a drag user so that visual layout is not an accessibility barrier.

**Validation:** Complete full import-to-export workflows without pointer input and with representative screen readers; test reorder announcements, crop values, guide warnings, page/slot semantics, and focus restoration.

## 13. Phased scope

### MVP — Prove the complete loop

- Tobacco-list and empty-list configurator paths.
- Shape, finished dimensions, bleed, date-field preference, and stock preference.
- Avery 94502, full-sheet sticker paper, and custom sheet geometry.
- Reference URLs and planned local-file handoff messaging.
- Mandatory preliminary real-package research in generated prompts.
- ChatGPT deep link plus copy-prompt and Codex fallbacks.
- Local `.cellarpack.zip` import and strict validation.
- Artwork/variant/provenance inspection.
- Sheet preview; pointer and keyboard/click reorder.
- Duplicate, remove, blank slots, and multipage overflow.
- Nondestructive crop/zoom.
- HTML-owned `JARRED`/`CELLARED` treatment over the artwork’s light reserved surface.
- Safe, bleed, cut, and printable-area guides.
- Plain-paper calibration, saved-in-session offsets, and 100% print instructions.
- Direct print, PDF, self-contained HTML, and individual image export.
- No accounts, cloud persistence, analytics, QR codes, or inventory features.

### Phase 1.1 — Reduce repeat-work friction

- Explicit local project save/reopen.
- Browser-local saved custom stock and calibration profiles.
- Safe, bounded metadata repair.
- Non-sensitive support bundles.
- Additional manufacturer-verified stock presets selected from user demand.
- Better contact-sheet comparison and batch crop tools.

### Phase 2 — Extend interoperability without weakening local-first

- Publish the Cellar Pack schema, JSON Schema, conformance fixtures, and validator.
- Installable Codex skill and versioned prompt recipes.
- Optional generator compatibility beyond ChatGPT/Codex.
- Import/export adapters for common design or cutter workflows.
- Progressive web app/offline caching, with explicit version and storage controls.
- Opt-in, privacy-preserving feedback—not background behavioral analytics.

### Deliberately parked

- Integrated paid generation.
- Accounts, syncing, public galleries, community templates, and collaboration.
- QR codes, tasting notes, cellar inventory, and reminders.
- Affiliate commerce.

## 14. Open questions

### Blocking before implementation

1. **Product/design:** Is the MVP’s canonical date term `JARRED`, `CELLARED`, or user-selectable with one default?
2. **Product/spec:** Does a Cellar Pack store a single label artwork with variants, or are variants modeled as separate artworks grouped by blend? The UI and validation depend on this.
3. **Spec/design:** Is the light write-in surface mandatory in every artwork, or may the manifest explicitly declare “no surface” when the user selected no date treatment?
4. **Print engineering:** What physical tolerance defines “accurate” for calibration and final output, and which browser/OS/printer combinations are supported at launch?
5. **Product/engineering:** Which exact custom-sheet inputs are necessary to model both die-cut label stock and free-layout full-sheet paper without confusing non-experts?
6. **Legal/product:** What language should describe recognizable adaptation, source use, trademarks, and lack of manufacturer affiliation?
7. **Product:** Should PDF export be a true browser-local generated PDF in MVP, or is “Print / Save as PDF” an acceptable first release? This changes cross-browser verification scope.
8. **Engineering/security:** What maximum compressed size, decompressed size, entry count, image dimensions, and supported image formats define the conformance profile?
9. **Product/engineering:** Can self-contained HTML safely embed all assets within practical browser/file-size limits, and what fallback is offered when it cannot?
10. **Design:** Should selecting a stock preset before generation create a suggestion for artwork geometry, or should presets remain entirely confined to the print studio?

### Non-blocking discovery questions

1. Do users usually print one of each blend or several duplicates?
2. Do users date with pen, pencil, or a typed date, and what minimum physical writing area works in practice?
3. How often do users have an original tin/photo versus relying on web research?
4. Is a contact sheet useful primarily for variant selection, archival reference, or both?
5. Which non-Avery stock families should follow based on observed demand?
6. Do users need image export including bleed, finished crop, or both?
7. How often does calibration vary by printer versus by paper/stock versus by browser/PDF path?
8. Would a one-page “return from ChatGPT” checklist materially reduce pack-import failures?

## 15. Release gates

Tin to Cellar MVP is ready for a limited beta only when:

- The website can complete a full local-first import-to-print workflow using a conforming multi-label pack.
- Malformed and hostile fixture packs fail safely with actionable messages.
- Avery 94502 geometry has documented provenance and has been verified with a physical sheet.
- Direct print, PDF, and HTML outputs pass the agreed physical measurement tolerance on the supported matrix.
- The date-writing surface and overlay remain fully inside the safe area on all supported shapes and are legible in physical tests.
- The full workflow can be completed without a mouse.
- No pack content, tobacco names, prompts, or source URLs leave the browser during the local print workflow.
- The ChatGPT deep link has been tested, while copyable prompts remain a fully functional fallback.
- Variant and provenance data are inspectable in the interface and absent from final print output.

## 16. Recommended product framing

The clearest promise is:

> **From tin inspiration to print-ready cellar labels.** Research and create with your preferred AI, then arrange, calibrate, and print privately in Tin to Cellar.

This framing makes the trust boundary understandable: the agent handles research and creative generation; the website handles portable files, precise geometry, and print reliability.
