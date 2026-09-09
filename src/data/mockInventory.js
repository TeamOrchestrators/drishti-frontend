/*
mockInventory = [
    {
        station: "INVENTORY-STATION-NAME (ex: Amundsen Station)",
        item: "ITEM-NAME (ex: Aircraft fuel (drums))",
        current: CURRENT-QUANTITY (ex: 142),
        min: MINIMUM-REQUIRED (ex: 400),
        max: MXIMUM-CAN-BE-FILLED (ex: 900),
        unit: "LIKE-UNIT-OF-ITEM(for any fuel it is litres, like that) (ex: drums)",
        criticality: "CRITICALITY (Critical or Low Stock or Normal)"
    }
]

inventoryHistory = [
  {
    item: "ITEM-NAME (ex: Aircraft fuel (drums))",
    station: "INVENTORY-STATION-NAME (ex: Amundsen Station)",
    change: HOW-MUCH-QUANTITY-CHANGED (ex: -40) ( - means used, + means received/stored in inventory),
    reason: "REASON-FOR-ITEMS-USED-OR-ADDED (ex: Used for expedition EXP-8821)",
    when: "DATE-OF-OPERATION (ex: 2026-11-30)"
  }
]
 */


export const mockInventory = [
  {
    station: "Amundsen Station",
    item: "Aircraft fuel (drums)",
    current: 142,
    min: 400,
    max: 900,
    unit: "drums",
    criticality: "Critical"
  },
  {
    station: "Sector 4 Depot",
    item: "Medical oxygen & plasma",
    current: 18,
    min: 50,
    max: 120,
    unit: "tanks",
    criticality: "Critical"
  },
  {
    station: "McMurdo Station",
    item: "Vehicle hydraulic fluid",
    current: 640,
    min: 1200,
    max: 2000,
    unit: "liters",
    criticality: "Low stock"
  },
  {
    station: "Rothera Station",
    item: "Food ration packs",
    current: 1840,
    min: 900,
    max: 2400,
    unit: "packs",
    criticality: "Normal"
  },
]

export const inventoryHistory = [
  {
    item: "Aircraft fuel (drums)",
    station: "Amundsen Station",
    change: -40,
    reason: "Used for expedition EXP-8821",
    when: "2026-11-30"
  },
  {
    item: "Food ration packs",
    station: "Rothera Station",
    change: +600,
    reason: "Resupply delivery received",
    when: "2026-11-27"
  },
  {
    item: "Medical oxygen & plasma",
    station: "Sector 4 Depot",
    change: -6,
    reason: "Used during emergency response",
    when: "2026-11-25"
  },
];


export default mockInventory;