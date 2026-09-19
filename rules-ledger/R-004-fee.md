R-004 Fee
When: the recurring fee (avgift) is shown
Then: display.fee is fee.amount per R-001 in the record's currency, followed by "/mån" when
fee.frequency is Monthly and "/år" when it is Yearly, and by nothing when the CRM
names no frequency. display.fee_comment is fee.comment as the office wrote it.
Zero or missing amount → no display.fee.
CRMs: all; Vitec sends the frequency as Monthly or Yearly
Examples: 3500 Monthly → "3 500 kr/mån"; 42000 Yearly → "42 000 kr/år"
