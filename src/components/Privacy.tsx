export function Privacy() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
      <h1>Privacy</h1>
      <p className="editorial-lede">Your orders and label packs are read in your browser. Your AI chat makes the artwork. Importing a pack shares AI feedback and public package source observations to improve future labels.</p>
      <p>Updated September 6, 2026</p>
    </header>
    <div className="editorial-body">
      <section aria-labelledby="privacy-summary">
        <h2 id="privacy-summary">TL;DR</h2>
        <ul>
          <li>Your imported orders and ZIPs stay on your device. Artwork uploads only when you explicitly submit selected labels for gallery review.</li>
          <li>Importing a readable pack automatically shares structured AI feedback, website ZIP-check results, and public package source observations. Those links can help other users make labels.</li>
          <li>New structured diagnostics are kept for 12 months. Optional process notes and source observations expire after 90 days. Process notes require a separate sharing action.</li>
          <li>Print guides are created in your AI chat’s working environment. Tin to Cellar does not receive the artwork for guide generation.</li>
          <li>Your AI provider, Cloudflare, and the embedded YouTube video handle data under their own policies. We do not receive your AI chat.</li>
        </ul>
      </section>
      <section>
        <h2>Orders, prompts, and printing</h2>
        <p>Tin to Cellar is made by Dylan Isaac at Enablement Engineering. You do not need an account. The app reads imported order PDFs, screenshots, pasted text, label ZIPs, and feedback files on your device. Screenshot text recognition runs in your browser using software and language files served by this site. We do not upload those imported files for processing. After a pack with a readable manifest is imported, the app separately sends the limited feedback and source records described below.</p>
        <p>Your blend selections and special requests become a prompt. Copying puts that prompt on your clipboard. When you paste or attach material in an AI chat, that provider receives it under its own privacy and retention policies. Tin to Cellar does not receive your chat or connect to your AI account.</p>
        <p>Label previews, quantities, and sheet layout are handled in your browser. Selected artwork, blend identities, requests, the current prepared prompt, and the information needed to check and repair imported labels are saved in this browser so you can leave for your AI chat and return. We do not save this workspace to an account or synchronize it to another device. Original order files, raw screenshot text, and original ZIP files are not retained in this saved workspace. Clearing this site’s browser data removes the saved work. Downloaded files and clipboard text remain until you remove them. Printing uses your browser and chosen printer or PDF destination.</p>
      </section>
      <section>
        <h2>Print guides</h2>
        <p>Your AI creates separate guide copies in its own working environment to review the cut edge, safe area, bleed, and writing space. That environment may be hosted by your AI provider; it does not necessarily run on your computer. The guides support visual review; they do not certify spelling or fidelity to the original package. Tin to Cellar does not receive artwork for these checks.</p>
        <p>Cloudflare processes ordinary network information to deliver and protect this site. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a> for its handling of that information.</p>
      </section>
      <section>
        <h2>Prompt feedback</h2>
        <p>The prompt asks your AI to include a diagnostic report in the label pack, or return a separate report if it cannot finish the pack. The report records which instructions the AI used, requested label count and shape, overall outcome, steps attempted, attempt counts, and categorized problems and whether they were resolved.</p>
        <p>Importing a label pack with a readable manifest automatically sends its valid AI feedback to Tin to Cellar, along with recognized website validation codes and counts. We use these reports to improve instructions and supplied tools. View shared diagnostics shows the exact fields and whether receipt was confirmed. A daily allowance can pause diagnostic sharing while your local labels and printing remain available. Opening a standalone failure JSON stays local until you choose Share failure report.</p>
        <p>The app accepts only fixed categories and bounded counts in these reports. It rejects extra fields and malformed reports. The feedback format excludes free text, names, tobacco names, email addresses, source URLs, artwork, credentials, filenames, raw prompts, and chat logs. This restriction applies to validated feedback exports. It does not remove personal information from the rest of a pack or from your AI chat.</p>
        <p>A separate optional process retrospective can describe what helped, what caused friction, and possible improvements, in up to five short AI-written observations. It can also report tool versions and available capabilities. These notes stay local until you preview them and choose Share process notes. Read them for personal information before sharing; validation limits their structure and length but cannot certify that free text contains no personal information. The AI is instructed not to include personal details, URLs, filenames, prompts, logs, or chat excerpts.</p>
        <p>Import-check results, bounded structured diagnostic payloads, and their delivery status are saved with the local workspace. Restoring that workspace does not submit another report. Optional freeform process notes and standalone open reports stay in browser memory and clear when you reload. Downloaded reports remain on your device. Collected reports are available to the maintainer through a protected export, not the public source lookup. Repeated imports of the same pack are stored once, so counts do not represent unique people or runs. Reports describe what the AI says it did; they are not independent quality checks or counts of unique users. If you send a report by email or another service, that service also handles your message and sender information.</p>
      </section>
      <section>
        <h2>Package images and sources</h2>
        <p>Your AI is instructed to inspect an actual package image before making a label, preferably from the manufacturer or a specialist retailer. You may also supply a reference image in your chat. The AI records source links or a user-supplied reference description and packaging observations in the label pack so the design has a traceable reference.</p>
        <p>Tin to Cellar does not automatically visit those source links, download reference images, or store copies of your reference images when you import a pack. On import, the app submits eligible public source links for blends that match an existing catalog entry. It also sends fixed observations: whether the AI reported the link valid, unavailable, wrong-package, or unverified; the package type; and whether the packaging was current, historical, or unknown. Older packs can contribute package links marked unverified. Unknown blends are skipped until they have a catalog entry. The app excludes private attachments, reference descriptions, free-text notes, links with query strings or credentials, and image files. Sharing the complete pack yourself shares its artwork and full research records too.</p>
        <p>These source links, catalog identifiers, observations, and receipt dates can be returned publicly to future AI chats working on the same blend. They are agent-reported leads. The next AI must open and verify the image; a report of a broken or mismatched link stops that link being suggested. The server does not fetch these URLs or store copies of the source images. The app shares only source URLs that exactly match the corresponding catalog entry. Unfamiliar URLs stay local.
        </p><p>When you select recognized blends, the app can request saved source suggestions from Tin to Cellar. Our service receives the catalog identifier and ordinary network information. Your AI provider and any source websites it visits handle those requests under their own policies. Opening an external link yourself also contacts that website. Reference images and brand artwork belong to their respective owners; recording a source does not grant permission to reuse it.</p>
      </section>
      <section>
        <h2>Community label sharing</h2>
        <p>Your ZIP is read on this device. Only labels you choose to submit are uploaded for private review. Approved labels become public so others can download and print them for personal cellaring. Built-in example and in-app gallery imports do not submit diagnostics or source observations.</p>
        <p>Gallery submissions contain selected artwork, blend identity, print geometry, edition, and reference links you explicitly select. They do not contain your original ZIP, private notes, raw manifest, or diagnostic reports. Cloudflare stores submissions privately until review. Turnstile checks explicit submissions to limit abuse.</p>
        <p>No contributor account is required. After uploading, you’ll see “Submitted for review.” We review submitted labels before making them public.</p>
        <p>Unreviewed submissions expire after 30 days. Rejected artwork is scheduled for deletion after 7 days. We keep a limited review record for 90 days after the decision. Published labels stay available until unpublished. Unpublished artwork is scheduled for deletion after 30 days unless republished. Copies already downloaded by others cannot be recalled. Provider backups may take longer to expire.</p>
      </section>
      <section>
        <h2>Collection storage and retention</h2>
        <p>We store contributions in Cloudflare storage with a receipt date and a one-way fingerprint of the pack manifest to detect repeat imports. Standalone failure submissions use a random submission identifier. New structured diagnostics and website checks expire after 12 months; reports collected under the previous policy keep their original 90-day expiry. Optional process notes expire after 90 days. Daily cleanup deletes expired records, and exports exclude them immediately. Monthly aggregate counts and sanitized improvement findings may be kept longer without raw process notes.</p>
        <p>Package source observations keep their separate 90-day freshness window. Public suggestions exclude older records immediately. A source can remain available if a later contribution reports it again. Capacity limits may temporarily stop source collection.</p>
        <p>The shared source catalog contains product identifiers and eligible source links, not user profiles. We do not collect the ZIP, generated artwork, order file, chat, or free-text special requests through this endpoint. Network IP addresses are used for rate limits but are not included in contribution records. The source record is separate from the diagnostic feedback, whose schema does not allow URLs or tobacco names.</p>
      </section>
      <section>
        <h2>Video, tracking, and questions</h2>
        <p>The Inspiration page includes a YouTube video in privacy-enhanced mode. Loading or playing that embedded guide contacts YouTube, which handles those requests under <a href="https://policies.google.com/privacy">Google's privacy policy</a>. Privacy-enhanced mode does not mean that no network requests or cookies are involved.</p>
        <p>The app has no advertising trackers, marketing cookies, or session replay. We do not sell imported files or feedback. Cloudflare's hosting and security processing is separate from the files kept in your browser.</p>
        <p>For privacy questions, artwork or source-link concerns, or feedback requests, <a href="mailto:dylan@enablement.engineering">contact Dylan Isaac</a>. Include the relevant label or page link and a short explanation, without resending private artwork or orders.</p>
      </section>
    </div>
  </article>
}
