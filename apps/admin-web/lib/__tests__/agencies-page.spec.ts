import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Agencies page presentation", () => {
  const source = readFileSync(
    join(process.cwd(), "app", "agencies", "page.tsx"),
    "utf8",
  );

  it("uses shrinkable responsive filter tracks without overlapping controls", () => {
    expect(source).toContain("grid-cols-1 gap-4 sm:grid-cols-2");
    expect(source).toContain("xl:grid-cols-[minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(200px,1fr)_minmax(150px,0.8fr)]");
    expect(source).toContain("h-11 min-w-0 w-full max-w-full");
    expect(source).toContain("sm:col-span-2 xl:col-span-4");
  });

  it("uses the orange brand token only for agency-name links", () => {
    expect(source).toContain("font-semibold text-eyeOrange hover:underline");
    expect(source).toContain("tone={agency.isActive ? \"success\" : \"danger\"}");
    expect(source).toContain("tone={agency.isFieldOperationsEnabled ? \"success\" : \"info\"}");
  });

  it("keeps the agency table within a local horizontal scroller", () => {
    expect(source).toContain("max-w-full min-w-0 overflow-x-auto");
    expect(source).toContain("w-full min-w-[960px]");
  });
});
