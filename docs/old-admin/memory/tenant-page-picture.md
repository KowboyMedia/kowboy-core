---
name: tenant-page-picture
description: The clickable picture of the new tenant page (question 186 b), set aside 2026-10-13 for a fresh admin from the spec; a private Design canvas
metadata:
  type: reference
  modified: 2026-10-12T23:09:35.839Z
---

https://claude.ai/artifact/7mA9Ku17ET9ttBV2nLnPb6 (published 2026-10-12 from the Debloat admin
thread, made-up tenant "Acme Mäklare"). A Design canvas: `project/canvas.json` plus six artboards.
`Main.dc.html` is the Status tab; `Settings.dc.html` is the Settings tab and holds all the logic
(props `opened` none/tenant/main/site1/site2 and `asking` none/new-token/remove-connection/
new-secret/remove-site); `Settings-tenant`, `-connection`, `-site` and `-confirm` only
`<dc-import>` it with those props. Field help texts are today's verbatim; button lines are the
shortened ones of line 5.

**How to apply:** to change it, `read` the files from the artifact (the scratchpad copy dies with
the session), edit, publish to the same URL with `root`; never create a second canvas. What his
comments settle is built beside the old page ([[question-186]] lines 1 to 6), nothing else.
