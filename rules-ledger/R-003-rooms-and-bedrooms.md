R-003 Rooms and bedrooms
When: a room count is shown
Then: display.rooms is the count per R-001 and "rum": "3 rum", "1,5 rum". display.bedrooms
is bedrooms and "sovrum", and when bedrooms_max is larger than bedrooms a range with
a spaced en dash: "2 – 3 sovrum". display.rooms_and_bedrooms joins them: "3 rum, varav
2 sovrum"; without bedrooms it equals display.rooms. Zero counts as missing.
CRMs: all
Examples: rooms 3, bedrooms 2, bedrooms_max 3 → "3 rum, varav 2 – 3 sovrum"
