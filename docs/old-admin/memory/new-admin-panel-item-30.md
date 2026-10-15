---
name: new-admin-panel-item-30
description: State of the "New admin panel" thread (next-steps item 30): five designs rejected as inherited; the clean-room strategy (question 193) decides how the design is made
metadata:
  type: project
  modified: 2026-10-13T23:20:01.291Z
---

Started 2026-10-13 from Patric's "create a nice admin panel, without trying to fix the current one", "Tabler looks good. Use that", "MVP features only", "MVP Greenfield".

- 2026-10-13: five designs from sessions that had read the old admin all inherited from it; an independent check confirmed it, and the fifth was being reworded to pass that check. Patric (23:13): "the worst strategy to achieve an optimal admin panel", "one more chance or i will delete this project".
- Strategy (question 193, Claude Doc https://claude.ai/code/artifact/69cc6e12-15e0-4692-8cca-af8f35fd1da4): a clean room (a no-repository worker from the project chat, after the old admin's descriptions leave memory and /mnt/project-files) gets only a brief of Patric's verbatim words, Core's facts as data, and a method; it draws three candidates; the inheritance check is a test only, a failing candidate is dropped whole and the brief's leak fixed.
- A private project cannot start a fresh session outside itself (create_trigger refuses create_new_session_on_fire); the fallback is Patric pasting the brief into a session outside the project.

**Why:** a model that has read a design anchors on it; patching to pass a check keeps the skeleton.

**How to apply:** a session that has seen the old admin (every session in this project today) never designs, writes panel text or edits a design; it only assembles inputs, runs checks and builds to approved images. See [[ask-before-adding-to-core]].
