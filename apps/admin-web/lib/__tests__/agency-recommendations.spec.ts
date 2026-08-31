import { readFileSync } from "fs";
import { resolve } from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecommendationResults } from "../../components/recommended-responders";
import {
  formatRecommendationDistance,
  recommendationGroupLabel,
  recommendationNavigationUrl,
  type AgencyRecommendation,
  type AgencyRecommendationResponse,
} from "../agency-recommendations";

const recommendation = {
  agencyId: "agency-1",
  agencyName: "Lagos State Emergency Management Agency",
  officeId: "office-1",
  officeName: "Lagos Response Office",
  endpointType: "AGENCY_OFFICE",
  tier: "PRIMARY",
  capability: "Emergency",
  jurisdictionLevel: "STATE",
  verificationStatus: "VERIFIED",
  operationalReady: true,
  coordinateQualified: true,
  coordinates: { latitude: 6.6, longitude: 3.35 },
  distanceMeters: 850,
  publicAddress: "1 Long Verified Public Address, Ikeja, Lagos",
  publicContacts: [],
  reasons: ["Verified emergency-management capability for Lagos."],
  limitations: [],
} as AgencyRecommendation;

function response(overrides: Partial<AgencyRecommendationResponse> = {}): AgencyRecommendationResponse {
  return {
    ruleVersion: "agency-recommendation-v1",
    advisoryOnly: true,
    actionableRecommendations: [],
    structuralMatches: [],
    informationalMatches: [],
    limitations: [],
    input: { geography: { countryName: "Nigeria", stateName: "Lagos", lgaName: "Ikeja", wardName: null } },
    meta: { incidentStateChanged: false, outboundCommunicationCalls: 0 },
    ...overrides,
  };
}

describe("Agency recommendation presentation", () => {
  it("formats meters, kilometres, and absent distance without a fake zero", () => {
    expect(formatRecommendationDistance(850)).toBe("850 m");
    expect(formatRecommendationDistance(3200)).toBe("3.2 km");
    expect(formatRecommendationDistance(null)).toBe("Distance unavailable");
  });

  it("keeps actionable and structural recommendation groups distinct", () => {
    expect(recommendationGroupLabel("PRIMARY")).toBe("Primary operational responders");
    expect(recommendationGroupLabel("SECONDARY")).toBe("Supporting operational responders");
    expect(recommendationGroupLabel("STRUCTURAL_ONLY")).toBe("Structural / directory matches");
  });

  it("renders PRIMARY and SECONDARY recommendations in separate groups", () => {
    const html = renderToStaticMarkup(createElement(RecommendationResults, { data: response({
      actionableRecommendations: [recommendation, { ...recommendation, officeId: "office-2", tier: "SECONDARY" }],
    }) }));
    expect(html).toContain("Primary operational responders");
    expect(html).toContain("Supporting operational responders");
    expect(html).toContain("Verified operational directory endpoint");
  });

  it("renders structural-only limitations without presenting an operational responder", () => {
    const structural = {
      ...recommendation,
      officeId: null,
      officeName: null,
      tier: "STRUCTURAL_ONLY",
      operationalReady: false,
      coordinateQualified: false,
      coordinates: null,
      distanceMeters: null,
      publicAddress: null,
      limitations: ["No verified operational endpoint", "No verified coordinates"],
    } as AgencyRecommendation;
    const html = renderToStaticMarkup(createElement(RecommendationResults, { data: response({ structuralMatches: [structural] }) }));
    expect(html).toContain("No verified operational responder is currently available");
    expect(html).toContain("Relevant agency structure verified");
    expect(html).toContain("Distance unavailable");
    expect(html.includes("Open Navigation")).toBe(false);
  });

  it("renders a neutral total-empty state", () => {
    const html = renderToStaticMarkup(createElement(RecommendationResults, { data: response() }));
    expect(html).toContain("No verified agency recommendation is currently available");
  });

  it("distinguishes emergency and public contacts and shows verified navigation", () => {
    const html = renderToStaticMarkup(createElement(RecommendationResults, { data: response({
      actionableRecommendations: [{
        ...recommendation,
        publicContacts: [
          { type: "EMERGENCY_PHONE", value: "112", label: "Emergency", emergencyOnly: true },
          { type: "PHONE", value: "+23410000000", label: "Public desk", emergencyOnly: false },
        ],
      }],
    }) }));
    expect(html).toContain("Verified emergency contact");
    expect(html).toContain("Verified public contact");
    expect(html).toContain("Open Navigation");
  });

  it("enables navigation only for qualified non-zero coordinates", () => {
    expect(recommendationNavigationUrl(recommendation)).toContain("6.6,3.35");
    expect(recommendationNavigationUrl({ ...recommendation, coordinateQualified: false })).toBe(null);
    expect(recommendationNavigationUrl({ ...recommendation, coordinates: null })).toBe(null);
    expect(recommendationNavigationUrl({ ...recommendation, coordinates: { latitude: 0, longitude: 0 } })).toBe(null);
  });

  it("renders every advisory state and keeps contacts semantically distinct", () => {
    const source = readFileSync(resolve(__dirname, "../../components/recommended-responders.tsx"), "utf8");
    const presentation = readFileSync(resolve(__dirname, "../agency-recommendations.ts"), "utf8");
    expect(presentation).toContain("Primary operational responders");
    expect(presentation).toContain("Supporting operational responders");
    expect(source).toContain("STRUCTURAL_ONLY");
    expect(source).toContain("No verified operational responder is currently available");
    expect(source).toContain("No verified agency recommendation is currently available");
    expect(source).toContain("Agency recommendations are temporarily unavailable");
    expect(source).toContain("Loading agency recommendations");
    expect(source).toContain("Verified emergency contact");
    expect(source).toContain("Verified public contact");
    expect(source).toContain("Refresh Recommendations");
  });

  it("contains no dispatch, notify, send, contact-responder, or escalation controls", () => {
    const source = readFileSync(resolve(__dirname, "../../components/recommended-responders.tsx"), "utf8");
    expect(source.includes(">Dispatch<")).toBe(false);
    expect(source.includes(">Notify<")).toBe(false);
    expect(source.includes(">Send<")).toBe(false);
    expect(source.includes("Contact Responder")).toBe(false);
    expect(source.includes(">Escalate<")).toBe(false);
  });

  it("keeps View Report reachable in a local horizontal scroller with a sticky action column", () => {
    const table = readFileSync(resolve(__dirname, "../../components/report-centre-table.tsx"), "utf8");
    expect(table).toContain("data-admin-horizontal-scroll");
    expect(table).toContain("overflow-x-auto");
    expect(table).toContain("sticky right-0");
    expect(table).toContain("whitespace-nowrap");
    expect(table.includes("break-all")).toBe(false);
  });

  it("provides keyboard-accessible directional page and table controls", () => {
    const control = readFileSync(resolve(__dirname, "../../components/directional-scroll-control.tsx"), "utf8");
    expect(control).toContain("Scroll page up");
    expect(control).toContain("Scroll page down");
    expect(control).toContain("Scroll table left");
    expect(control).toContain("Scroll table right");
    expect(control).toContain("pointer-events-none");
    expect(control).toContain("pointer-events-auto");
  });
});
