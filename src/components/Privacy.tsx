export function Privacy() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
      <p className="eyebrow">Your files and data</p>
      <h1>Privacy</h1>
      <p className="editorial-lede">Your orders and label packs are read in your browser. Your AI chat makes the artwork. Importing a pack shares AI feedback and public package source observations to improve future labels.</p>
      <p>Updated September 6, 2026</p>
    </header>
    <div className="editorial-body">
      <section aria-labelledby="privacy-summary">
        <h2 id="privacy-summary">TL;DR</h2>
        <ul>
          <li>Your imported orders, ZIPs, and artwork stay on your device.</li>
          <li>Importing a readable pack automatically shares validated AI feedback and public package source links with fixed observations. Those links can help other users make labels.</li>
          <li>Collected feedback and source observations expire after 90 days and are removed at the next daily cleanup.</li>
          <li>Print guides are created in your AI chat’s working environment. Tin to Cellar does not receive the artwork for guide generation.</li>
          <li>Your AI provider, Cloudflare, and the embedded YouTube video handle data under their own policies. We do not receive your AI chat.</li>
        </ul>
      </section>
      <section>
        <h2>Orders, prompts, and printing</h2>
        <p>Tin to Cellar is made by Dylan Isaac at Enablement Engineering. You do not need an account. The app reads imported order PDFs, screenshots, pasted text, label ZIPs, and feedback files on your device. Screenshot text recognition runs in your browser using software and language files served by this site. We do not upload those imported files for processing. After a pack with a readable manifest is imported, the app separately sends the limited feedback and source records described below.</p>
        <p>Your blend selections and special requests become a prompt. Copying puts that prompt on your clipboard. When you paste or attach material in an AI chat, that provider receives it under its own privacy and retention policies. Tin to Cellar does not receive your chat or connect to your AI account.</p>
        <p>Label previews, quantities, and sheet layout are handled in your browser. Printing uses your browser and chosen printer or PDF destination. The app does not save your workspace to an account. Reloading clears the open workspace; files you downloaded and text on your clipboard remain until you remove them. Your browser may cache site assets and text-recognition resources.</p>
      </section>
      <section>
        <h2>Print guides</h2>
        <p>Your AI creates separate guide copies in its own working environment to review the cut edge, safe area, bleed, and writing space. That environment may be hosted by your AI provider; it does not necessarily run on your computer. The guides support visual review; they do not certify spelling or fidelity to the original package. Tin to Cellar does not receive artwork for these checks.</p>
        <p>Cloudflare processes ordinary network information to deliver and protect this site. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a> for its handling of that information.</p>
      </section>
      <section>
        <h2>Prompt feedback</h2>
        <p>The prompt asks your AI to include a diagnostic report in the label pack, or return a separate report if it cannot finish the pack. The report records which instructions the AI used, requested label count and shape, overall outcome, steps attempted, attempt counts, and categorized problems and whether they were resolved.</p>
        <p>Importing a label pack with a readable manifest automatically sends its valid AI feedback to Tin to Cellar. We use these reports to understand recurring failures and improve the instructions. The app shows whether collection was confirmed; a collection failure does not block printing. You can still inspect and download reports. Opening separate feedback JSON files for comparison does not submit them.</p>
        <p>The app accepts only fixed categories and bounded counts in these reports. It rejects extra fields and malformed reports. The feedback format excludes free text, names, tobacco names, email addresses, source URLs, artwork, credentials, filenames, raw prompts, and chat logs. This restriction applies to validated feedback exports. It does not remove personal information from the rest of a pack or from your AI chat.</p>
        <p>Open reports stay in browser memory and clear when you reload. Downloaded reports remain on your device. Collected reports are available to the maintainer through a protected export, not the public source lookup. Repeated imports of the same pack are stored once, so counts do not represent unique people or runs. Reports describe what the AI says it did; they are not independent quality checks or counts of unique users. If you send a report by email or another service, that service also handles your message and sender information.</p>
      </section>
      <section>
        <h2>Package images and sources</h2>
        <p>Your AI is instructed to inspect an actual package image before making a label, preferably from the manufacturer or a specialist retailer. You may also supply a reference image in your chat. The AI records source links or a user-supplied reference description and packaging observations in the label pack so the design has a traceable reference.</p>
        <p>Tin to Cellar does not automatically visit those source links, download reference images, or store copies of your reference images when you import a pack. On import, the app submits eligible public source links for blends that match an existing catalog entry. It also sends fixed observations: whether the AI reported the link valid, unavailable, wrong-package, or unverified; the package type; and whether the packaging was current, historical, or unknown. Older packs can contribute package links marked unverified. Unknown blends are skipped until they have a catalog entry. The app excludes private attachments, reference descriptions, free-text notes, links with query strings or credentials, and image files. Sharing the complete pack yourself shares its artwork and full research records too.</p>
        <p>These source links, catalog identifiers, observations, and receipt dates can be returned publicly to future AI chats working on the same blend. They are agent-reported leads. The next AI must open and verify the image; a report of a broken or mismatched link stops that link being suggested. The server does not fetch these URLs or store copies of the source images. Public links can reveal information in their paths, so the instructions require ordinary product links with no personal information.
        </p><p>When your AI requests saved sources, our service receives the requested catalog identifier and ordinary network information. Your AI provider and any source websites it visits handle those requests under their own policies. Opening an external link yourself also contacts that website. Reference images and brand artwork belong to their respective owners; recording a source does not grant permission to reuse it.</p>
      </section>
      <section>
        <h2>Collection storage and retention</h2>
        <p>We store contributions in Cloudflare storage, with a server receipt date and a one-way fingerprint of the pack manifest to detect repeat imports. The fingerprint does not contain the original manifest text. Collected feedback and source observations expire after 90 days and are deleted at the next daily cleanup. Public suggestions exclude older records immediately. A source can remain available if a later contribution reports it again. Capacity limits may temporarily stop collection.</p>
        <p>The shared source catalog contains product identifiers and eligible source links, not user profiles. We do not collect the ZIP, generated artwork, order file, chat, or free-text special requests through this endpoint. Network IP addresses are used for rate limits but are not included in contribution records. The source record is separate from the diagnostic feedback, whose schema does not allow URLs or tobacco names.</p>
      </section>
      <section>
        <h2>Video, tracking, and questions</h2>
        <p>The Inspiration page includes a YouTube video in privacy-enhanced mode. Loading or playing that embedded guide contacts YouTube, which handles those requests under <a href="https://policies.google.com/privacy">Google's privacy policy</a>. Privacy-enhanced mode does not mean that no network requests or cookies are involved.</p>
        <p>The app has no advertising trackers, marketing cookies, or session replay. We do not sell imported files or feedback. Cloudflare's hosting and security processing is separate from the files kept in your browser.</p>
        <p>For privacy questions or a request about feedback you have shared, contact Dylan Isaac through <a href="https://www.enablement.engineering/">Enablement Engineering</a>. Include enough context to identify the message you sent, without resending private artwork or orders.</p>
      </section>
    </div>
  </article>
}
