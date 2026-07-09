import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BadRequestException, Body, Req } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { createS3PresignedPutUrl, evidenceObjectKey, validateEvidenceUpload } from "../../common/storage/s3-presign";

@ApiTags("storage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("storage")
export class StorageController {
  @Post("presign")
  @RequirePermissions("incident:create")
  presignUpload(@Body() dto: { fileName?: string; contentType?: string; sizeBytes?: number }, @Req() request: any) {
    if (!dto.fileName || !dto.contentType) throw new BadRequestException("fileName and contentType are required");
    validateEvidenceUpload(dto.contentType, dto.sizeBytes);
    const objectKey = evidenceObjectKey(request.user.sub, dto.fileName);
    return { uploadUrl: createS3PresignedPutUrl(objectKey), objectKey, expiresInSeconds: 900 };
  }
}
