import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";

@ApiTags("storage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("storage")
export class StorageController {
  @Post("presign")
  presignUpload() {
    return { uploadUrl: "replace-with-s3-presigned-url", objectKey: "evidence/dev-object" };
  }
}
