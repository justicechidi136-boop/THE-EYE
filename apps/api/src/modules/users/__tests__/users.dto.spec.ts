import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateOperationalAdminDto } from "../dto/users.dto";

describe("Operational account DTO validation", () => {
  it("rejects a caller-supplied account ID at the HTTP validation boundary", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });

    await expect(pipe.transform({
      id: "11111111-1111-4111-8111-111111111111",
      accountType: "field_officer",
      displayName: "QA Field Officer",
      email: "qa.field.officer@example.test",
      agencyId: "22222222-2222-4222-8222-222222222222",
    }, {
      type: "body",
      metatype: CreateOperationalAdminDto,
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
