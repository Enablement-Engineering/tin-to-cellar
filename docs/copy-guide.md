# Website copy

Tin to Cellar should sound like someone explaining a useful hobby tool. Use familiar words, name the action the reader can take, and leave out claims the app cannot support. Keep the personal voice on About; keep instructions direct in the tools.

## Enablement Engineering

The owner's direction is a philosophy and practice of expanding what people can do with technology, with care for human needs and equitable access to its benefits. Accessibility and education are central. Describe this broader purpose instead of reducing the practice to AI services or a list of industries.

The About page connects that purpose to Dylan and this small project. Avoid invented personal stories, corporate sales language, or promises of outcomes for every user.

## Wording choices

- Use “AI chat” for the general workflow. Use “ChatGPT” when naming or linking that specific product.
- Introduce CellarPack as the ZIP containing the labels. Technical terms belong where they explain a file requirement or help repair a problem.
- “Copy prompt” includes the complete request and instructions. The request preview stays readable; “Full copied text” reveals the entire payload.
- Keep instruction version information in the advanced choices and feedback reports, in plain language. Do not hide differences that affect which instructions a chat uses.
- Imported ZIPs and artwork are read in the browser. Import separately shares validated feedback and public source links with fixed observations. Print-guide access starts automatically in Make a prompt; the AI can use that service or make guide images in its own environment. That environment is not necessarily the user's device.
- Tell people what failed and what they can do next. Keep precise file errors available for the AI repair request.
- Explain print settings using the names people will recognize in a print dialog. Horizontal and vertical adjustments include directions and inch units.
- Avoid guarantees about tobacco preservation, exact physical print results, or an AI service's success. Encourage a plain-paper alignment check where it is useful.
- Keep maker attribution in the footer: automatic-year copyright, About and Inspiration links, and a centered “Made with ❤️ by Enablement Engineering” credit.

## Audit coverage

Reviewed all six views: Home, Make a prompt, Print labels, How it works, About, and Inspiration. The pass included site metadata, navigation, input hints, order reading, prompt copying and recovery, optional hosted checks, ZIP import results, feedback reports, quantities, and alignment instructions. Shared order-reading and pack-import recovery messages were checked against the controls the app actually provides.

The audit removed an unsupported preservation claim and an exact-print promise. It corrected the outdated full-prompt instruction, recovery directions for nonexistent sheet-selection controls, scanned-PDF recovery, and print-capacity guidance. It also clarified where AI guide images are created and fixed singular/plural report and label counts.

The changes affect presentation and explanatory text. AI instruction contracts, schemas, file validation rules, and physical print geometry retain their existing behavior. Existing tests keep checking those behaviors; text assertions change only where the visible wording changed.

## Verification

All 156 tests across 27 files passed after the copy changes, along with lint and typecheck/build. Browser review covered all six views, the advanced prompt choices and copy status, feedback guidance, and print instructions with ten labels across two sheets. The maker credit is centered at 320px and 1440px; reviewed pages fit without horizontal scrolling. The older label fixture contained obsolete overlay settings, so a separate local review copy retained only its blank overlay mode. Original artwork and the source ZIP were unchanged. No physical printing or deployment was performed for this pass.

## Automatic guides and shared source collection

Print guide access now starts automatically in Make a prompt. ZIP import separately submits validated AI feedback and public source links with fixed observations; the ZIP and artwork remain on the device. Do not describe all import data or feedback as browser-only. Separate JSON report imports are still local. Privacy is linked from the footer and import notice.
