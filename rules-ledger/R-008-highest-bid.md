R-008 Highest bid
When: bidding.bids holds bids
Then: display.highest_bid is the largest amount among the bids whose is_cancelled is not
true, per R-001 in the record's currency. Only cancelled bids, or no bids → nothing.
The bids themselves, cancelled ones included, stay in bidding.bids as the CRM sent
them; a site decides what to list.
CRMs: all
Examples: 1060000 and 1050000 standing, 1100000 cancelled → "1 060 000 kr"
