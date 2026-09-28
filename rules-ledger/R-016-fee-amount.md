R-016 Fee amount (drafted 2026-09-24, awaiting Patric's validation, question 90)
When: the recurring fee is shown as an amount alone, as on a card ("Avgift 2 882 kr")
Then: display.fee_amount is fee.amount per R-001 in the record's currency, without the
frequency R-004 adds to display.fee. Zero or missing amount → nothing.
Applies: display.fee_amount (fee.amount, currency)
CRMs: all
Examples: 2882 Monthly → "2 882 kr"; 42000 Yearly → "42 000 kr"; null → nothing
