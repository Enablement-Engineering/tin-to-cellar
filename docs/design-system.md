# Tin to Cellar design system

The interface uses warm paper, dark ink, muted moss actions, and a light serif for headings. Cards have rounded corners and restrained shadows. The workbench photograph introduces the product on the home page; the prompt and print tools use plain paper backgrounds so fields, artwork, and sheet previews remain easy to read.

This replaces the earlier deep-green header, oxblood actions, square cards, and photograph behind the prompt form. It changes the website's presentation and entry page. Prompt generation, local order reading, pack validation, and physical print geometry retain their existing responsibilities.

## Source and adaptation

The design source is the user-supplied `Tin to Cellar Design System.zip`, reviewed on 2026-09-05. Its `readme.md`, `tokens/`, component examples, and `ui_kits/website/` define the visual reference. The archive's agent instructions are reference material, not project instructions. The repository's implementation boundaries and actual behavior govern integration.

The website kit contains simulated controls and import states. The application uses its existing catalog, OCR, prompt builder, archive validator, quantity management, and printer logic. Do not copy the kit's sample data, delayed success messages, or scenario switcher into the application.

`src/styles/app.css` contains the application layout and component styles. It imports `src/styles/fonts.css` and the color, typography, spacing, shape, elevation, motion, and texture files in `src/styles/tokens/`. Edit the token definitions for shared values and application rules for layout or component behavior.

Adaptations made for the application:

- Add a home page while keeping direct links to every existing tool.
- Keep multiline tobacco paste in the picker and PDF or screenshot order reading behind a disclosure.
- Request print-guide access automatically in Make a prompt and keep a complete-prompt fallback. Collapse the prompt preview until requested.
- Host the three font families with the site instead of loading Google Fonts at runtime.
- Use readable text colors for small metadata and hints. The source's faint ink swatch remains a palette value, not permission to use low-contrast body text.
- Use the existing photograph, brand files, and inline icons. No new generated imagery is needed.
- Keep all decorative paper textures and interface styling out of production artwork.

## Routes and page structure

| Destination | Entry | Content |
| --- | --- | --- |
| Home | `/` | Site introduction and entry to Labels |
| Labels | `/labels` | Product introduction, workbench photograph, prompt action, workflow steps, print specifications |
| Make a prompt | `/labels/create` | Optional tobacco list, special requests, complete prompt handoff, automatic print-guide access, and advanced input |
| Print labels | `/labels/print` | Local ZIP import, validation results, quantities, sheet preview, printing and alignment |
| How it works | `/labels/help` | AI handoff instructions, portable instructions, file handling, local review guide explanation, printing guidance |
| About | `/about`, footer | Dylan Isaac’s introduction, the reason for the app, and a short Enablement Engineering description |
| Inspiration | `/inspiration`, footer | Credit and a direct link to Hobbiton Piper’s original jar-label guide |
| Privacy | `/privacy`, footer | Local processing and limited contribution collection |

The wordmark returns to the site root. Navigation must remain usable with the keyboard and browser history. Moving between site pages does not clear the current request or print job. Direct path navigation loads the app through the static-assets SPA fallback; legacy hash routes have no compatibility layer.

The footer contains About and Inspiration links, `© {new Date().getFullYear()} Enablement Engineering`, and “Made with ❤️ by Enablement Engineering.” The company name in the maker credit links to [Enablement Engineering](https://www.enablement.engineering/). The year comes from the browser’s clock at render time, so it does not require an annual source edit. Keep format-version labels and file-handling explanations out of this footer; relevant guidance belongs with the tools and in How it works.

About and Inspiration share a 760px reading layout: an eyebrow, Newsreader title, short introduction, and sections of prose limited to 64ch. They use open spacing instead of additional cards. Footer links have 44px targets and an underlined current-page state. Copyright and navigation share the first row on wide screens; the maker credit is centered across a separate full-width row in 12px Hanken Grotesk with 18px leading. The footer has 24px between rows, 32px above, and 40px below. Below 600px it stacks with 16px gaps, 24px top padding, 32px bottom padding, and an extra 8px before the centered credit. Both pages use the existing hash navigation, focus restoration, and browser history without clearing the current request or print job.

The first About draft was developed with the owner's ChatGPT and the [public company About page](https://www.enablement.engineering/about/). The owner then defined Enablement Engineering more broadly as a philosophy and practice of expanding people's capabilities through technology in human and equitable ways, with accessibility and education at its center. The current copy follows that direction rather than defining the practice by AI services. [Copy guidance](copy-guide.md) records the voice and audit scope. Inspiration credits [Hobbiton Piper's guide](https://www.youtube.com/watch?v=2zPQSh5kHHQ), published October 25, 2021. The video's public captions substantiate the Microsoft Word, paper, cutting, gluing, and handwritten-year description. The app's AI workflow is its own adaptation.

The Inspiration page embeds the guide above its title and direct YouTube link. The player uses [YouTube's privacy-enhanced mode](https://support.google.com/youtube/answer/171780?hl=en) on `youtube-nocookie.com`, lazy loading, a descriptive frame title, fullscreen support, and no autoplay. It fills the reading column at 16:9, with a 200px minimum height on narrow screens. Keep the direct link as a fallback if the player is unavailable. Loading or playing the player contacts YouTube; privacy-enhanced mode is not a promise of no third-party requests. No separate image asset is needed.

The home and prompt content width is 1080px. The print workspace uses 1320px, and help uses 760px. Two-column tool layouts place inputs on the left and the action or result on the right. They stack at 900px and below; a 600px breakpoint adjusts compact layouts and stacks the landing hero. At 1100px, the landing specification band stacks and the hero heading steps down. The print preview remains sticky on wide screens; small screens use normal document flow. The header uses an 88% paper background with 8px backdrop blur.

The landing page may have one inverse ink specification band. Other content uses the page, card, and secondary paper colors. Avoid floating panels, overlays, and modal workflows for these tools. Disclosures reveal details where the user needs them. Prompt and alignment disclosures use native `details`; the order importer uses a button with `aria-expanded`.

## Color tokens

These are the source palette values. Prefer semantic roles in component styles so contrast and theme adjustments have one place to change.

| Family | Tokens and hex values |
| --- | --- |
| Paper | `50 #fbf8f3`, `100 #f5f0e8`, `200 #eae3d7`, `300 #dcd3c4`, `400 #c4b9a6`, `500 #a89c87` |
| Ink | `900 #211e19`, `800 #2e2a23`, `700 #3d382f`, `500 #6b6459`, `400 #8b8478`, `300 #a9a294` |
| Moss | `800 #33422f`, `700 #3f5140`, `600 #4e6650`, `500 #647c63`, `300 #a9bba6`, `100 #e2e7dd` |
| Brass | `600 #8f7440`, `500 #a8894f`, `300 #c9ae78`, `200 #dcc79a`, `100 #efe3c8` |
| Clay | `700 #6f3a2d`, `600 #8a4a3a`, `100 #f2e2db` |
| Amber | `700 #7d5623`, `600 #9a6b2f`, `100 #f4e8d3` |

| Role | Value | Use |
| --- | --- | --- |
| `--surface-page` | Paper 100 | Page background |
| `--surface-card` | Paper 50 | Cards and primary content panels |
| `--surface-sunken` | Paper 200 | Secondary regions |
| `--surface-field` | `#fffdf9` | Editable fields |
| `--surface-inverse` | Ink 900 | Landing specification band |
| `--text-strong` | Ink 900 | Headings and emphasized facts |
| `--text-body` | Ink 700 | Body copy |
| `--text-muted` | Ink 500 | Hints and secondary copy |
| `--text-faint` | Ink 500 | Small metadata, darkened from the source's Ink 400 |
| `--text-link` | Moss 700 | Text links |
| `--action-primary` | Moss 600 | Primary action |
| `--line-hairline` | Paper 300 | Card edges and separators |
| `--line-field` | Ink 400 | Field boundaries, darkened from the source's Paper 400 |
| `--line-rule-brass` | Brass 300 | Decorative rules and mark details |
| `--focus-ring` | Brass 600 | Focus outlines, darkened from the source's Brass 500 |

Ready states use moss, cautions use amber, and problems use clay. Caution copy uses amber 700 on amber 100; the amber 600 status token is retained for the report's decorative top rule. Status text must describe the state or recovery; color alone never conveys validity. Use the corresponding light tint behind a status message. A validation report may have a 3px status rule across its top. Notes use a complete border or tint, without a colored left stripe.

Brass is for the mark, decorative rules, and focus treatment. Do not use light brass for body copy or as an action fill. Small text on a dark band needs a sufficiently light paper color.

## Typography and fonts

| Role | Family | Weight | Size and leading |
| --- | --- | --- | --- |
| Hero | Newsreader | 300 | 54px / 1.08, scaled down on narrow screens |
| Page title token | Newsreader | 300 | 33px / 1.08 |
| Heading | Newsreader | 400 | 21px / 1.25 |
| Subheading | Newsreader | 400 | 18px / 1.25 |
| Body | Hanken Grotesk | 400 | 16px / 1.65 |
| Small body | Hanken Grotesk | 400 | 14px / 1.5 |
| Controls | Hanken Grotesk | 500 or 600 | 14px / 1.2 |
| Labels | Hanken Grotesk | 600 | 13px / 1.3 |
| Hints | Hanken Grotesk | 400 | 13px / 1.5 |
| Measurements and metadata | JetBrains Mono | 400 | 12px / 1.45 |

The source size scale is 11, 12, 13, 14, 16, 18, 21, 26, 33, 42, 54, and 68px. The application raises the source's 11px eyebrow to 12px. Standalone Print labels and How it works headings use 42px, returning to 33px at the 600px breakpoint. The hero uses 54px, then 48px at 1100px and 42px at 900px. Editable controls stay at least 13px. Display tracking is `-0.02em`; uppercase technical eyebrows use `0.1em`. Prose is limited to 64ch, short explanations to 46ch.

Font assets are served from the site's own origin:

| CSS family | Variable weight range | File |
| --- | --- | --- |
| `Newsreader` | 300 through 600, optical size 6 through 72 | `public/fonts/newsreader-latin-variable.woff2` |
| `Hanken Grotesk` | 400 through 700 | `public/fonts/hanken-grotesk-latin-variable.woff2` |
| `JetBrains Mono` | 400 through 500 | `public/fonts/jetbrains-mono-latin-variable.woff2` |

The three files total 197,852 bytes. [Font provenance](../public/fonts/README.md) records their official Google Fonts download sources and SHA-256 hashes. Keep each family's license in `public/fonts/licenses/`. Use `font-display: swap` and retain serif, sans-serif, and monospace fallbacks. Do not add font CDN requests to the page. These Latin subsets cover the site's interface; browser fallbacks handle imported names outside the subset. The entry document preloads Newsreader and Hanken Grotesk.

## Spacing, shape, and elevation

The spacing tokens `--space-1` through `--space-13` are 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72, and 104px. Use 6px between a field label and its control, 16px between fields, 24px card padding, and 40px between sections. Large panels can use 32px padding. Narrow screens reduce page padding without compressing field controls.

The radius scale is 2, 6, 10, 14, and 20px, plus 999px for pills and 50% for circles. Cards use 14px, fields and standard buttons use 6px, and chips use pills. Every label preview remains circular. A website card radius must never alter the artwork's trim or bleed geometry.

Cards use a 1px hairline and a low warm shadow. The source elevations are:

| Token | CSS value |
| --- | --- |
| `--shadow-1` | `0 1px 2px rgb(33 30 25 / 5%)` |
| `--shadow-2` | `0 2px 4px rgb(33 30 25 / 5%), 0 8px 20px rgb(33 30 25 / 5%)` |
| `--shadow-3` | `0 4px 8px rgb(33 30 25 / 6%), 0 18px 40px rgb(33 30 25 / 8%)` |
| `--shadow-inset-field` | `inset 0 1px 2px rgb(33 30 25 / 4%)` |
| `--shadow-sheet` | `0 2px 3px rgb(33 30 25 / 8%), 0 14px 34px rgb(33 30 25 / 10%)` |

Use the first elevation for chips and secondary buttons, the second for cards, and the third for suggestion menus. The paper sheet has its own preview shadow. Do not add glows, lifted hover states, or extra inset shadows.

## Components and interaction

| Component family | Application treatment |
| --- | --- |
| Wordmark | Newsreader wordmark with a small lowercase `tc` in a brass circle; original monogram stays the app icon |
| Buttons | One clear moss primary action per task, paper secondary actions, quiet text actions |
| Fields | Visible labels, warm light fill, rounded border, nearby hint or recovery text |
| Tobacco picker | Existing accessible suggestions and explicit selections; rounded removable chips |
| Disclosures | Advanced entry, prompt preview, reusable handoff options, and printer alignment stay in context |
| Prompt document | Paper document treatment with readable Markdown and a source toggle; both expose the complete prompt |
| Import target | Dashed border, subtle kraft texture, choose and drop wording, real processing state |
| Import report | Ready, caution, or problem treatment tied to real validation results and repair actions |
| Quantity controls | Labeled controls with zero as the exclusion state; preserve automatic pagination |
| Sheet preview | Paper sheet on a neutral background, actual artwork from the imported pack, measurements in mono |

`Import order` reveals local PDF, screenshot, or pasted-text reading. `Read prompt` starts collapsed and separates the readable request preview from the full copied protocol. Copy prompt includes everything in one action. `Paper and alignment` contains printer adjustments. Copy and print remain visible without expanding a disclosure.

Standard controls are at least 44px tall. The source permits 34px dense controls, but compact appearance must not prevent touch or keyboard use. Hover changes color or border only. A primary action moves from moss 600 to 700 on hover and 800 when pressed. Do not move, scale, spring, or ripple controls.

Control transitions use 140ms with `cubic-bezier(.35,.02,.25,1)`. Background and shadow transitions use 220ms with `cubic-bezier(.2,.6,.3,1)`. Reduced motion sets token durations to 1ms; the application also forces element transition and animation durations to 0.01ms and disables smooth scrolling. No entrance animations or shimmer are needed.

Keep visible keyboard focus on fields, links, buttons, summaries, and the tobacco suggestions. The source uses a moss field border and brass ring. The application may darken the ring or field border to make the focused control clear against paper. Disabled controls use native disabled behavior where possible and expose their state to assistive technology.

## Assets and texture

Reuse `public/assets/tin-to-cellar-workbench.png` for the home page. It shows blank circular label stock and measuring tools on a workbench. It is the existing brand photograph, not a sample of generated label output. The photograph and monogram match the archive's files byte for byte. Keep the original monogram and favicon files in `public/brand/`. The typographic on-screen mark uses text and CSS.

The twelve outline icons in `src/components/Icons.tsx` remain the interface icon family. They use a 24px grid, 1.7px strokes, round caps and joins, and `currentColor`. Pair icons with visible labels or an accessible name. The archive's social-logo sprite is unrelated to this icon family and is not needed.

The source provides paper grain at 5.5% opacity, a brass hatch for import targets, and fine laid-paper lines for sheet previews. These are CSS textures. They need no generated files, must not intercept pointer input, and must disappear from printed output. The existing photograph provides enough context; decorative generated jars or placeholder label artwork would add no useful information.

## Accessibility and content

Use sentence case, direct verbs, and short explanations. Say "Choose ZIP" or "Drop your ZIP", since importing a pack does not send it to a server. Do not make a blanket "nothing is ever uploaded" claim. Print guide access is prepared automatically and the AI can submit generated images. Importing a pack separately sends validated AI feedback and public package source observations; the ZIP and artwork remain local.

Maintain readable contrast for normal text, hints, metadata, field boundaries, and focus indicators. Source ink 400 on paper 100 measures 3.27:1, below the 4.5:1 normal-text target. The application maps `--text-faint` to ink 500, which measures 5.15:1 on that background. Source amber 600 on amber 100 measures 3.84:1; caution text uses amber 700 at 5.37:1. Source brass 500 against paper 100 measures 2.91:1; focus outlines use darker brass 600 at 3.91:1. Field boundaries use ink 400 against the field fill at 3.65:1. Verify actual foreground/background combinations after integration rather than treating source swatches as an accessibility certificate.

Use real headings in order, preserve the skip link, label form controls, and retain keyboard combobox behavior. Disclosures must identify what they reveal. Copy results and import progress use accessible status messages. Error copy names the problem and gives the next action. At narrow widths and increased zoom, text and controls must wrap without horizontal page scrolling.

## Print geometry stays separate

`src/lib/sheets/profiles.ts` is the authority for physical sheet positions. The design archive repeats these values, but it is not a second geometry implementation.

| Measurement | Current supported value |
| --- | --- |
| Profile | `tin-to-cellar:avery-94502@1` |
| Sheet | US Letter, 8.5 × 11in |
| Finished circle | 2.5in diameter |
| Default artwork bleed | 0.125in per side, 2.75in outer diameter |
| Slots per sheet | 9 |
| Slot left positions | 0.375, 3, 5.625in |
| Slot top positions | 1, 4.25, 7.5in |
| Printer offsets | X and Y each limited to -0.25 through +0.25in |

The preview clips at finished trim. Production printing includes the supplied bleed and uses inch-based page and placement dimensions. Incompatible artwork is quarantined rather than stretched to fit. The generated image owns its entire blank writing area. The website adds no date words, lines, or other artwork overlays.

The UI's typography, grain, shadows, navigation, and cards do not appear on label output. Calibration guides remain a separate print mode. Physical printer accuracy still requires a plain-paper test at Actual Size / 100%; browser screenshots and passing code checks cannot establish that accuracy.

## Initial redesign verification

The full suite passed 121 tests across 21 files during integration. After the final copy-only correction, all four focused order-import tests passed. Final typecheck/build and lint passed. The build retains the existing Vite chunk-size advisory. A source review confirmed routes, disclosures, font paths and ranges, semantic color overrides, responsive breakpoints, and separate production print rules.

Browser review used the built application at `http://127.0.0.1:4173` and confirmed these results:

| Area | Observed result |
| --- | --- |
| Responsive layout | Home, Make a prompt, How it works, and Print labels with a loaded pack had no horizontal overflow at a measured 320px viewport. The prompt view also worked at 390px and 1440px. The print workspace stacked at 850px and 900px. |
| Prompt creation | Keyboard search and selection worked. Pasted order text produced matches that could be added. Copy prompt put more than 15,000 characters on the clipboard, including the complete schema and entered request. Rendered and source views showed the prompt; optional proof access was visible without making a remote call. |
| Pack import and pagination | A real ten-label ZIP was accepted. A total quantity of eleven produced two sheets, with two artwork images on the second sheet. |
| Validation and recovery | A partial fixture quarantined an incompatible 2.75-inch circle and kept nine printable labels. An HTML-looking title rendered as text with no image children. The repair request copied successfully. A later invalid ZIP preserved the nine-label print job. |
| Alignment and geometry | Starting at slot 2 left the first slot blank. An X offset of +0.1in was shared by preview and print placement. The calibration structure contained nine guide slots, and production slots retained inline dimensions of 2.5in. |
| Browser errors | The browser error log was empty. |

Print evidence consists of source review, existing geometry tests, and browser inspection of placement and calibration structure. This review did not produce a new PDF or use a physical printer. It did not exercise the hosted proof service or deploy the redesign.

### Community pack selection

Gallery cards lead with **Add to pack**, followed by **Use label** for immediate printing. The selected-pack tray shows the count and each design, with Remove and Clear pack controls. **Print selected labels** opens the existing print workspace, where quantities are chosen; **Download pack** creates one reusable CellarPack ZIP. Avoid cart, checkout, and individual ZIP actions on gallery cards.

Selection persists in this browser tab's session through filtering and navigation. It contains only public label identifiers and display names. Pack assembly fetches current public exports and validates them locally, preserves artwork bytes and geometry, and uses distinct label and asset identifiers. An unavailable or invalid design stops assembly with an actionable error and preserves the selection. Limits are 20 designs and 45 MiB of source downloads; no partial pack is silently returned. Importing a downloaded pack retains the normal local-first workflow.

### Automatic gallery filtering

The Blend combobox filters both suggestions and gallery labels while typing, after a 100ms pause. The image grid includes the union of the displayed suggestions, up to eight blends. Selecting with Enter or a click narrows immediately to one blend; exploring with arrow keys, focusing, or dismissing with Escape does not change the matching set. Instructions describe this behavior before selection. No matches produce an empty grid; clearing restores all blends. In-flight searches are canceled and stale responses ignored. The existing per-blend endpoint is queried only for the bounded suggestion set, with merged ID pagination so subsequent designs are not lost. Focus stays in the input, and Clear blend returns focus there before its button disappears. Composition keystrokes do not commit a suggestion.

A persistent, polite status region announces loading, the number of labels shown, and empty results. The results region exposes its busy state without making every card a live announcement. New filter requests invalidate older responses so delayed results cannot replace the current selection. Do not move focus or navigate when the filter changes.

### Floating pack controls

The pack control sits at the bottom right of the viewport. Adding designs updates its count without opening the panel, moving focus, or changing gallery layout. Activate the count button to review selections and print or download the pack. The panel is a nonmodal disclosure, with aria-expanded and aria-controls; Escape closes it and restores focus to its toggle. Removal and Clear pack keep focus on the toggle. Its bounded height and scrolling list support small screens. Gallery bottom padding reserves access to the final cards.

### Gallery image loading

Cards use the existing 320px thumbnails, with explicit width and height and a reserved square layout to avoid shifts while images load. The first thumbnail loads eagerly; subsequent thumbnails use native lazy loading, which allows the browser to prefetch near the viewport. Images use asynchronous decoding. Full-resolution artwork and printable packs are fetched only through their explicit actions. Keep image descriptions available as alt text and keep the loading placeholder static.

Thumbnails reveal from a soft blur to sharp over 420ms after loading, over a static surface-colored placeholder. The reveal does not add requests or alter the reserved image size. Reduced-motion users receive the image immediately without animation. Failed images expose their alternative text rather than remaining hidden behind the placeholder.

The floating pack control is absent when no designs are selected. Clearing the pack or removing its last design hides it and returns focus to the gallery heading without scrolling. Both the control and expanded panel use the same translucent tan and 8px backdrop blur as the site header, with dark text for contrast.
