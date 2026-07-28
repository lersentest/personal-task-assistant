import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  MobileAuthService,
  MobileDeviceSessionContext,
} from '../../mobile-auth/mobile-auth.service';

export interface MobileAuthenticatedRequest {
  headers: { authorization?: string };
  mobile: MobileDeviceSessionContext;
}

@Injectable()
export class MobileDeviceAuthGuard implements CanActivate {
  constructor(private readonly mobileAuth: MobileAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MobileAuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Mobile Authorization header is required.');
    }
    request.mobile = await this.mobileAuth.verifyBearerToken(authorization);
    return true;
  }
}
