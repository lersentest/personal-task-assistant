import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  getRequestContext,
  getRequestTimings,
  runWithRequestContext,
} from './request-context';

interface HttpRequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: { id?: string };
}

interface HttpResponseLike {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
}

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();
    const requestId = this.extractRequestId(request) ?? randomUUID();
    const startedAt = performance.now();

    response.setHeader?.('X-Request-Id', requestId);

    return runWithRequestContext(
      {
        requestId,
        userId: request.user?.id,
        timings: [],
      },
      () =>
        next.handle().pipe(
          finalize(() => {
            const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
            const timings = getRequestTimings();
            const authMs = this.sumTiming(timings, 'auth');
            const dbMs = this.sumTiming(timings, 'db');
            const serializationMs = this.sumTiming(timings, 'serialization');
            const serviceMs = Math.max(
              0,
              Math.round((durationMs - authMs - dbMs - serializationMs) * 100) / 100,
            );
            response.setHeader?.(
              'Server-Timing',
              [
                `auth;dur=${authMs}`,
                `db;dur=${dbMs}`,
                `service;dur=${serviceMs}`,
                `serialization;dur=${serializationMs}`,
                `total;dur=${durationMs}`,
              ].join(', '),
            );

            const activeContext = getRequestContext();
            this.logger.log(
              JSON.stringify({
                type: 'api_request',
                method: request.method,
                path: request.originalUrl ?? request.url,
                statusCode: response.statusCode,
                durationMs,
                userId: activeContext?.userId,
                requestId,
                timestamp: new Date().toISOString(),
              }),
            );
          }),
        ),
    );
  }

  private extractRequestId(request: HttpRequestLike): string | undefined {
    const value = request.headers?.['x-request-id'];
    const requestId = Array.isArray(value) ? value[0] : value;
    return requestId?.slice(0, 128);
  }

  private sumTiming(
    timings: Array<{ name: string; durationMs: number }>,
    name: string,
  ): number {
    const total = timings
      .filter((timing) => timing.name === name)
      .reduce((sum, timing) => sum + timing.durationMs, 0);
    return Math.round(total * 100) / 100;
  }
}
