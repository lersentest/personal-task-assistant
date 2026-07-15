import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { AttachmentsService } from '../attachments/attachments.service';
import { DelegatedTasksService } from '../delegated-tasks/delegated-tasks.service';
import {
  createAttachmentSchema,
  delegatedCommentSchema,
  parseDto,
  publicDelegatedActionSchema,
} from './dto';
import { jsonSafe } from './json-safe';

@Controller('api/public/delegated-tasks')
export class PublicDelegatedTasksController {
  constructor(
    private readonly delegatedTasks: DelegatedTasksService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get(':token')
  async get(@Param('token') token: string) {
    return jsonSafe(await this.delegatedTasks.getByPublicToken(token));
  }

  @Post(':token/actions')
  async action(@Param('token') token: string, @Body() body: unknown) {
    const input = parseDto(publicDelegatedActionSchema, body);
    return jsonSafe(
      await this.delegatedTasks.publicExecutorTransition(
        token,
        input.action,
        input.message,
      ),
    );
  }

  @Post(':token/comments')
  async comment(@Param('token') token: string, @Body() body: unknown) {
    const input = parseDto(delegatedCommentSchema, body);
    return jsonSafe(
      await this.delegatedTasks.publicExecutorComment(token, input.message),
    );
  }

  @Post(':token/attachments')
  async upload(@Param('token') token: string, @Body() body: unknown) {
    const input = parseDto(createAttachmentSchema, body);
    return jsonSafe(
      await this.attachments.createForDelegatedExecutor(token, {
        fileName: input.fileName,
        mimeType: input.mimeType,
        dataBase64: input.dataBase64,
      }),
    );
  }

  @Get(':token/attachments/:id/download')
  @Header('Cache-Control', 'private, max-age=60')
  async download(
    @Param('token') token: string,
    @Param('id') id: string,
    @Res() response: {
      setHeader(name: string, value: string | number): void;
      send(body: Buffer): void;
    },
  ) {
    const attachment = await this.attachments.getPublicDelegatedDownload(
      token,
      id,
    );
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', attachment.sizeBytes);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    );
    response.send(Buffer.from(attachment.data));
  }
}
