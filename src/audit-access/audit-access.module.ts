import { Module } from '@nestjs/common';
import { AuditAccessService } from './audit-access.service';

@Module({
  providers: [AuditAccessService],
  exports: [AuditAccessService],
})
export class AuditAccessModule {}
