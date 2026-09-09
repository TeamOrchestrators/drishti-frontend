
/*
mockEmergencies = [
  {
    id: "EMERGENCY-ID (ex: EMG-114)",
    type: "DESCRIPTION (ex: Team stuck in a blizzard)",
    location: "LOCATION (ex: Sector 4)",
    severity: "SEVERITY (ex: Needs immediate response)",
    when: "WHEN-HAPPENED OR WHEN-REPORTED (ex: Today, 6:40 AM)",
    affected: PEOPLE-AFFECTED (ex: 4),
    resources: "RESOURCES-WANT (ex: Backup radio, warm supplies)",
    status: "CURRENT-STATUS (eX: Active)",
  }
]
 */


export const mockEmergencies = [
  {
    id: "EMG-114",
    type: "Team stuck in a blizzard",
    location: "Sector 4",
    severity: "Needs immediate response",
    when: "Today, 6:40 AM",
    affected: 4,
    resources: "Backup radio, warm supplies",
    status: "Active",
  },
  {
    id: "EMG-109",
    type: "Generator broke down at Hut 04",
    location: "Hut 04",
    severity: "Critical, but not extreme",
    when: "Yesterday, 10:10 PM",
    affected: 4,
    resources: "Replacement generator part",
    status: "Resolved",
  },
]

export default mockEmergencies;