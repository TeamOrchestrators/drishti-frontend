/*
mockPersonnels = [
  {
        name: "NAME-OF-PERSONNEL (ex: David Ross)",
        role: "ROLE-OF-PERSONNEL (ex: Pilot)",
        from: "FROM (like not their hometown, where they are going from for duty) (ex: Christchurch)",
        to: "TO (same here, where they are going to for duty) (ex: McMurdo)",
        status: "CURRENT-STATUS (ex: In the air)",
        eta: "EVERYONE-KNOWS-THIS (ex: Lands 2:30 AM)"
    }
]

mockAllPersonnels = [
  {
      id: "PERSONNEL-ID (alphanumeric)",
      name: "PERSONNEL-NAME (alphabetic)",
      role: "PERSONNEL-ROLE (alphabetic)",
      currentStation: "CURRENT-STATION (alphanumeric/alphabetic)"
  }
]
 */

export const mockAllPersonnels = [
  {id: "P-01", name: "Sarah Chen", role: "Route Guide", currentStation: "McMurdo"},
  {id: "P-02", name: "Marcus Vane", role: "Engineer", currentStation: "Dome C"},
  {id: "P-03", name: "Dr. Alexei Rivera", role: "Ice Scientist", currentStation: "Sector 4"},
  {id: "P-04", name: "David Ross", role: "Pilot", currentStation: "Christchurch"},
  {id: "P-05", name: "Hannah Brandt", role: "Medic", currentStation: "Rothera"},
  {id: "P-06", name: "Dr. Lindqvist", role: "Expedition Lead", currentStation: "Amundsen-Scott Station"},
  {id: "P-07", name: "Dr. Petrov", role: "Expedition Lead", currentStation: "McMurdo"},
  {id: "P-08", name: "T. MacIntyre", role: "Field Lead", currentStation: "Sector 4"},
  {id: "P-09", name: "Priya Nair", role: "Communications Officer", currentStation: "McMurdo"},
  {id: "P-10", name: "Tom Ashworth", role: "Mechanic", currentStation: "Amundsen-Scott Station"},
  {id: "P-11", name: "Elena Kovacs", role: "Meteorologist", currentStation: "Rothera"},
  {id: "P-12", name: "James Okafor", role: "Logistics Officer", currentStation: "McMurdo"},
  {id: "P-13", name: "Yuki Tanaka", role: "Ice Scientist", currentStation: "Dome C"},
  {id: "P-14", name: "Liam Foster", role: "Medic", currentStation: "Concordia"},
  {id: "P-15", name: "Anna Kessler", role: "Pilot", currentStation: "Christchurch"},
  {id: "P-16", name: "Ravi Menon", role: "Engineer", currentStation: "Vostok Station"},
];


export const mockPersonnels = [
  {name: "Sarah Chen", role: "Route Guide", from: "McMurdo", to: "Amundsen", status: "On the way", eta: "Dec 02"},
  {name: "Marcus Vane", role: "Engineer", from: "Dome C", to: "Concordia", status: "On the way", eta: "Dec 01"},
  {
    name: "Dr. Alexei Rivera",
    role: "Ice Scientist",
    from: "Sector 4",
    to: "Depot Base",
    status: "Waiting for weather",
    eta: "—"
  },
  {
    name: "David Ross",
    role: "Pilot",
    from: "Christchurch",
    to: "McMurdo",
    status: "In the air",
    eta: "Lands 2:30 AM"
  },
  {name: "Hannah Brandt", role: "Medic", from: "Palmer", to: "Rothera", status: "Arrived safely", eta: "—"},
]

