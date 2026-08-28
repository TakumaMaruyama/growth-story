---
name: Verify encoded video dimensions
description: Final video exports must be checked at the encoded-stream level rather than judged from the preview canvas.
---

Treat the encoded media dimensions as authoritative. A portrait composition displayed inside a wide player can still be exported as a landscape file with sidebars.

**Why:** Artifact metadata and a visually portrait canvas did not prevent the renderer from producing a 1920×1080 file around a 9:16 composition.

**How to apply:** Before delivering a portrait video, inspect the final file with a media probe and confirm the intended width, height, duration, and audio-stream state. Present the verified media file directly.