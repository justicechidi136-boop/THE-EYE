import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import type { JwtPayload } from "../../common/auth/jwt";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import type {
  AssignmentResponseInput,
  CreateCertificationInput,
  CreateDroneOperatorInput,
  CreateLicenceInput,
  CreateQualificationInput,
  CreateSafetyRecordInput,
  DocumentConfirmInput,
  DocumentPresignInput,
  MissionAssignmentInput,
  OperatorListQuery,
  OperatorStatusInput,
  PreflightCheckInput,
  SuitableOperatorsQuery,
  UpdateCertificationInput,
  UpdateDroneOperatorInput,
  UpdateLicenceInput,
  UpdateQualificationInput,
  VerificationActionInput,
} from "./dto/drone-operator.dto";
import { DroneOperatorService } from "./drone-operator.service";

@ApiTags("drone-operators")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("drone-surveillance/admin/operators")
export class DroneOperatorController {
  constructor(private readonly operators: DroneOperatorService) {}

  @Get()
  @RequirePermissions("drone:operator:read")
  listOperators(@Query() query: OperatorListQuery, @Req() request: { user: JwtPayload }) {
    return this.operators.listOperators(query, request.user);
  }

  @Post()
  @RequirePermissions("drone:operator:create")
  createOperator(@Body() dto: CreateDroneOperatorInput, @Req() request: { user: JwtPayload }) {
    return this.operators.createOperator(dto, request.user);
  }

  @Get("suitable")
  @RequirePermissions("drone:operator:assign")
  suitableOperators(@Query() query: SuitableOperatorsQuery, @Req() request: { user: JwtPayload }) {
    return this.operators.listSuitableOperators(query, request.user);
  }

  @Post("assignments")
  @RequirePermissions("drone:operator:assign")
  createAssignment(@Body() dto: MissionAssignmentInput, @Req() request: { user: JwtPayload }) {
    return this.operators.assignToMission(dto, request.user);
  }

  @Patch("assignments/:assignmentId")
  @RequirePermissions("drone:operator:assign")
  updateAssignment(
    @Param("assignmentId") assignmentId: string,
    @Body() dto: AssignmentResponseInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.respondToAssignment(assignmentId, dto, request.user);
  }

  @Post("missions/:missionId/preflight")
  @RequirePermissions("drone:mission:command")
  runPreflight(
    @Param("missionId") missionId: string,
    @Body() dto: PreflightCheckInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.runPreflightCheck(missionId, dto, request.user);
  }

  @Get(":id")
  @RequirePermissions("drone:operator:read")
  getOperator(@Param("id") id: string, @Req() request: { user: JwtPayload }) {
    return this.operators.getOperator(id, request.user);
  }

  @Patch(":id")
  @RequirePermissions("drone:operator:update")
  updateOperator(@Param("id") id: string, @Body() dto: UpdateDroneOperatorInput, @Req() request: { user: JwtPayload }) {
    return this.operators.updateOperator(id, dto, request.user);
  }

  @Patch(":id/status")
  @RequirePermissions("drone:operator:update")
  updateOperatorStatus(@Param("id") id: string, @Body() dto: OperatorStatusInput, @Req() request: { user: JwtPayload }) {
    return this.operators.updateStatus(id, dto, request.user);
  }

  @Post(":id/submit-for-verification")
  @RequirePermissions("drone:operator:update")
  submitForVerification(
    @Param("id") id: string,
    @Body() body: { notes?: string },
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.submitForVerification(id, body?.notes, request.user);
  }

  @Post(":id/licences")
  @RequirePermissions("drone:operator:update")
  createLicence(@Param("id") id: string, @Body() dto: CreateLicenceInput, @Req() request: { user: JwtPayload }) {
    return this.operators.createLicence(id, dto, request.user);
  }

  @Patch(":id/licences/:licenceId")
  @RequirePermissions("drone:operator:update")
  updateLicence(
    @Param("id") id: string,
    @Param("licenceId") licenceId: string,
    @Body() dto: UpdateLicenceInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.updateLicence(id, licenceId, dto, request.user);
  }

  @Post(":id/licences/:licenceId/verify")
  @RequirePermissions("drone:operator:verify")
  verifyLicence(
    @Param("id") id: string,
    @Param("licenceId") licenceId: string,
    @Body() dto: VerificationActionInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.verifyLicence(id, licenceId, dto, request.user);
  }

  @Post(":id/certifications")
  @RequirePermissions("drone:operator:update")
  createCertification(@Param("id") id: string, @Body() dto: CreateCertificationInput, @Req() request: { user: JwtPayload }) {
    return this.operators.createCertification(id, dto, request.user);
  }

  @Patch(":id/certifications/:certId")
  @RequirePermissions("drone:operator:update")
  updateCertification(
    @Param("id") id: string,
    @Param("certId") certId: string,
    @Body() dto: UpdateCertificationInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.updateCertification(id, certId, dto, request.user);
  }

  @Post(":id/certifications/:certId/verify")
  @RequirePermissions("drone:operator:verify")
  verifyCertification(
    @Param("id") id: string,
    @Param("certId") certId: string,
    @Body() dto: VerificationActionInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.verifyCertification(id, certId, dto, request.user);
  }

  @Post(":id/qualifications")
  @RequirePermissions("drone:operator:update")
  createQualification(@Param("id") id: string, @Body() dto: CreateQualificationInput, @Req() request: { user: JwtPayload }) {
    return this.operators.createQualification(id, dto, request.user);
  }

  @Patch(":id/qualifications/:qualId")
  @RequirePermissions("drone:operator:update")
  updateQualification(
    @Param("id") id: string,
    @Param("qualId") qualId: string,
    @Body() dto: UpdateQualificationInput,
    @Req() request: { user: JwtPayload },
  ) {
    return this.operators.updateQualification(id, qualId, dto, request.user);
  }

  @Get(":id/missions")
  @RequirePermissions("drone:operator:read")
  listMissions(@Param("id") id: string, @Req() request: { user: JwtPayload }) {
    return this.operators.listOperatorMissions(id, request.user);
  }

  @Get(":id/documents")
  @RequirePermissions("drone:operator:documents:read")
  listDocuments(@Param("id") id: string, @Req() request: { user: JwtPayload }) {
    return this.operators.listDocuments(id, request.user);
  }

  @Post(":id/documents/presign")
  @RequirePermissions("drone:operator:update")
  presignDocument(@Param("id") id: string, @Body() dto: DocumentPresignInput, @Req() request: { user: JwtPayload }) {
    return this.operators.presignDocument(id, dto, request.user);
  }

  @Post(":id/documents/confirm")
  @RequirePermissions("drone:operator:update")
  confirmDocument(@Param("id") id: string, @Body() dto: DocumentConfirmInput, @Req() request: { user: JwtPayload }) {
    return this.operators.confirmDocument(id, dto, request.user);
  }

  @Get(":id/documents/:docId/download")
  @RequirePermissions("drone:operator:documents:read")
  downloadDocument(@Param("id") id: string, @Param("docId") docId: string, @Req() request: { user: JwtPayload }) {
    return this.operators.authorizeDocumentDownload(id, docId, request.user);
  }

  @Get(":id/safety")
  @RequirePermissions("drone:operator:safety:read")
  listSafetyRecords(@Param("id") id: string, @Req() request: { user: JwtPayload }) {
    return this.operators.listSafetyRecords(id, request.user);
  }

  @Post(":id/safety")
  @RequirePermissions("drone:operator:safety:manage")
  createSafetyRecord(@Param("id") id: string, @Body() dto: CreateSafetyRecordInput, @Req() request: { user: JwtPayload }) {
    return this.operators.createSafetyRecord(id, dto, request.user);
  }

  @Get(":id/audit")
  @RequirePermissions("drone:operator:audit:read")
  listAuditTrail(@Param("id") id: string, @Req() request: { user: JwtPayload }) {
    return this.operators.getAuditHistory(id, request.user);
  }
}
