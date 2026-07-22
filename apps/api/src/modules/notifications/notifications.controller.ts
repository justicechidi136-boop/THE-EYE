import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateNotificationDto, DeliveryReceiptDto, RegisterPushTokenDto } from "./dto/notification.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions("incident:read")
  list(
    @Req() request: any,
    @Query("unreadOnly") unreadOnly?: string,
    @Query("category") category?: string,
    @Query("severity") severity?: string,
    @Query("includeExpired") includeExpired?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notificationsService.listForActor(request.user, {
      unreadOnly: unreadOnly === "true",
      category,
      severity,
      includeExpired: includeExpired === "true",
      cursor,
      limit,
    });
  }

  @Get("unread-count")
  @RequirePermissions("incident:read")
  unreadCount(@Req() request: any) {
    return this.notificationsService.countUnreadForActor(request.user).then((count) => ({ unreadCount: count }));
  }

  @Patch("read-all")
  @RequirePermissions("incident:read")
  markAllRead(@Req() request: any) {
    return this.notificationsService.markAllRead(request.user);
  }

  @Get(":id")
  @RequirePermissions("incident:read")
  getOne(@Param("id") id: string, @Req() request: any) {
    return this.notificationsService.getForActor(id, request.user);
  }

  @Post("send")
  @RequirePermissions("auth:admin")
  send(@Body() dto: CreateNotificationDto, @Req() request: any) {
    return this.notificationsService.create(dto, request.user);
  }

  @Post("push-tokens")
  @RequirePermissions("incident:read")
  registerPushToken(@Body() dto: RegisterPushTokenDto, @Req() request: any) {
    return this.notificationsService.registerPushToken(dto, request.user);
  }

  @Patch("push-tokens/deactivate")
  @RequirePermissions("incident:read")
  deactivatePushToken(@Body() dto: { token: string }, @Req() request: any) {
    return this.notificationsService.deactivatePushToken(dto.token, request.user);
  }

  @Patch(":id/read")
  @RequirePermissions("incident:read")
  markRead(@Param("id") id: string, @Req() request: any) {
    return this.notificationsService.markRead(id, request.user);
  }

  @Patch(":id/unread")
  @RequirePermissions("incident:read")
  markUnread(@Param("id") id: string, @Req() request: any) {
    return this.notificationsService.markUnread(id, request.user);
  }

  @Get(":id/delivery-logs")
  @RequirePermissions("incident:read")
  deliveryLogs(@Param("id") id: string, @Req() request: any) {
    return this.notificationsService.deliveryLogs(id, request.user);
  }

  @Post(":id/delivery-receipt")
  @RequirePermissions("auth:admin")
  deliveryReceipt(@Param("id") id: string, @Body() dto: DeliveryReceiptDto) {
    return this.notificationsService.recordDelivery(id, "push", "firebase-cloud-messaging", dto);
  }
}
