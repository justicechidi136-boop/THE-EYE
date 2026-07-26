import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/neighborhood_watch/volunteer_categories.dart";

void main() {
  group("VolunteerCategorySelection", () {
    test("select adds api enum to payload", () {
      final selection = VolunteerCategorySelection();
      selection.toggle("Doctor");
      expect(selection.isSelected("Doctor"), isTrue);
      expect(selection.toPayload(), ["Doctor"]);
    });

    test("deselect removes api enum from payload", () {
      final selection = VolunteerCategorySelection(["Doctor", "Nurse"]);
      selection.toggle("Doctor");
      expect(selection.isSelected("Doctor"), isFalse);
      expect(selection.toPayload(), ["Nurse"]);
    });

    test("multiple selection preserves canonical api enums", () {
      final selection = VolunteerCategorySelection();
      selection.toggle("FirstAid");
      selection.toggle("SecurityVolunteer");
      expect(selection.toPayload(), ["FirstAid", "SecurityVolunteer"]);
    });

    test("empty selection returns validation error", () {
      final selection = VolunteerCategorySelection();
      expect(selection.validationError(), isNotNull);
      expect(selection.toPayload(), isEmpty);
    });

    test("invalid enum is rejected before API payload use", () {
      final selection = VolunteerCategorySelection(["NotARealType"]);
      expect(selection.validationError(), contains("Unsupported volunteer category"));
    });

    test("canonical categories map labels to api enums", () {
      final firstAid = canonicalVolunteerCategories
          .firstWhere((category) => category.apiType == "FirstAid");
      expect(firstAid.label, "First Aid");
      expect(canonicalVolunteerApiTypes.contains("SearchAndRescue"), isTrue);
    });
  });
}
