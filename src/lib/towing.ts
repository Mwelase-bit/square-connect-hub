// Royal Square-curated/approved towing directory (see requirements doc §3.4 Step 2).
// The AI ranks from this fixed, approved list only — it never invents or scrapes providers.
export interface TowProvider {
  name: string;
  phone: string;
  areas: string[];
  verified: boolean;
  etaMinutes: number;
  distanceKm: number;
}

const PROVIDERS: TowProvider[] = [
  { name: "AA Roadside Assist", phone: "+27 83 843 2222", areas: ["Johannesburg", "Pretoria", "Cape Town", "Durban"], verified: true, etaMinutes: 25, distanceKm: 4.2 },
  { name: "Discovery Insure Tow Partner", phone: "+27 11 555 6200", areas: ["Johannesburg", "Pretoria"], verified: true, etaMinutes: 30, distanceKm: 6.8 },
  { name: "Santam Approved Towing", phone: "+27 21 555 4310", areas: ["Cape Town"], verified: true, etaMinutes: 20, distanceKm: 3.1 },
  { name: "Metro Tow & Recovery", phone: "+27 31 555 8890", areas: ["Durban"], verified: true, etaMinutes: 35, distanceKm: 9.4 },
];

// Only ranks approved/verified providers covering the client's city — never falls
// back to an unverified option (doc: "escalate to the adviser" if none available).
export function rankTowProviders(city: string): TowProvider[] {
  return PROVIDERS.filter((p) => p.verified && p.areas.includes(city)).sort(
    (a, b) => a.distanceKm - b.distanceKm || a.etaMinutes - b.etaMinutes,
  );
}
