# Test the live gallery

## Submit and review

1. Open https://tintocellar.com/labels/print and choose a CellarPack ZIP. Importing reads artwork locally.
2. Under **Share your labels**, select the artwork, accept the sharing agreement, and choose **Submit for review**. Only selected artwork uploads. A successful submission ends with its confirmation; there is no private status link or withdrawal step.
3. Open https://admin.tintocellar.com and sign in with `dylan@enablement.engineering` if prompted.
4. In **Review queue**, click the submission. Review its full-size artwork and metadata. Agent advice appears below the metadata under **Agent recommendations**.
5. Make any corrections, then check the review acknowledgement and choose **Approve and publish**. The label appears at https://tintocellar.com/gallery.
6. Choose **Use label** in the gallery to import it for printing, or **Download ZIP**. Use **Unpublish now** in admin to remove a publication and disable subsequent downloads.

The private record **1839 Blue — Synthetic private feedback example** contains a saved agent recommendation for testing. It is a geometric fixture, not real tobacco artwork; keep it private. The other synthetic release-check record is unpublished. The public gallery is initially empty until real artwork is approved.

## Request an agent review

Agent reviews run on request through Codex; there is no automatic background reviewer or Run AI button in the website. Ask Codex: **Review the assigned pending Tin to Cellar submissions and leave recommendations in the admin UI.**

The current **Tin to Cellar review assistant** grant covers only the private synthetic example, expires October 5, 2026, and permits reading its queue/metadata/artwork and writing advice. It does not cover future submissions or allow publication. Additional real submissions need an explicitly authorized grant before an agent can inspect them. Human review works without an agent.

The configured client is in the isolated implementation checkout, not the original mixed checkout:

```sh
cd /private/tmp/tin-to-cellar-gallery
GALLERY_AGENT_CREDENTIALS_FILE=/Users/dylanisaac/.config/tin-to-cellar/gallery-agent.json npm run gallery:agent -- queue
```

The credential file is protected and remains outside source. Never paste its contents into a task. Detailed reviewer instructions are in [gallery-agent-workflow.md](gallery-agent-workflow.md).

## Verified on production

ZIP selection, Turnstile, private submission, metadata correction, full-resolution review, approval, public artwork hash, downloadable pack, print import, and unpublishing passed. All public endpoints for the unpublished test returned 404 with `no-store`. The selected agent read the assigned artwork, wrote a recommendation visible in admin, and was denied the other submission and publication routes. Physical printing was not performed.
