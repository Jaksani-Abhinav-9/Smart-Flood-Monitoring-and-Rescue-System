export function getShelterCapacity(): any[] {
  return [
    {
      name: "Kamareddy Municipal School",
      capacity: 300,
      occupancy: 145,
      available_spots: 155,
      status: "active"
    },
    {
      name: "Secunderabad Community Center",
      capacity: 500,
      occupancy: 480,
      available_spots: 20,
      status: "near_capacity"
    },
    {
      name: "Nizamabad Youth Sports Club",
      capacity: 250,
      occupancy: 95,
      available_spots: 155,
      status: "active"
    }
  ];
}

export function getEmergencyContacts(): Record<string, string> {
  return {
    disaster_helpline: "108",
    national_disaster_response_force: "011-23438084",
    district_control_room: "08468-220022",
    flood_rescue_operations: "1800-425-4666"
  };
}
