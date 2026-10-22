<!-- https://connect.maklare.vitec.net/Help/AdvertisingMigration, fetched 2026-10-04 -->

## Migrering från API version 1.0

### Bakgrund

Vi har byggt ett nytt API för annonsering på hemsidan. Detta API är en vidareutveckling av det gamla API:et och har en del förändringar. För att förenkla övergången från det gamla API:et till det nya API:et har vi skapat en guide för hur ni kan migrera.

### Struktur

Innan så hämtade ni bostäder via metoder som var specifika för typen av bostad. Ville ni ha en villa så fick ni anropa metoden för att hämta en villa. Nu finns det istället en gemensam metod oavsett bostadstyp. Strukturen jämnar ut skillnaderna för bostadstyperna för att få ett mer enhetligt tillvägagångssätt. Data som enbart rör en enstaka bostadstyp finns nu istället som "extensions" i svaret.

Vissa värden som driftkostnader, byggnadens arkitektur etc. visades tidigare som ett flertal egenskaper. Nu är det istället listor med ett namn och ett värde/text. Det innebär att ni kan iterera dem och visa dem på ett enklare sätt.

Eftersom detta API nu helt är för annonsering på hemsida så har vi skalat bort en hel del information och vi tar hand om en del affärslogik som tidigare låg på er. Om det finns ett behov av att få informationen som ni tidigare fick, så kontakta oss på Vitec med information vad det är ni saknar och vad det är ni vill använda det till.

Typ-specifik information under Extensions kan hämtas explicit via parametern extend. Om extend utelämnas används ett defaultläge där utökad information om själva objektet hämtas, men agenter och andra valfria utökningar behöver fortfarande begäras uttryckligen.

- Om inte priset ska visas så kommer dessa fält vara tomma

- Om dölj läge är aktiverat så kommer gatuadress, vägbeskrivning och koordinater vara tomma

- Om endast högsta bud ska visas så kommer ni enbart att få högsta budet

- Om endast budgivning pågår ska visas så kommer ni inte att få några bud

- Om budgivningen inte ska visas, så kommer budgivningen visas som inaktiv

### Bostäder

Vi har exkluderat fält där nya platsen är snarlik den gamla.

| Från | Till | Info |
| --- | --- | --- |
| AdvertiseOn.Documents | Files |  |
| AdvertiseOn.FirstPublishingDateOnHomepage | Marketing.PublishedAt |  |
| AdvertiseOn.HideAddress | Borttaget |  |
| AdvertiseOn.HidePrice | Borttaget |  |
| AdvertiseOn.Homepage | Marketing.IsPublished |  |
| AdvertiseOn.ImageIds | Images |  |
| AdvertiseOn.Links | Links |  |
| AdvertiseOn.Marketplaces | Borttaget |  |
| AdvertiseOn.ShowAsComming | Status |  |
| AdvertiseOn.ShowAsPreview | Marketing.IsPreview |  |
| AdvertiseOn.ShowAsReferenceHousing | Status |  |
| AdvertiseOn.ShowAsSoonForSale | Status |  |
| Assess | Taxation |  |
| Assessments | Taxation.Units |  |
| Assignment.AdditionalContact | SecondaryAgentId |  |
| Assignment.Estatenumber | ReferenceId |  |
| Assignment.MarketingMethods | Tags[Type.Id=SaleMethod].Names |  |
| Assignment.Producer | Borttaget |  |
| Assignment.ResponsibleBroker | PrimaryAgentId |  |
| Assignment.Status | Status |  |
| BalconyPatio | Exterior.Entries |  |
| BaseInformation.Address | Address |  |
| BaseInformation.AreaSource | Buildings.Area.Source |  |
| BaseInformation.AreaSourceComment | Buildings.Area.Description |  |
| BaseInformation.BuildingSpace | Buildings.Area.Building |  |
| BaseInformation.Commentary | Fees.Recurring.Description |  |
| BaseInformation.DisposalForm | Tenure.Id |  |
| BaseInformation.IncludedInFee | Borttaget |  |
| BaseInformation.IncreaseSeekConception | Tags[Type.Id=SpecialFeature].Names | Taggtypen har Type.Name="Utökade sökbegrepp" |
| BaseInformation.LivingSpace | Buildings.Area.Living |  |
| BaseInformation.MonthlyFee | Fees.Recurring.Value |  |
| BaseInformation.MonthlyFeeIsZero | Fees.Recurring.Value | Om värdet är null så är inget angivet, om det är 0 så är 0 angivet |
| BaseInformation.NewConstruction | Marketing.IsNewHome |  |
| BaseInformation.ObjectAddress | Address |  |
| BaseInformation.OtherSpace | Buildings.Area.GrossFloor |  |
| BaseInformation.ProjectId | ProjectId |  |
| BaseInformation.PropertyType | Subtype |  |
| BaseInformation.PropertyUnitDesignation | Taxation.PropertyDesignations |  |
| BaseInformation.Tenure | Tenure.Name |  |
| Bids | Bidding.Bids |  |
| Buyers | Borttaget |  |
| CommissionType | Borttaget |  |
| CustomerId | Office.CustomerId |  |
| CustomFields | Borttaget |  |
| Date.AssignmentDate | Sale.AssignmentDate |  |
| Description | Sale |  |
| Description.WayDescription | Address.Directions |  |
| EnergyDeclaration | Buildings.EnergyDeclaration |  |
| FloorAndElevator | Buildings.Floor, Buildings.Elevator |  |
| HouseInterior | Buildings |  |
| Inspection.BuyersInspection | Borttaget |  |
| Inspection.Company | Borttaget |  |
| Inspection.Inspected | Inspection.HasBeenPerformed | Förbesiktigad |
| Inspection.PaidBy | Borttaget |  |
| Inspection.SellerInsurence | Borttaget |  |
| Insurance | Borttaget |  |
| Interests | Borttaget |  |
| Interior | Buildings |  |
| InternetSettings.BidSetting | Bidding.IsActive, Bidding.Bids |  |
| InternetSettings.IsVerifiedBidding | Bidding.IsVerified |  |
| Lease | Fees.Lease |  |
| Leasehold | Fees.Leasehold |  |
| MarketedAs | Subtype |  |
| Mortages | Pledges |  |
| OfficeId | Office.Id |  |
| Operation | Buildings.Expenses.Operation |  |
| Operation.PersonsInTheHousehold | Expenses.Operation.HouseholdSize |  |
| Plan | Buildings |  |
| Plot | Exterior.Plot |  |
| Sellers | Borttaget |  |
| TvAndBroadband | Buildings.Services |  |
| Ventilation | Buildings.Ventilation |  |
| ViewingSettings.MissingViewingTimeDescription | Marketing.Viewing.EmptyText |  |
| ViewingSettings.ShowOneViewingTimeOnInternet | Marketing.Viewing.VisibleLimit |  |
| WaterAndDrain | Buildings.Architecture[Type.Id=WaterAndDrain] |  |
| WebbId | Borttaget |  |
| Bostadsrätt |  |  |
| Association | Extensions.HousingCooperative.Association |  |
| BaseInformation.ApartmentNumber | Extensions.HousingCooperative.ApartmentNumber |  |
| BaseInformation.ApartmentNumberRegistration | Extensions.HousingCooperative.ApartmentRegistrationNumber |  |
| BaseInformation.Other | Extensions.HousingCooperative.Description |  |
| GroundIncludetToHousingCooperative | Extensions.HousingCooperative.IncludedLand |  |
| ParticipationAndRepairFund | Extensions.HousingCooperative.Finances |  |
| ParticipationAndRepairFund.ParticipationOffAnnualFee | Extensions.HousingCooperative.Finances.AnnualFeeShare |  |
| ParticipationAndRepairFund.RepairFund | Extensions.HousingCooperative.Finances.RepairFundBalance |  |
| ParticipationAndRepairFund.ShareComment | Extensions.HousingCooperative.Finances.SharesComment |  |
| Predge.Pawned | Extensions.HousingCooperative.Finances.IsPledged |  |
| Ägarlägenhet |  |  |
| CarSpaceOtherBuildings.CarSpace | Exterior.Entries |  |
| CarSpaceOtherBuildings.OtherBuildings | Exterior.BuildingsDescription |  |
| Community.Description | Extensions.Condominium.Community.Description |  |
| Community.ShareIn | Extensions.Condominium.Community.Share |  |
| Community.Space | Extensions.Condominium.Community.Space |  |
| OtherAreas.Cleaning | Extensions.Condominium.Areas.Cleaning |  |
| OtherAreas.Compilation | Extensions.Condominium.Areas.Description |  |
| OtherAreas.Courtyard | Extensions.Condominium.Areas.Courtyard |  |
| Gård |  |  |
| EconomyBuildings | Extensions.Farm.EconomyBuildings |  |
| Lands | Extensions.Farm.Lands |  |
| MainResidentialBuilding | Buildings[0] |  |
| OtherData | Extensions.Farm.OtherData |  |
| OtherResidentialBuildings | Buildings[1+] |  |
| PropertyTypeAndAreas.Alignment | Extensions.Farm.AgriculturalFocus |  |
| PropertyTypeAndAreas.Area | Extensions.Farm.Acreage.Total |  |
| PropertyTypeAndAreas.AreaData | Extensions.Farm.Acreage.Sum, Extensions.Farm.Acreage.Entries |  |
| PropertyTypeAndAreas.JointlyTaxedProperties | Extensions.Farm.JointlyTaxedProperties |  |
| PropertyTypeAndAreas.NumberOfpartition | Extensions.Farm.NumberOfPartitions |  |
| PropertyTypeAndAreas.PropertyType | Subtype |  |
| PropertyTypeAndAreas.ShowAreaDataOnInternet | Borttaget |  |
| Fastighet/Rörelse |  |  |
| Business | Extensions.CommercialProperty.Business |  |
| CompanyTransfer | Borttaget |  |
| CompilationAreas.Area | Extensions.CommercialProperty.CompilationArea.AreaSize |  |
| CompilationAreas.Areas. | Borttaget |  |
| CompilationAreas.AreaSource | Extensions.CommercialProperty.CompilationArea.AreaSource |  |
| CompilationAreas.ColdStockroom | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.Garage | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.Income.Comment | Extensions.CommercialProperty.CompilationArea.Income.Comment |  |
| CompilationAreas.Income.Description | Extensions.CommercialProperty.CompilationArea.Income.Description |  |
| CompilationAreas.Industry | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.Office | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.OperatingCosts | Extensions.CommercialProperty.CompilationArea.FlatOperatingCost |  |
| CompilationAreas.Other | Extensions.CommercialProperty.CompilationArea.Comment |  |
| CompilationAreas.Other1 | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.Other2 | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.OtherIncomes | Extensions.CommercialProperty.CompilationArea.Income.Other |  |
| CompilationAreas.Others | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.ParkingLot | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.RentIncomes | Extensions.CommercialProperty.CompilationArea.Income.Rental |  |
| CompilationAreas.Residential | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.Stores | Extensions.CommercialProperty.CompilationArea.Entries |  |
| CompilationAreas.Vacancies | Extensions.CommercialProperty.CompilationArea.Vacancies |  |
| CompilationAreas.WarmStockroom | Extensions.CommercialProperty.CompilationArea.Entries |  |
| Focus | Subtype |  |
| Price.Offer | Extensions.CommercialProperty.Offer.IsReceiving |  |
| Price.OfferNoLaterThen | Extensions.CommercialProperty.Offer.DeadlineAt |  |
| PropertytypeDescription.PropertytypeDescription | Borttaget |  |
| RenovationInfo | Extensions.CommercialProperty.RenovationPlan |  |
| SharedSpaces | Extensions.CommercialProperty.SharedSpaces |  |
| TechnicalData | Extensions.CommercialProperty.TechicalData |  |
| Lokal |  |  |
| CompilationAreas.Area | Extensions.Premises.CompilationArea.AreaSize |  |
| CompilationAreas.Areas | Extensions.Premises.CompilationArea.Entries |  |
| CompilationAreas.OperatingCosts | Extensions.Premises.CompilationArea.OperatingCost |  |
| CompilationAreas.Rent | Extensions.Premises.CompilationArea.Rent |  |
| Owners | Borttaget |  |
| TechnicalData | Extensions.Premises.TechicalData |  |
| Tenants | Borttaget |  |
| Utlandsobjekt |  |  |
| ForeignProperty.Descriptions | Extensions.ForeignProperty.Localizations |  |
| ForeignProperty.Distance | Extensions.ForeignProperty.Distances |  |
| ForeignProperty.Exterior | Exterior.Entries |  |

### Kontor

| Från | Till | Info |
| --- | --- | --- |
| Address | StreetAddress |  |
| Bankgiro | Borttaget |  |
| Chain.Id | BrandId |  |
| Chain.Name | Borttaget |  |
| City | City |  |
| CompanyPlace | Base |  |
| Coordinate | Coordinate |  |
| CorporateNumber | Borttaget |  |
| CustomerId | CustomerId |  |
| CustomerName | Name | Finns nu enbart ett namn |
| DateChanged | ChangedAt |  |
| Description | Description |  |
| EmailAddress | EmailAddress |  |
| Groups | Borttaget |  |
| HomePage | Borttaget |  |
| LegalCustomerName | Borttaget |  |
| Name | Name | Finns nu enbart ett namn |
| OfficeId | Id |  |
| OfficeName | Name | Finns nu enbart ett namn |
| OfficeNumber | Borttaget |  |
| PostalAddress | Borttaget |  |
| Postalgiro | Borttaget |  |
| PrimaryLeadReceiverId | Borttaget |  |
| Region | Borttaget |  |
| SubOffice | Borttaget |  |
| TaxCertificate | Borttaget |  |
| Telephone | Telephone.Switch |  |
| VAT | Borttaget |  |
| ZipCode | ZipCode |  |

### Användare

| Från | Till | Info |
| --- | --- | --- |
| Account | Borttaget |  |
| AllowLogon | Borttaget |  |
| Archived | Borttaget | Endast aktiva användare |
| Bank | Borttaget |  |
| Category | Category |  |
| CellPhone | Telephone.Cell |  |
| CleringNumber | Borttaget |  |
| Comment | Description |  |
| CustomerId | Offices.CustomerId |  |
| CustomerIdsWithSortOrder | Offices | Listas i korrekt ordning |
| DateChanged | ChangedAt |  |
| Department | Borttaget |  |
| DirectPhonenumbers | Offices.Telephone.Personal |  |
| EmailAddress | EmailAddress |  |
| ExternalUserId | Borttaget |  |
| ExtraTitle | Borttaget |  |
| Iban | Borttaget |  |
| Image | Image |  |
| InternalEmployeeNumber | Borttaget |  |
| Public | Borttaget | Endast publika användare |
| PublicPhonenumber | Telephone.Public |  |
| PublishedOnOffice | Borttaget | Enbart publika kontor listas |
| Reviews | Reviews |  |
| SpokenLanguages | SpokenLanguages |  |
| SubOffices | Borttaget |  |
| Swift | Borttaget |  |
| TelePhone | Borttaget |  |
| Title | Title |  |
| UserId | Id |  |
| UserName | Name |  |

### Projekt

| Från | Till | Info |
| --- | --- | --- |
| AdvertiseOn.Documents | Files |  |
| AdvertiseOn.FirstPublishingDateOnHomepage | Marketing.PublishedAt |  |
| AdvertiseOn.Homepage | Marketing.IsPublished |  |
| AdvertiseOn.ImageIds | Images |  |
| AdvertiseOn.Links | Links |  |
| AdvertiseOn.ShowAsComming | Status |  |
| AdvertiseOn.ShowAsPreview | Marketing.IsPreview |  |
| Assignment.AdditionalContact | SecondaryAgentId |  |
| Assignment.Estatenumber | ReferenceId |  |
| Assignment.MarketingMethods | Tags[Type.Id=SaleMethod].Names |  |
| Assignment.Producer | Producer.Name |  |
| Assignment.ResponsibleBroker | PrimaryAgentId |  |
| Assignment.Status | Status |  |
| BaseInformation.Address | Address |  |
| BaseInformation.NewConstruction | Borttaget |  |
| BaseInformation.ProjectName | Name |  |
| Condominiums | Borttaget |  |
| Cottages | Borttaget |  |
| CustomerId | Office.CustomerId |  |
| CustomFields | Borttaget |  |
| Description | Sale |  |
| Description.WayDescription | Address.Directions |  |
| Houses | Borttaget |  |
| HousingCooperatives | Borttaget |  |
| Interests | Borttaget |  |
| InternetSettings | Borttaget |  |
| LivingSpaceRange | Estates.LivingSpace |  |
| MonthlyCostRange | Estates.MonthlyFee |  |
| MovingIn | Sale.PossessionEstimation |  |
| NumberOfObjects | Borttaget |  |
| NumberOfRoomsRange | Estates.NumberOfRooms |  |
| OfficeId | Office.Id |  |
| Plots | Borttaget |  |
| PlotSpaceRange | Estates.Plot |  |
| PriceRange | Estates.Price |  |
| SalesStartDate | Sale.StartsAt |  |
| ViewingSettings.MissingViewingTimeDescription | Marketing.Viewing.EmptyText |  |
| ViewingSettings.ShowOneViewingTimeOnInternet | Marketing.Viewing.VisibleLimit |  |
