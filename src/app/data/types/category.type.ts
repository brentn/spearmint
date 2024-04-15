export type Category = {
  id: string;
  group: string;
  name: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { group: "INCOME", id: "INCOME_DIVIDENDS", name: "Dividends from investment accounts" },
  { group: "INCOME", id: "INCOME_INTEREST_EARNED", name: "Income from interest on savings accounts" },
  { group: "INCOME", id: "INCOME_RETIREMENT_PENSION", name: "Income from pension payments" },
  { group: "INCOME", id: "INCOME_TAX_REFUND", name: "Income from tax refunds" },
  { group: "INCOME", id: "INCOME_UNEMPLOYMENT", name: "Income from unemployment benefits, including unemployment insurance and healthcare" },
  { group: "INCOME", id: "INCOME_WAGES", name: "Income from salaries, gig-economy work, and tips earned" },
  { group: "INCOME", id: "INCOME_OTHER_INCOME", name: "Other miscellaneous income, including alimony, social security, child support, and rental" },
  { group: "TRANSFER_IN", id: "TRANSFER_IN_CASH_ADVANCES_AND_LOANS", name: "Loans and cash advances deposited into a bank account" },
  { group: "TRANSFER_IN", id: "TRANSFER_IN_DEPOSIT", name: "Cash, checks, and ATM deposits into a bank account" },
  { group: "TRANSFER_IN", id: "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS", name: "Inbound transfers to an invest,ment or retirement account" },
  { group: "TRANSFER_IN", id: "TRANSFER_IN_SAVINGS", name: "Inbound transfers to a savings account" },
  { group: "TRANSFER_IN", id: "TRANSFER_IN_ACCOUNT_TRANSFER", name: "General inbound transfers from another account" },
  { group: "TRANSFER_IN", id: "TRANSFER_IN_OTHER_TRANSFER_IN", name: "Other miscellaneous inbound transactions" },
  { group: "TRANSFER_OUT", id: "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS", name: "Transfers to an investment or retirement account, including investment apps such as Acorns, Betterment" },
  { group: "TRANSFER_OUT", id: "TRANSFER_OUT_SAVINGS", name: "Outbound transfers to savings accounts" },
  { group: "TRANSFER_OUT", id: "TRANSFER_OUT_WITHDRAWAL", name: "Withdrawals from a bank account" },
  { group: "TRANSFER_OUT", id: "TRANSFER_OUT_ACCOUNT_TRANSFER", name: "General outbound transfers to another account" },
  { group: "TRANSFER_OUT", id: "TRANSFER_OUT_OTHER_TRANSFER_OUT", name: "Other miscellaneous outbound transactions" },
  { group: "LOAN_PAYMENTS", id: "LOAN_PAYMENTS_CAR_PAYMENT", name: "Car loans and leases" },
  { group: "LOAN_PAYMENTS", id: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT", name: "Payments to a credit card. These are positive amounts for credit card subtypes and negative for depository subtypes" },
  { group: "LOAN_PAYMENTS", id: "LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT", name: "Personal loans, including cash advances and buy now pay later repayments" },
  { group: "LOAN_PAYMENTS", id: "LOAN_PAYMENTS_MORTGAGE_PAYMENT", name: "Payments on mortgages" },
  { group: "LOAN_PAYMENTS", id: "LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT", name: "Payments on student loans. For college tuition, refer to \"General Services - Education\"" },
  { group: "LOAN_PAYMENTS", id: "LOAN_PAYMENTS_OTHER_PAYMENT", name: "Other miscellaneous debt payments" },
  { group: "BANK_FEES", id: "BANK_FEES_ATM_FEES", name: "Fees incurred for out-of-network ATMs" },
  { group: "BANK_FEES", id: "BANK_FEES_FOREIGN_TRANSACTION_FEES", name: "Fees incurred on non-domestic transactions" },
  { group: "BANK_FEES", id: "BANK_FEES_INSUFFICIENT_FUNDS", name: "Fees relating to insufficient funds" },
  { group: "BANK_FEES", id: "BANK_FEES_INTEREST_CHARGE", name: "Fees incurred for interest on purchases, including not-paid-in-full or interest on cash advances" },
  { group: "BANK_FEES", id: "BANK_FEES_OVERDRAFT_FEES", name: "Fees incurred when an account is in overdraft" },
  { group: "BANK_FEES", id: "BANK_FEES_OTHER_BANK_FEES", name: "Other miscellaneous bank fees" },
  { group: "ENTERTAINMENT", id: "ENTERTAINMENT_CASINOS_AND_GAMBLING", name: "Gambling, casinos, and sports betting" },
  { group: "ENTERTAINMENT", id: "ENTERTAINMENT_MUSIC_AND_AUDIO", name: "Digital and in-person music purchases, including music streaming services" },
  { group: "ENTERTAINMENT", id: "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS", name: "Purchases made at sporting events, music venues, concerts, museums, and amusement parks" },
  { group: "ENTERTAINMENT", id: "ENTERTAINMENT_TV_AND_MOVIES", name: "In home movie streaming services and movie theaters" },
  { group: "ENTERTAINMENT", id: "ENTERTAINMENT_VIDEO_GAMES", name: "Digital and in-person video game purchases" },
  { group: "ENTERTAINMENT", id: "ENTERTAINMENT_OTHER_ENTERTAINMENT", name: "Other miscellaneous entertainment purchases, including night life and adult entertainment" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR", name: "Beer, Wine & Liquor Stores" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_COFFEE", name: "Purchases at coffee shops or cafes" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_FAST_FOOD", name: "Dining expenses for fast food chains" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_GROCERIES", name: "Purchases for fresh produce and groceries, including farmers' markets" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_RESTAURANT", name: "Dining expenses for restaurants, bars, gastropubs, and diners" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_VENDING_MACHINES", name: "Purchases made at vending machine operators" },
  { group: "FOOD_AND_DRINK", id: "FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK", name: "Other miscellaneous food and drink, including desserts, juice bars, and delis" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS", name: "Books, magazines, and news" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES", name: "Apparel, shoes, and jewelry" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_CONVENIENCE_STORES", name: "Purchases at convenience stores" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_DEPARTMENT_STORES", name: "Retail stores with wide ranges of consumer goods, typically specializing in clothing and home goods" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_DISCOUNT_STORES", name: "Stores selling goods at a discounted price" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_ELECTRONICS", name: "Electronics stores and websites" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES", name: "Photo, gifts, cards, and floral stores" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_OFFICE_SUPPLIES", name: "Stores that specialize in office goods" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", name: "Multi-purpose e-commerce platforms such as Etsy, Ebay and Amazon" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_PET_SUPPLIES", name: "Pet supplies and pet food" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_SPORTING_GOODS", name: "Sporting goods, camping gear, and outdoor equipment" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_SUPERSTORES", name: "Superstores such as Target and Walmart, selling both groceries and general merchandise" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_TOBACCO_AND_VAPE", name: "Purchases for tobacco and vaping products" },
  { group: "GENERAL_MERCHANDISE", id: "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE", name: "Other miscellaneous merchandise, including toys, hobbies, and arts and crafts" },
  { group: "HOME_IMPROVEMENT", id: "HOME_IMPROVEMENT_FURNITURE", name: "Furniture, bedding, and home accessories" },
  { group: "HOME_IMPROVEMENT", id: "HOME_IMPROVEMENT_HARDWARE", name: "Building materials, hardware stores, paint, and wallpaper" },
  { group: "HOME_IMPROVEMENT", id: "HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE", name: "Plumbing, lighting, gardening, and roofing" },
  { group: "HOME_IMPROVEMENT", id: "HOME_IMPROVEMENT_SECURITY", name: "Home security system purchases" },
  { group: "HOME_IMPROVEMENT", id: "HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT", name: "Other miscellaneous home purchases, including pool installation and pest control" },
  { group: "MEDICAL", id: "MEDICAL_DENTAL_CARE", name: "Dentists and general dental care" },
  { group: "MEDICAL", id: "MEDICAL_EYE_CARE", name: "Optometrists, contacts, and glasses stores" },
  { group: "MEDICAL", id: "MEDICAL_NURSING_CARE", name: "Nursing care and facilities" },
  { group: "MEDICAL", id: "MEDICAL_PHARMACIES_AND_SUPPLEMENTS", name: "Pharmacies and nutrition shops" },
  { group: "MEDICAL", id: "MEDICAL_PRIMARY_CARE", name: "Doctors and physicians" },
  { group: "MEDICAL", id: "MEDICAL_VETERINARY_SERVICES", name: "Prevention and care procedures for animals" },
  { group: "MEDICAL", id: "MEDICAL_OTHER_MEDICAL", name: "Other miscellaneous medical, including blood work, hospitals, and ambulances" },
  { group: "PERSONAL_CARE", id: "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", name: "Gyms, fitness centers, and workout classes" },
  { group: "PERSONAL_CARE", id: "PERSONAL_CARE_HAIR_AND_BEAUTY", name: "Manicures, haircuts, waxing, spa/massages, and bath and beauty products" },
  { group: "PERSONAL_CARE", id: "PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING", name: "Wash and fold, and dry cleaning expenses" },
  { group: "PERSONAL_CARE", id: "PERSONAL_CARE_OTHER_PERSONAL_CARE", name: "Other miscellaneous personal care, including mental health apps and services" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING", name: "Financial planning, and tax and accounting services" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_AUTOMOTIVE", name: "Oil changes, car washes, repairs, and towing" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_CHILDCARE", name: "Babysitters and daycare" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_CONSULTING_AND_LEGAL", name: "Consulting and legal services" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_EDUCATION", name: "Elementary, high school, professional schools, and college tuition" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_INSURANCE", name: "Insurance for auto, home, and healthcare" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_POSTAGE_AND_SHIPPING", name: "Mail, packaging, and shipping services" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_STORAGE", name: "Storage services and facilities" },
  { group: "GENERAL_SERVICES", id: "GENERAL_SERVICES_OTHER_GENERAL_SERVICES", name: "Other miscellaneous services, including advertising and cloud storage" },
  { group: "GOVERNMENT_AND_NON_PROFIT", id: "GOVERNMENT_AND_NON_PROFIT_DONATIONS", name: "Charitable, political, and religious donations" },
  { group: "GOVERNMENT_AND_NON_PROFIT", id: "GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES", name: "Government departments and agencies, such as driving licences, and passport renewal" },
  { group: "GOVERNMENT_AND_NON_PROFIT", id: "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT", name: "Tax payments, including income and property taxes" },
  { group: "GOVERNMENT_AND_NON_PROFIT", id: "GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT", name: "Other miscellaneous government and non-profit agencies" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_BIKES_AND_SCOOTERS", name: "Bike and scooter rentals" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_GAS", name: "Purchases at a gas station" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_PARKING", name: "Parking fees and expenses" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_PUBLIC_TRANSIT", name: "Public transportation, including rail and train, buses, and metro" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_TAXIS_AND_RIDE_SHARES", name: "Taxi and ride share services" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_TOLLS", name: "Toll expenses" },
  { group: "TRANSPORTATION", id: "TRANSPORTATION_OTHER_TRANSPORTATION", name: "Other miscellaneous transportation expenses" },
  { group: "TRAVEL", id: "TRAVEL_FLIGHTS", name: "Airline expenses" },
  { group: "TRAVEL", id: "TRAVEL_LODGING", name: "Hotels, motels, and hosted accommodation such as Airbnb" },
  { group: "TRAVEL", id: "TRAVEL_RENTAL_CARS", name: "Rental cars, charter buses, and trucks" },
  { group: "TRAVEL", id: "TRAVEL_OTHER_TRAVEL", name: "Other miscellaneous travel expenses" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY", name: "Gas and electricity bills" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_INTERNET_AND_CABLE", name: "Internet and cable bills" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_RENT", name: "Rent payment" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT", name: "Sewage and garbage disposal bills" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_TELEPHONE", name: "Cell phone bills" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_WATER", name: "Water bills" },
  { group: "RENT_AND_UTILITIES", id: "RENT_AND_UTILITIES_OTHER_UTILITIES", name: "Other miscellaneous utility bills" }
]