import type { JurisdictionRowView, PoliceStationView } from "./types/admin-views";

type RawCommunity = {
  country?: string | null;
  state?: string | null;
  lga?: string | null;
  ward?: string | null;
};

type ScopedUser = {
  country: string;
  state: string;
  lga: string;
};

function key(country: string, state: string, lga: string, ward: string) {
  return [country, state, lga, ward].join("|");
}

export function buildJurisdictionRows(
  communities: RawCommunity[],
  users: ScopedUser[],
  stations: PoliceStationView[],
): JurisdictionRowView[] {
  const rows = new Map<string, JurisdictionRowView>();

  function ensure(country: string, state: string, lga: string, ward: string) {
    const id = key(country, state, lga, ward);
    if (!rows.has(id)) {
      rows.set(id, { country, state, lga, ward, communities: 0, users: 0, policeStations: 0 });
    }
    return rows.get(id)!;
  }

  for (const community of communities) {
    const row = ensure(
      String(community.country ?? "—"),
      String(community.state ?? "—"),
      String(community.lga ?? "—"),
      String(community.ward ?? "—"),
    );
    row.communities += 1;
  }

  for (const user of users) {
    const row = ensure(user.country, user.state, user.lga, "—");
    row.users += 1;
  }

  for (const station of stations) {
    const row = ensure(
      String(station.country ?? "—"),
      String(station.state ?? "—"),
      String(station.lga ?? "—"),
      "—",
    );
    row.policeStations += 1;
  }

  return [...rows.values()].sort((left, right) => {
    const leftPath = [left.country, left.state, left.lga, left.ward].join("/");
    const rightPath = [right.country, right.state, right.lga, right.ward].join("/");
    return leftPath.localeCompare(rightPath);
  });
}
