# Publishing the signed alpha terms

`/alpha` downloads the terms from `ALPHA_TERMS_URL`, hashes the bytes it received (SHA-256) and sends that hash with the three acceptances. `/api/alpha/redeem` accepts only when the hash equals `ALPHA_TERMS_SHA256`. So the bytes served must be exactly the signed bytes, from the same origin as the app (the browser fetch is same-origin).

Only after the lawyer has signed the text (OD-8). The agent does not publish legal texts.

1. Save the signed text as `public/legal/alpha-terms-v<N>.html`.
   - Use UTF-8 and LF line endings.
   - No build step touches files in `public/`.
2. Run `sha256sum public/legal/alpha-terms-v<N>.html` and keep the 64 hex characters.
3. Open a PR with only that file. Merge it and wait for the deploy.
4. Check the served bytes: `curl -s https://ledgerchat.org/legal/alpha-terms-v<N>.html | sha256sum`. It must equal step 2. If it does not, stop: something rewrote the file.
5. Set these on the web service in Railway, in one change:
   - `ALPHA_TERMS_VERSION=v<N>`
   - `ALPHA_TERMS_SHA256=<hash>`
   - `ALPHA_TERMS_URL=/legal/alpha-terms-v<N>.html`
6. Check `GET /api/alpha/status`: `terms` shows the same version, hash and URL.

**A new version** is a new file (`v<N+1>`), never an edit of the old one. Testers who accepted `v<N>` keep their recorded hash. `/alpha` asks them to accept again when the hash changes.
