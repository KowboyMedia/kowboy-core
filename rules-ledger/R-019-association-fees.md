R-019 Association fees (drafted 2026-09-24, validated by Patric 2026-10-03, question 90)
When: an association's transfer fee (överlåtelseavgift) or pledge fee (pantsättningsavgift) is shown
Then: display.transfer_fee is economy.transfer_fee per R-001 and display.pledge_fee is
economy.pledge_fee per R-001, in kr (an association carries no currency). Zero or missing → nothing.
Applies: display.transfer_fee, display.pledge_fee (association)
CRMs: all
Examples: transfer_fee 1480 → "1 480 kr"; pledge_fee 592 → "592 kr"; null → nothing
