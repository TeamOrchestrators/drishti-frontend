
/*
mockCargo = [
    {
        id: "CARGO-ID (ex: CG-2291)",
        item: "ITEM-NAME (ex: Aircraft fuel (drums))",
        qty: "NO-OF-ITEMS (ex: 142 drums)",
        weight: "NET-WEIGHT (ex: 268 MT)",
        dest: "DESTINATION (ex: Amundsen Station)",
        priority: "PRIORITY (Critical or Standard)",
        status: "CURRENT-STATUS (ex: In transit)"
    }
]

mockVoyage = [
    {
        vessel: "NAME-OF-VEHICLE (ex: Cargo ship #33)",
        type: "TYPE-OF-VEHICLE (ex: Icebreaker ship)",
        route: "FROM-→-TO (ex: Lyttelton → McMurdo)",
        cargo: "WEIGHT (ex: 2,400 MT)",
        eta: "EVERYONE-KNOW-THIS (ex: Dec 06)",
        status: "CURRENT-STATUS (ex: Sailing)"
    }
]
 */

const mockCargo = [
    {
        id: "CG-2291",
        item: "Aircraft fuel (drums)",
        qty: "142 drums",
        weight: "268 MT",
        dest: "Amundsen Station",
        priority: "Critical",
        status: "In transit"
    },
    {
        id: "CG-2294",
        item: "Medical oxygen tanks",
        qty: "18 units",
        weight: "2.1 MT",
        dest: "Sector 4 Depot",
        priority: "Critical",
        status: "Waiting for flight"
    },
    {
        id: "CG-2298",
        item: "Portable shelter units",
        qty: "6 units",
        weight: "44 MT",
        dest: "Rothera",
        priority: "Standard",
        status: "In transit"
    },
    {
        id: "CG-2301",
        item: "Lab equipment kits",
        qty: "30 kits",
        weight: "1.4 MT",
        dest: "Rothera",
        priority: "Standard",
        status: "Delivered"
    },
]

const mockVoyage = [
    {
        vessel: "Polar Star",
        type: "Icebreaker ship",
        route: "Lyttelton → McMurdo",
        cargo: "2,400 MT",
        eta: "Dec 06",
        status: "Sailing"
    },
    {
        vessel: "David Attenborough",
        type: "Research ship",
        route: "Falklands → Rothera",
        cargo: "850 MT",
        eta: "Dec 04",
        status: "Sailing"
    },
    {
        vessel: "Cargo Plane #33",
        type: "Aircraft",
        route: "Williams → South Pole",
        cargo: "14 MT",
        eta: "On hold",
        status: "Grounded"
    },
]

export {mockCargo, mockVoyage};