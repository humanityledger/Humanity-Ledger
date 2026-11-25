# Launch visuals

Everything here is either a real capture of the product or a diagram drawn from the code. Nothing shows a feature that does not exist, a fictional balance, or a sponsored fee.

## Ready

| File | Size | What it is | Use |
|---|---|---|---|
| `payment-progress.gif` | 342×565, 86 KB, 6 s loop | The wallet's payment card through its real stages (fee check, proof on this device, sent to Aztec, settled). Cropped from `docs/readme/payment-card.jpg`, captured on Aztec Alpha on 14 Nov 2026; the amount line (a test token) is removed | README hero; X reply under tweet 4 |
| `payment-progress-strip.jpg` | 1026×570 | The same three stages side by side | X and LinkedIn image posts |
| `architecture.svg` / `architecture.png` | 1200×680 / 2400×1360 | Device (wallet, encrypted store, G7, PXE) → XMTP for messages, → Aztec Alpha for payments → Ethereum; the server's limited role | README "How it works"; X tweet 3; LinkedIn |
| `social-preview.png` | 1280×640 | Name, one-line description, status, repository URL, settled payment card | GitHub social preview; link card on X and LinkedIn |

**Set the social preview (one minute, biggest effect on link cards):** GitHub → repository Settings → General → Social preview → Edit → Upload `assets/launch/social-preview.png`.

## To record (needs two beta member accounts and a real browser)

Rules for every capture: light theme (the default; dark only as the optional selector), two test member accounts, cUSDC amounts of 1 or less, no browser extensions visible, no address that is not already public in this repository, no balance other than the test accounts'.

### GIFs

| Name | Length | Shot list |
|---|---|---|
| `payment-progress.gif` | 6 s | Done (above). |
| `chat-to-payment.gif` | 15 s | 0–3 s: chat open with a contact, a message "Sending you 1 cUSDC". 3–6 s: tap Pay; the payee is the contact's G7-verified Aztec address, nothing to paste. 6–12 s: the payment card fills: fee, proof on this device, sent, settled in block N. 12–15 s: the payment card in the conversation. |
| `proof-technical.gif` | 15 s | Split: left, the wallet card at "Making the proof on this device"; right, the browser's Network panel showing no request containing the amount or recipient; end on the Aztecscan page of the transaction (status mined, note hashes and nullifiers, no amount or parties). |

Record at 1440×900 (desktop) or 390×844 (phone), then: `ffmpeg -i in.mp4 -vf "fps=12,scale=720:-1:flags=lanczos" -loop 0 out.gif` (keep each under 5 MB).

### Videos

| Format | Length | Storyboard |
|---|---|---|
| Vertical 9:16, 1080×1920 | 20 s | Phone. 0–2 s: title card "Ledger Chat" over the chat list. 2–8 s: message thread, tap Pay. 8–16 s: payment card stages, "made on this device". 16–20 s: "On chain: that it happened and its fee. Not the amount, not the people." and ledgerchat.org. |
| Horizontal 16:9, 1920×1080 | 20 s | Desktop. Same beats; add the architecture diagram for 3 s between 8 and 11 s. |

Encode: `ffmpeg -i in.mov -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart -an out.mp4`. Add burned-in captions; most people watch muted.

### Screenshots (8)

| # | Screen | Light | Dark (optional selector) |
|---|---|---|---|
| 1 | Chat with a payment card | `shot-chat-light.png` | `shot-chat-dark.png` |
| 2 | Private wallet: balance, Send, Receive, activity | `shot-wallet-light.png` | `shot-wallet-dark.png` |
| 3 | Send sheet with the G7-verified recipient | `shot-g7-light.png` | `shot-g7-dark.png` |
| 4 | Verify encryption (safety number) | `shot-verify-light.png` | `shot-verify-dark.png` |

Desktop 2880×1800 (2× of 1440×900), PNG, under 1 MB each (`pngquant` if needed). The list in `docs/readme/IMAGES_TODO.md` covers the dossier.

## Embedding in the README

* **GIF or image in the repository:** `<img src="assets/launch/NAME" width="..." alt="what it shows">`. Always write an `alt` that states what is on screen.
* **Video:** GitHub does not play an MP4 linked from the repository. Edit `README.md` on github.com (or any issue comment), drag the MP4 into the editor, wait for the `https://github.com/user-attachments/assets/...` link, and put that link alone on its own line where the README has the `DEMO VIDEO` comment. GitHub renders it as a player. Limit: 10 MB on the free plan.
* **Dark and light variants of one image:** wrap them in `<picture>` with `<source media="(prefers-color-scheme: dark)" srcset="...dark.png">` and an `<img>` for light.

## Rebuild

```bash
rsvg-convert -z 2 assets/launch/architecture.svg -o assets/launch/architecture.png
```

The GIF frames come from `docs/readme/payment-card.jpg`: for x in 15, 415, 815 crop `342x172+x+22` (ring and label) and `342x398+x+268` (stages and details), stack, then `convert -delay 140 f1 -delay 140 f2 -delay 320 f3 -loop 0 -layers Optimize`.
