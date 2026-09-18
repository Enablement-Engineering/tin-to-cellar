import { DemandPreference } from './DemandPreference'

export function Privacy() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
      <h1>Privacy</h1>
      <p className="editorial-lede">Your files are read on your device. Importing a label ZIP shares limited feedback and public packaging links. Artwork is uploaded only when you submit it for community review.</p>
      <p>Updated September 16, 2026</p>
    </header>
    <div className="editorial-body">
      <section aria-labelledby="privacy-summary">
        <h2 id="privacy-summary">What stays local and what is shared</h2>
        <ul>
          <li>Your imported orders and ZIPs stay on your device. Artwork uploads only when you explicitly submit selected labels for gallery review.</li>
          <li>Importing a readable pack automatically shares limited AI feedback, file-check results, and eligible public packaging links and observations. Those links and observations can help other users make labels.</li>
          <li>AI feedback and file-check results are kept for 12 months. Optional process notes and packaging observations expire after 90 days. Process notes require a separate sharing action.</li>
          <li>We do not receive your AI chat. Hosting, AI, and video providers handle data under their own policies, as described below.</li>
          <li>Optional app usage and request-progress measurement is off until you enable it. It sends limited counts, not files or request identifiers.</li>
        </ul>
      </section>
      <section>
        <h2>Orders, prompts, and printing</h2>
        <p>Tin to Cellar is made by Dylan Isaac at Enablement Engineering. You do not need an account. The app reads order PDFs, screenshots, pasted text, label ZIPs, and feedback files on your device. It does not upload these files for processing.</p>
        <p>Your browser saves selected artwork, blend names, quantities, requests, instructions, and label-check results so you can return to your work. It does not save original order files, raw screenshot text, or original ZIPs, or synchronize your work to another device.</p>
        <p>Clearing this site's browser data removes saved work. Downloaded files and copied prompts remain until you remove them. Printing uses your browser and chosen printer or PDF destination.</p>
      </section>
      <section>
        <h2>Optional app usage and label-request counts</h2>
        <p>If you enable measurement and collection is available, the app sends limited counts when you copy instructions, check a local ZIP, save imported or gallery artwork, open print preparation, request printing, or request a labels download. Unsuccessful actions can send a fixed outcome or problem category. Adding a recognized blend, selecting it for printing, or requesting a print also sends its catalog identifier; print demand includes quantity.</p>
        <p>Our Cloudflare-hosted service combines these into daily totals. They exclude custom blend names, notes, artwork, files, filenames, prompts, chats, and account or browser identifiers. Restoring saved work does not send action counts. Delivery failures are not retried or queued for later.</p>
        <h3>Progress matched on your device</h3>
        <p>After a measured instruction copy, this browser can remember the saved request and which requested labels later receive usable local artwork. Once all requested labels match, it can send an import milestone and, later, a print-request milestone. Only the starting week, milestone, and broad elapsed-time range are sent. The matching request and row identifiers stay on your device. A match does not prove that the artwork came from a particular AI chat.</p>
        <p>Local measurement records stop being used after 30 days and are removed when the app next checks them. Turning measurement off removes them in this browser. Changing requests, using another browser or device, clearing site data, or failed delivery can prevent later milestones from being observed. We do not keep individual journeys on the server or treat missing milestones as confirmed abandonment.</p>
        <DemandPreference />
      </section>
      <section>
        <h2>AI feedback and file-check results</h2>
        <p>Importing a label pack with a readable manifest automatically sends its valid AI feedback and website file-check results to Tin to Cellar. This includes the instruction version, label count and shape, steps, attempts, outcomes, and problem categories. We use these reports to improve the instructions and tools. They are available to the maintainer, not published.</p>
        <p>These reports exclude free text, personal details, blend names, source links, artwork, filenames, prompts, and chats. Choose View shared diagnostics to see the exact fields and delivery status. Opening a separate failure report stays local until you choose Share failure report.</p>
        <p>Optional process notes describe what helped, what went wrong, and possible improvements, and may include information about the AI's tools. They stay local until you preview them and choose Share process notes. Read them for personal information before sharing; the app cannot guarantee that free text contains none.</p>
        <p>Restoring saved work does not send another report. Unshared process notes and separate open reports clear when you reload.</p>
      </section>
      <section>
        <h2>Package images and sources</h2>
        <p>On import, the app shares public packaging links only when they exactly match the blend's existing catalog entry. It also shares the catalog identifier, the AI's assessment of the link, package type, and whether the packaging is current or historical. These records and their receipt dates can become public suggestions for future AI chats.</p>
        <p>Unfamiliar links, private attachments, reference descriptions, free-text notes, and image files stay local. Importing does not visit source links or download reference images, and our service does not fetch or store those images. Sharing a complete pack yourself also shares its artwork and full research records.</p>
        <p>Selecting a recognized blend can request saved source suggestions from our service, which receives the catalog identifier and ordinary network information.</p>
      </section>
      <section>
        <h2>Community label sharing</h2>
        <p>Only labels you choose to submit are uploaded for private review. Submissions contain selected artwork, blend identity, print dimensions, edition, and reference links you select. They exclude your original ZIP, private notes, raw manifest, and diagnostic reports.</p>
        <p>Approved labels become public for others to download and print. Copies already downloaded cannot be recalled. Importing built-in examples or in-app gallery labels does not submit feedback or packaging observations.</p>
      </section>
      <section>
        <h2>How long shared data is kept</h2>
        <ul>
          <li>AI feedback and file-check results expire after 12 months. Reports collected under the previous policy keep their original 90-day expiry.</li>
          <li>Shared process notes and packaging observations expire after 90 days. Packaging links can remain available if someone contributes them again.</li>
          <li>Unreviewed gallery submissions expire after 30 days. Rejected artwork is scheduled for deletion after 7 days. Limited review records are kept for 90 days after the decision.</li>
          <li>Published labels remain available until unpublished. Unpublished artwork is scheduled for deletion after 30 days unless republished.</li>
          <li>Usage and label-demand reports cover the latest 365 UTC calendar days. Request-progress totals use the starting week. Expired aggregate rows are removed by daily scheduled cleanup; failures can delay physical deletion.</li>
        </ul>
        <p>Diagnostic improvement findings without personal information or raw process notes may be kept longer. This exception does not apply to optional usage, request-progress, or label-demand totals. Provider backups may take longer to expire.</p>
      </section>
      <section>
        <h2>Service providers and external links</h2>
        <p>We use Cloudflare to host and protect the site, check gallery submissions for abuse, and store information shared with us. It processes ordinary network information under <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>. IP addresses may be used to limit abuse but are not stored in our feedback, source, usage, request-progress, or label-request records. Cloudflare Web Analytics traffic measurement is not included in this release.</p>
        <p>Material you paste or attach in an AI chat is handled under that provider's policies. Your AI also creates print guides in its own environment, which may be hosted by the provider. Tin to Cellar does not receive your chat or guide artwork, or connect to your AI account.</p>
        <p>Loading or playing the Inspiration page's YouTube video contacts YouTube under <a href="https://policies.google.com/privacy">Google's privacy policy</a>. Its privacy-enhanced mode does not prevent all requests or cookies. External websites your AI or you visit, and services you use to send us feedback, handle those interactions under their own policies.</p>
      </section>
      <section>
        <h2>Tracking and questions</h2>
        <p>The app has no advertising trackers, marketing cookies, or session replay. We do not sell imported files or feedback.</p>
        <p>For privacy questions or concerns about shared data or artwork, <a href="mailto:hello@enablement.engineering">email me</a>. Include the relevant label or page link without resending private artwork or orders.</p>
      </section>
    </div>
  </article>
}
