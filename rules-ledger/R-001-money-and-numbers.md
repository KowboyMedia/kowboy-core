R-001 Money and numbers
When: an amount or a count is shown
Then: thousands are grouped by a hard space (no line breaks inside a number), a fraction is
written with a decimal comma and at most two decimals, an integer has none:
4950000 → "4 950 000", 45.5 → "45,5". A money amount is followed by a hard space and
the currency word: "kr" for SEK, otherwise the currency's code as the CRM sends it
(EUR). A missing amount, or an amount of zero, gives no string at all: the key is
absent from display.
Applies: display.price (price, currency), display.final_price (final_price, currency),
display.price_other_currency (its own amount and currency); every other entry that
shows money or a number.
CRMs: all; the currency comes from the record
Examples: price 4950000 SEK → "4 950 000 kr"; price 400000 EUR → "400 000 EUR"; price null → nothing
