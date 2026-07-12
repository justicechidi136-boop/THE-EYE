import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  url: string;
};

type HttpResponse = {
  status(code: number): { json(body: unknown): void };
};

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const request = ctx.getRequest<HttpRequest>();
    const requestId = String(request.headers["x-request-id"] ?? "unknown");
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : Array.isArray((body as { message?: unknown }).message)
            ? (body as { message: string[] }).message
            : (body as { message?: string }).message ?? exception.message;

      response.status(status).json({
        statusCode: status,
        message,
        error:
          typeof body === "object" && body !== null && "error" in body
            ? (body as { error?: string }).error
            : HttpStatus[status] ?? "Error",
        requestId,
        timestamp,
        path: request.url,
      });
      return;
    }

    const message = exception instanceof Error ? exception.message : "Unknown error";
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        path: request.url,
        message,
        timestamp,
      }),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      error: "Internal Server Error",
      requestId,
      timestamp,
      path: request.url,
    });
  }
}
