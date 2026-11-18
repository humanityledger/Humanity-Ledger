# Landing videos

Supplied by Stefan on 18 November 2026 for the immersive landing page. The original file names
(`168343-838892838_medium.mp4`, `169446-841382825_medium.mp4`) follow Pixabay's download naming;
confirm the source and its licence before launch and record it here.

| File | What it shows | Size | Use |
|---|---|---|---|
| `hand-phone-1920.mp4` | A hand holding a phone, side view, on a light grey background. 11.16 s, 25 fps | 1920×1080, H.264, no audio | Playback (autoplay, muted, loop) |
| `hand-phone-scrub-1280.mp4` | The same, every frame a keyframe (`-g 1`) | 1280×720 | Scroll-scrubbing `currentTime` without decode stalls |
| `hand-phone-poster.jpg` | Frame at 0.5 s | 1920 wide | Poster, reduced motion |
| `typing-1920.mp4` | Close-up of a thumb typing "Hi how are you" on an iPhone keyboard, dark blue and violet light. 16.92 s, 25 fps | 1920×1012, H.264, no audio | Playback |
| `typing-scrub-1280.mp4` | The same, every frame a keyframe | 1280 wide | Scroll-scrubbing |
| `typing-poster.jpg` | Frame at 6 s | 1920 wide | Poster, reduced motion |

Encoded from the originals (2560×1440 and 2730×1440, 25 fps) with ffmpeg: CRF 24 for playback,
CRF 26 all-intra for scrubbing, `+faststart`, audio removed.
