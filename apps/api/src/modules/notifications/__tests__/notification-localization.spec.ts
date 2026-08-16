import {
  groupNotificationRecipientsByLocale,
  localizeNotification,
  resolveNotificationTemplateKey,
} from "../notification-localization";

describe("notification localization", () => {
  for (const [locale, expectedTitle] of [
    ["en", "Missing person alert"],
    ["ha", "Sanarwar bataccen mutum"],
    ["yo", "Ikilo eni ti o sonu"],
    ["ig", "Nti onye efuru"],
    ["pcm", "Missing person alert"],
  ]) {
    it(`localizes missing person alerts for ${locale}`, () => {
      const result = localizeNotification({
        type: "MissingPersonAlert",
        title: "Missing person alert",
        body: "Help find Ada.",
        recipientPreferredLocale: locale,
        metadata: {
          notificationParams: {
            personName: "Ada Okafor",
            areaName: "Allen Avenue",
          },
        },
      });

      expect(result.title).toBe(expectedTitle);
      expect(result.body).toContain("Ada Okafor");
      expect(result.body).toContain("Allen Avenue");
    });
  }

  it("groups recipients by effective locale without forcing one broadcast language", () => {
    const grouped = groupNotificationRecipientsByLocale([
      { userId: "en-1", preferredLocale: "en" },
      { userId: "ha-1", preferredLocale: "ha" },
      { userId: "yo-1", preferredLocale: "yo" },
      { userId: "ig-1", preferredLocale: "ig" },
      { userId: "pcm-1", preferredLocale: "pcm" },
      { userId: "fallback-1", preferredLocale: "fr" },
    ]);

    expect([...grouped.keys()].sort()).toEqual(["en", "ha", "ig", "pcm", "yo"]);
    expect(grouped.get("en")?.map((item) => item.userId)).toEqual([
      "en-1",
      "fallback-1",
    ]);
  });

  it("falls back to English/original copy when a template is missing", () => {
    const result = localizeNotification({
      type: "SupportChatReply",
      title: "Support reply",
      body: "A support agent replied.",
      recipientPreferredLocale: "ha",
      metadata: { templateKey: "support.untranslated" },
    });

    expect(result.title).toBe("Support reply");
    expect(result.body).toBe("A support agent replied.");
    expect(result.locale).toBe("ha");
    expect(result.fallbackLocale).toBe("en");
    expect(result.missingTemplate).toBe(true);
  });

  it("preserves proper nouns, plate numbers, and identifiers as parameters", () => {
    const result = localizeNotification({
      type: "StolenVehicleAlert",
      title: "Stolen vehicle alert",
      body: "Watch for the vehicle.",
      recipientPreferredLocale: "yo",
      metadata: {
        notificationParams: {
          vehicleDescription: "Toyota Corolla",
          plateNumber: "ABC-123-LA",
        },
      },
    });

    expect(result.body).toContain("Toyota Corolla");
    expect(result.body).toContain("ABC-123-LA");
  });

  it("maps trusted danger codes to structured locale templates", () => {
    expect(
      resolveNotificationTemplateKey("NearbyDangerWarning", {
        dangerAlert: { alertCode: "DANGER_ZONE_ARMED_ROBBERY_NEARBY" },
      }),
    ).toBe("danger.armedRobberyNearby");

    const result = localizeNotification({
      type: "NearbyDangerWarning",
      title: "Danger nearby",
      body: "Avoid the area.",
      recipientPreferredLocale: "pcm",
      metadata: {
        dangerAlert: {
          alertCode: "DANGER_ZONE_ARMED_ROBBERY_NEARBY",
          areaName: "Ikeja Bridge",
          distanceMeters: 300,
        },
      },
    });

    expect(result.title).toBe("Armed robbery dey near");
    expect(result.body).toContain("Ikeja Bridge");
    expect(result.body).toContain("300");
  });

  for (const [templateKey, type, locale] of [
    ["field.assignment", "AdminAssignmentAlert", "ha"],
    ["field.backupRequest", "AdminAssignmentAlert", "ig"],
    ["officer.safety", "AdminAssignmentAlert", "pcm"],
    ["sighting.alert", "BroadcastSightingAlert", "yo"],
    ["neighborhoodWatch.alert", "BroadcastAlert", "en"],
  ]) {
    it(`supports ${templateKey} notification templates`, () => {
      const result = localizeNotification({
        type,
        title: "Operational alert",
        body: "Operational update",
        recipientPreferredLocale: locale,
        metadata: {
          templateKey,
          notificationParams: {
            incidentId: "INC-42",
            assignmentId: "ASG-9",
            officerName: "Officer Musa",
            areaName: "Surulere",
            communityName: "Zone A",
            message: "Gate check updated",
          },
        },
      });

      expect(result.missingTemplate).not.toBe(true);
      expect(result.body).not.toContain("{");
    });
  }
});
