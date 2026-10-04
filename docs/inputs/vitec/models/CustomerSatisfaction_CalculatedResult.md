<!-- https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomerSatisfaction_CalculatedResult, fetched 2026-10-04 -->

# CalculatedResult

Innehåller uppgifter om nyckeltalet för ett enkätsvar och förväntas vara giltigt enligt NPS eller HappyOrNot.

| Namn | Beskrivning | Typ | Information |
| --- | --- | --- | --- |
| Value | Om NPS används skall värdet vara mellan 0-10, se https://sv.wikipedia.org/wiki/Net_promoter_score. Om HappyOrNot används skall värdet vara mellan 0-3, se avsnittet OpenFeedback: https://happyornot.github.io/docs/api/#resource-surveys. | integer | Ett värde måste anges. Värdet måste vara mellan 0 och 10. |
| Method | Anger vilken metod som använts för att beräkna nyckeltalet. | [CalculationMethod](https://connect.maklare.vitec.net/Help/ResourceModel?modelName=CustomerSatisfaction_CalculationMethod) | Ange vilken metod som använts för beräkning av nyckeltalet CalculatedResult |
