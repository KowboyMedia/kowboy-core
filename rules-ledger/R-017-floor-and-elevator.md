R-017 Floor and elevator in one line (drafted 2026-09-24, validated by Patric 2026-10-03, question 90)
When: the floor is shown with the elevator in one fact ("Våning: 2 av 4, hiss finns")
Then: display.floor_and_elevator is display.floor (R-005), followed by ", hiss finns" when
elevator is true. When elevator is false or not stated, the floor alone. No floor → nothing,
whatever the elevator says.
Applies: display.floor_and_elevator (floor, floors_total, elevator)
CRMs: all
Examples: floor 2, floors_total 4, elevator true → "2 av 4, hiss finns"; floor 3, elevator false → "3"; no floor → nothing
