import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AttachmentsService } from '../attachments/attachments.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { AuthenticatedRequest } from './current-user';
import {
  createAttachmentSchema,
  listAttachmentsSchema,
  parseDto,
} from './dto';

@Controller('api/attachments')
@UseGuards(SupabaseAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const filters = parseDto(listAttachmentsSchema, query);
    return this.attachments.list(request.user.id, filters);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = parseDto(createAttachmentSchema, body);
    return this.attachments.create(request.user.id, request.user.id, input);
  }

  @Get(':id/download')
  @Header('Cache-Control', 'private, max-age=60')
  async download(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Res() response: {
      setHeader(name: string, value: string | number): void;
      send(body: Buffer): void;
    },
  ) {
    const attachment = await this.attachments.getDownload(request.user.id, id);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', attachment.sizeBytes);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    );
    response.send(Buffer.from(attachment.data));
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.attachments.softDelete(request.user.id, id);
    return { ok: true };
  }
}
