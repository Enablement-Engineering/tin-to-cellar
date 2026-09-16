import { DemandPreference } from './DemandPreference'

export function Privacy() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
      <h1>Privacy</h1>
      <p className="editorial-lede">Your files are read on your device. Importing a label ZIP shares limited feedback and public packaging links. Artwork is uploaded only when you submit it for community review.</p>
      <p>Updated September 15, 2026</p>
    </header>
    <div className="editorial-body">
      <section aria-labelledby="privacy-summary">
        <h2 id="privacy-summary">What stays local and what is shared</h2>
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
        <p>Tin to Cellar is made by Dylan Isaac at Enablement Engineering. You do not need an account. The app reads order PDFs, screenshots, pasted text, label ZIPs, and feedback files on your device. It does not upload these files for processing.</p>
        <p>Screenshot text recognition runs in your browser, using software and language files downloaded from this site. Importing a label ZIP with a readable manifest separately sends the limited feedback and source records described below.</p>
        <p>Your blend selections and special requests become a prompt. Copying puts that prompt on your clipboard. When you paste or attach material in an AI chat, that provider receives it under its own privacy and retention policies. Tin to Cellar does not receive your chat or connect to your AI account.</p>
        <p>Your browser saves selected artwork, blend names, quantities, requests, prepared instructions, and the information needed to check and repair imported labels. This lets you return to your work in the same browser. We do not save it to an account or synchronize it to another device.</p>
        <p>The saved work does not retain your original order files, raw screenshot text, or original ZIP files. Clearing this site's browser data removes the saved work. Downloaded files and clipboard text remain until you remove them. Printing uses your browser and chosen printer or PDF destination.</p>
      </section>
      <section>
        <h2>Optional counts of label requests</h2>
        <p>When enabled, optional demand collection helps us decide which blends need community artwork. Explicitly adding a recognized blend or community design, choosing ready labels for printing, and pressing Print labels can send that action and the blend's catalog identifier. A print request also sends the requested quantity. Custom blend names, notes, artwork, imported files and account or browser identifiers are not included.</p>
        <p>The service adds these actions directly to daily totals by catalog entry. We keep daily aggregate counts, without a user event history. Selecting labels counts intent; opening the print dialog does not tell us whether anything was physically printed. Repeated actions may count again, and these totals do not measure unique people. Importing or restoring a saved workspace does not send demand events.</p>
        <p>Network addresses may be used temporarily to limit abuse, but are not stored in demand records. Demand delivery is best effort. Failed or offline requests are not queued or retried, and collection never needs to finish before you print.</p>
        <DemandPreference />
      </section>
      <section>
        <h2>Print guides</h2>
        <p>Your AI creates separate guide copies in its own working environment to review the cut edge, safe area, bleed, and writing space. That environment may be hosted by your AI provider; it does not necessarily run on your computer. The guides support visual review; they do not certify spelling or fidelity to the original package. Tin to Cellar does not receive artwork for these checks.</p>
        <p>Cloudflare processes ordinary network information to deliver and protect this site. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a> for its handling of that information.</p>
      </section>
      <section>
        <h2>AI feedback and file-check results</h2>
        <p>The instructions ask your AI to include a diagnostic report in the label ZIP, or return a separate report if it cannot finish. The report records the instruction version, requested label count and shape, outcome, steps and attempts, and categories of problems. It also records whether the AI says those problems were resolved.</p>
        <p>Importing a label pack with a readable manifest automatically sends its valid AI feedback to Tin to Cellar, along with recognized website validation codes and counts. We use these reports to improve instructions and supplied tools. View shared diagnostics shows the exact fields and whether receipt was confirmed. A daily allowance can pause diagnostic sharing while your local labels and printing remain available. Opening a standalone failure JSON stays local until you choose Share failure report.</p>
        <p>The app accepts only fixed categories and bounded counts in these reports. It rejects extra fields and malformed reports. The feedback format excludes free text, names, tobacco names, email addresses, source URLs, artwork, credentials, filenames, raw prompts, and chat logs. This restriction applies to validated feedback exports. It does not remove personal information from the rest of a pack or from your AI chat.</p>
        <p>Optional process notes contain up to five short AI-written observations about what helped, what went wrong, and possible improvements. They can also include tool versions and capabilities. These notes stay local until you preview them and choose Share process notes.</p>
        <p>Read the notes for personal information before sharing. The app limits their structure and length, but cannot guarantee that free text contains no personal information. The AI is instructed to leave out personal details, URLs, filenames, prompts, logs, and chat excerpts.</p>
        <p>File-check results, validated diagnostics, and delivery status are saved with your local work. Restoring saved work does not send another report. Optional process notes and separate open reports clear when you reload; downloaded reports remain on your device.</p>
        <p>Collected reports are available to the maintainer through a protected export. They are not public source suggestions. Repeated imports of the same pack are stored once. Reports describe what the AI says it did, so they are not independent quality checks or counts of unique people or runs. If you send a report by email or another service, that service also handles your message and sender information.</p>
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
        <h2>How long shared data is kept</h2>
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
