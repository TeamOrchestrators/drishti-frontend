
/*
mockExpeditions = [
  {
    id: "EXPEDITION-ID (ex: EXP-8821)",
    name: "EXPEDITION-NAME (ex: Queen Maud Land Crossing)",
    route: "FROM-→-TO (ex: Amundsen-Scott Station → Elisabeth Camp)",
    lead: "PERSONNEL-NAME-THAT-LEADS(ex: Dr. Lindqvist)",
    crew: CREW-PEOPLE-COUNT (ex: 8),
    status: "CURRENT-STATUS (ex: On the way)",
    day: "CURRENT-DAYS-COUNT-SINCE-START (ex: Day 18 of 54)",
    readiness: 93 (OPTIONAL, LEAVE IT i removed this from fronted),
    fuel: CURRENT-FUEL-QUANTITY (ex: 100),
    rations: RATION-QUANTITY(ration card wala ration)  (ex: 92),
    tone: "ice" (LEAVE-IT too, it's a frontend thing),
  }
]
 */


const mockExpeditions = [
  {
    id: "EXP-8821",
    name: "Queen Maud Land Crossing",
    route: "Amundsen-Scott Station → Elisabeth Camp",
    lead: "Dr. Lindqvist",
    crew: 8,
    status: "On the way",
    day: "Day 18 of 54",
    readiness: 93,
    fuel: 100,
    rations: 92,
    tone: "ice",
  },
  {
    id: "EXP-8824",
    name: "Vostok Ice Drilling Project",
    route: "McMurdo Station → Vostok Station",
    lead: "Dr. Petrov",
    crew: 12,
    status: "Getting ready",
    day: "Day 10 of 87",
    readiness: 78,
    fuel: 78,
    rations: 65,
    tone: "amber",
  },
  {
    id: "EXP-8829",
    name: "Ross Ice Shelf Survey Team",
    route: "Sector 4",
    lead: "T. MacIntyre",
    crew: 4,
    status: "Taking shelter",
    day: "—",
    readiness: 41,
    fuel: 60,
    rations: 88,
    tone: "flare",
    note: "Team is safe inside Hut 04, waiting out strong winds. Radio beacon is on.",
  },
  {
    id: "EXP-8833",
    name: "Byrd Glacier Research Trip",
    route: "Leaving from Amundsen Station",
    lead: "6 scientists",
    crew: 6,
    status: "Waiting for flight",
    day: "Dec 05",
    readiness: 30,
    fuel: 0,
    rations: 0,
    tone: "muted",
  },
];

export default mockExpeditions;