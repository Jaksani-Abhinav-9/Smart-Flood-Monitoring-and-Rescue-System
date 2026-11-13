// Authorized Rescue Team Credentials
export const authorizedRescueAccounts = [
  {
    id: "rescue-01",
    email: "rescue1@floodrescue.gov",
    password: "rescue@gov",
    name: "Rescue Team Alpha"
  },
  {
    id: "rescue-02",
    email: "rescue2@floodrescue.gov",
    password: "rescue@gov",
    name: "Rescue Team Bravo"
  },
  {
    id: "rescue-03",
    email: "commander@floodrescue.gov",
    password: "rescue@gov",
    name: "Rescue Commander"
  },
  {
    id: "rescue-04",
    email: "rescue@test.com",
    password: "rescue@gov",
    name: "Rescue Unit Special"
  }
];

export function verifyRescueCredentials(email, password) {
  if (!email || !password) return null;
  const cleanEmail = email.trim().toLowerCase();
  return authorizedRescueAccounts.find(
    acc => acc.email.toLowerCase() === cleanEmail && acc.password === password
  ) || null;
}
