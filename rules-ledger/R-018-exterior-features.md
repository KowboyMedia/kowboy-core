R-018 Exterior features that exist (drafted 2026-09-24, awaiting Patric's validation, question 90)
When: a card or a fact list says which of balcony, patio and parking the home has
Then: display.exterior_features lists the exterior features whose is_available is true, in the
CRM's order, each as its own name followed by " finns", joined by ", ": "Balkong finns,
Uteplats finns". Features that are not available, and features without a name, are left out;
none available → nothing.
Applies: display.exterior_features (exterior_features[].type.name, .is_available)
CRMs: all
Examples: Balkong false, Uteplats true, Parkering false → "Uteplats finns"; all false → nothing
