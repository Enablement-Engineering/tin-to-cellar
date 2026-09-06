# Gallery authentication release configuration

Updated September 6, 2026 for the implemented dedicated admin-host and advisory-agent boundary. The user has authorized configuration and deployment. The release owner has completed staging Access setup, fresh human login, scoped machine access/advice and revocation proof. The simplified staging redeploy and smoke checks have passed; production release remains unfinished. Actual remote resource and deployment evidence belongs in [release preparation](gallery-release-plan.md) and [validation](gallery-validation.md).

## Human and machine applications

Use separate human and machine Access applications in each environment:

| Environment | Public site | Human Access application | More-specific machine Access application |
| --- | --- | --- | --- |
| Production | `tintocellar.com`, `www.tintocellar.com` | Entire `admin.tintocellar.com` host | `admin.tintocellar.com/api/gallery/v1/agent/*` |
| Staging | `gallery-staging.tintocellar.com` | Entire `admin-staging.tintocellar.com` host | `admin-staging.tintocellar.com/api/gallery/v1/agent/*` |

The human policy allows only the user-confirmed email `dylan@enablement.engineering`; the Worker additionally checks the exact verified human subject. The machine application uses a separate audience and a Service Auth policy selecting the specific named service token. Do not add service tokens to the human policy, use Bypass/Everyone, or combine human and machine audiences. Check for overlapping Access applications so the more-specific machine path selects the intended policy. [Self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

This replaces the earlier four-path apex/`www` reviewer proposal. On public hosts, private human and machine gallery APIs now return 404. A legacy public `/admin/gallery` request redirects to the configured HTTPS admin root. Contributor submission and public browsing stay on the public site outside reviewer Access. Successful upload ends with “Submitted for review”; there is no contributor status or withdrawal route. The internal reservation/upload nonce never authenticates machine or human-admin requests.

The Worker protects the admin host's HTML and static assets with human JWT verification. Machine requests use only the dedicated machine verifier. Unrelated/public contributor APIs are denied on the admin host. Use `assets.run_worker_first: true`; a static-asset shortcut would otherwise bypass the application guard. Keep `workers_dev: false` and `preview_urls: false`. When `GALLERY_ADMIN_HOST` is absent, localhost keeps the existing test harness behavior; deployed environments must set it explicitly.

## Environment configuration

| Name | Required handling |
| --- | --- |
| `GALLERY_ADMIN_HOST` | `admin.tintocellar.com` in production; `admin-staging.tintocellar.com` in staging. |
| `GALLERY_ACCESS_ISSUER` | Exact HTTPS Access team origin. Read-only discovery identified `https://winter-king-937f.cloudflareaccess.com`; confirm against the configured applications. |
| `GALLERY_ACCESS_AUD` | This environment's single human review application audience. No comma-separated list. |
| `GALLERY_ADMIN_SUBJECT` | Dylan's actual user UUID, verified through a fresh signed human session. An email or application ID is not the subject. |
| `GALLERY_AGENT_ACCESS_AUD` | Distinct machine application audience for this environment; must differ from the human audience. |
| `GALLERY_AGENT_ENABLED` | Default `false`; enable deliberately only when machine policy and scoped grant verification are ready. |
| `GALLERY_TURNSTILE_SITE_KEY` | Public contributor-site widget key; not an admin login credential. |
| `GALLERY_TURNSTILE_SECRET` | Corresponding environment-specific private Worker secret. |
| `GALLERY_IP_SALT` | Independent random environment-specific Worker secret; never the local fixture value. |
| `GALLERY_RATE_LIMITER` | Five new reservations per 60 seconds; D1 separately enforces admission caps. |
| `GALLERY_INTAKE`, `GALLERY_PUBLICATION`, `GALLERY_SERVING` | Default `false`; corresponding D1 settings must also be enabled deliberately. |

The human verifier checks JWKS-backed RS256 signatures, issuer, audience, expiry and exact subject. The machine verifier checks its separate audience and application-token claims, including service identity in `common_name` and empty `sub`, then loads a current non-revoked D1 grant. A raw client-ID header alone is never trusted. Local signed-fixture tests do not establish actual hosted JWT claims. [Application-token fields](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

Issuer, audiences, hostnames and sitekeys are configuration, not bearer secrets. Keep service-token secrets, JWTs, human cookies, salts and widget secrets out of source, chat, browser storage, screenshots and test logs. The local agent client accepts an external owner-only credential file and forwards headers only to the exact admin host; see [the agent workflow](gallery-agent-workflow.md). The provisioner writes credentials directly to that protected store and establishes the initial synthetic selected-record grant. No management credential belongs in the application or agent client.

Configure Turnstile for the public production hostnames and a separate widget/secret for the public staging hostname. The Worker checks successful verification, exact request hostname, `gallery-submit` action and a fresh timestamp. Admin and machine access use Access, not Turnstile. Never deploy the local test verifier or synthetic challenge value. [Turnstile hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

## Authorized setup and verification

Before creating or changing a resource within the authorized release, inspect existing Access destinations, policies and audience tags; Worker binding/secret names; and widget hostname lists without printing secrets. Preserve unrelated Scribely applications and existing diagnostics/source storage. Read-only discovery identified Dylan's existing Zero Trust user record; no new Tin to Cellar Access applications had been created at the start of this implementation's hosted setup. Treat subsequent creation and login evidence as release-owner results, not assumptions from this guide.

After Dylan signs in to the human application, inspect only `email` and `user_uuid` at the protected host's `/cdn-cgi/access/get-identity`; do not copy the entire identity response, cookie or JWT. Verify that the configured UUID succeeds with the Worker's signature/issuer/audience/expiry/subject checks. Recheck if the user is removed and re-added to Zero Trust. [Identity endpoint](https://developers.cloudflare.com/cloudflare-one/tutorials/extend-sso-with-workers/).

Hosted proof must include:

- Fresh human login on admin root, protected JS/assets and human APIs; unauthenticated denial and staging/production audience separation.
- Public-host private APIs returning 404, legacy admin redirect using the dedicated HTTPS root, and no alternate-host/static bypass.
- A real service-token request receiving only the machine application policy; selected pending queue/detail/image access, append-only recommendation, and denial on every human mutation route.
- Grant revocation/expiry immediately blocking subsequent reads and advice; forged or wrong-audience assertions denied independently inside the Worker.
- Public contributor challenge/upload confirmation, denied retired contributor routes, admin private-preview access, exact-version human approval and admin unpublish direct-URL denial.
- `Cache-Control: no-store` and `Referrer-Policy: no-referrer` on protected pages and private responses; credentials absent from URLs/logs.

Use controlled synthetic labels for the initial hosted machine grant. Personal Downloads artwork remains local unless its remote use is separately authorized. Publish neither artwork nor broad grants merely to test login. No new provider/model upload is part of the trusted-client flow.

The authorization to configure is already present; do not introduce a generic permission stop. A concrete blocked credential or identity step should be reported with its actual cause while independent implementation and verification continue. Record deployment/configuration outcomes in the release and validation reports, keeping local tests, remote migrations and end-to-end hosted authentication as separate claims.
