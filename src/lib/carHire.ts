// Royal Square-curated/approved car hire directory, suggested to clients
// while their vehicle is in for repair. Approved list only — no invented
// or scraped providers.
export interface CarHireProvider {
  name: string;
  phone: string;
  areas: string[];
  verified: boolean;
  dailyRate: number;
}

const PROVIDERS: CarHireProvider[] = [
  { name: "Avis South Africa", phone: "+27 11 387 8431", areas: ["Johannesburg", "Pretoria", "Cape Town", "Durban"], verified: true, dailyRate: 420 },
  { name: "Europcar Insurance Replacement", phone: "+27 21 380 4700", areas: ["Cape Town", "Johannesburg"], verified: true, dailyRate: 395 },
  { name: "First Car Rental", phone: "+27 11 552 9000", areas: ["Johannesburg", "Pretoria", "Durban"], verified: true, dailyRate: 360 },
];

export function rankCarHireProviders(city: string): CarHireProvider[] {
  return PROVIDERS.filter((p) => p.verified && p.areas.includes(city)).sort((a, b) => a.dailyRate - b.dailyRate);
}

// Rough turnaround estimate for a standard panel-beating repair, used to
// suggest when the hire car should be returned relative to the repair
// drop-off date. Purely a suggestion — the adviser's weekly updates are the
// authoritative source of the real completion date.
export function suggestHireCarReturn(repairDate: string): string | null {
  if (!repairDate) return null;
  const d = new Date(repairDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}
