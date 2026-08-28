---
name: Artifact registration after Git integration
description: How to recover existing artifact registrations without replacing their files or workflows.
---

If Git integration temporarily removes registered artifacts while their directories and manifests still exist, reload each existing manifest through the validated artifact-manifest replacement flow; do not recreate the artifacts.

**Why:** Recreating an artifact can overwrite or conflict with preserved product, video, and design work, while validating the unchanged manifest restores registration and managed workflows safely.

**How to apply:** Confirm the artifact directories and manifests exist, validate unchanged temporary copies of the manifests, then verify the artifact list and managed workflows are restored.