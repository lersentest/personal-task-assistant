import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import type { NewsCategory, NewsSourceType } from '../generated/prisma/enums';

type SeedSource = {
  name: string;
  category: string;
  source_type: string;
  homepage_url: string;
  feed_or_profile_url?: string;
  language: string;
  country?: string;
  priority?: number;
  default_enabled?: boolean;
};

type FeedEntry = {
  title: string;
  url: string;
  publishedAt: Date | null;
  summary: string;
  externalId: string | null;
};

const DEFAULT_NEWS_LIMIT = 10;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stripHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function unescapeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function pickTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? unescapeXml(match[1]).trim() : '';
}

function pickAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? unescapeXml(match[1]).trim() : '';
}

function normalizeUrl(rawUrl: string, baseUrl?: string): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);
    url.hash = '';
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return (
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      host !== '0.0.0.0' &&
      !host.endsWith('.local') &&
      !/^10\./.test(host) &&
      !/^192\.168\./.test(host) &&
      !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFeed(xml: string, baseUrl: string): FeedEntry[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((match) => match[0]);

  return blocks
    .map((block) => {
      const title = stripHtml(pickTag(block, 'title'));
      const rssLink = pickTag(block, 'link');
      const atomLink = pickAttr(block, 'link', 'href');
      const url = normalizeUrl(rssLink || atomLink, baseUrl);
      const publishedAt = parseDate(
        pickTag(block, 'pubDate') ||
          pickTag(block, 'published') ||
          pickTag(block, 'updated'),
      );
      const summary = stripHtml(
        pickTag(block, 'description') ||
          pickTag(block, 'summary') ||
          pickTag(block, 'content:encoded') ||
          pickTag(block, 'content'),
      );
      const externalId = pickTag(block, 'guid') || pickTag(block, 'id') || null;
      if (!title || !url) return null;
      return { title, url, publishedAt, summary, externalId };
    })
    .filter((entry): entry is FeedEntry => Boolean(entry));
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async ensureSeedSources(): Promise<void> {
    const existing = await this.prisma.newsSource.count({
      where: { scope: 'SYSTEM' },
    });
    if (existing > 0) return;

    const seedPath = join(process.cwd(), 'prisma', 'seed-data', 'news_sources_seed.json');
    const sources = JSON.parse(await readFile(seedPath, 'utf8')) as SeedSource[];

    await this.prisma.newsSource.createMany({
      skipDuplicates: true,
      data: sources.map((source) => {
        const profileUrl = source.feed_or_profile_url?.trim() || '';
        const endpoint = profileUrl || source.homepage_url;
        const sourceType = source.source_type.toUpperCase() as NewsSourceType;
        const isSocial = sourceType === 'X' || sourceType === 'INSTAGRAM';
        return {
          scope: 'SYSTEM',
          endpointHash: sha256(`${sourceType}:${endpoint.toLowerCase()}`),
          name: source.name,
          sourceType,
          category: source.category as NewsCategory,
          homepageUrl: source.homepage_url,
          feedUrl: profileUrl || null,
          language: source.language,
          country: source.country || null,
          priority: source.priority ?? 3,
          enabled: Boolean(source.default_enabled) && !isSocial,
          status: isSocial ? 'REQUIRES_API' : 'WORKING',
          statusMessage: isSocial
            ? 'Источник отключён до подключения официального API.'
            : null,
        };
      }),
    });
  }

  async getToday(ownerId: string, date?: string) {
    await this.ensureSeedSources();
    const editionDate = this.dateOnly(date);
    const edition = await this.prisma.newsEdition.findFirst({
      where: { tenantId: ownerId, editionDate },
      orderBy: { version: 'desc' },
      include: {
        run: true,
        items: {
          orderBy: { rank: 'asc' },
          include: { item: true },
        },
      },
    });
    const activeRun = await this.prisma.newsRun.findFirst({
      where: { tenantId: ownerId, status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
    });
    const sourcesCount = await this.prisma.newsSource.count({
      where: { enabled: true, deletedAt: null },
    });
    return {
      date: editionDate.toISOString().slice(0, 10),
      status: edition?.status ?? 'QUEUED',
      lastUpdateAt: edition?.updatedAt ?? null,
      summary: edition?.summary ?? null,
      run: activeRun ?? edition?.run ?? null,
      sourcesCount,
      items:
        edition?.items.map(({ item, rank }) => ({
          id: item.id,
          rank,
          title: item.titleRu,
          originalTitle: item.titleOriginal,
          summary: item.summaryRu,
          keyFacts: item.keyFacts,
          category: item.category,
          tags: item.tags,
          sourceName: item.sourceName,
          url: item.canonicalUrl,
          publishedAt: item.publishedAt,
          language: item.language,
          relevanceScore: item.relevanceScore,
          qualityScore: item.qualityScore,
          summaryBasis: item.summaryBasis,
          warning: item.warning,
        })) ?? [],
    };
  }

  async listSources() {
    await this.ensureSeedSources();
    return this.prisma.newsSource.findMany({
      where: { deletedAt: null },
      orderBy: [{ enabled: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
    });
  }

  async updateSource(id: string, data: { enabled?: boolean; priority?: number }) {
    return this.prisma.newsSource.update({
      where: { id },
      data: {
        enabled: data.enabled,
        priority:
          typeof data.priority === 'number'
            ? Math.min(5, Math.max(1, Math.floor(data.priority)))
            : undefined,
        status: data.enabled === false ? 'DISABLED' : undefined,
      },
    });
  }

  async createSource(ownerId: string, data: {
    name: string;
    homepageUrl: string;
    feedUrl?: string;
    category: string;
    language?: string;
    country?: string;
    priority?: number;
  }) {
    const endpoint = data.feedUrl?.trim() || data.homepageUrl.trim();
    if (!isSafeHttpUrl(endpoint)) {
      throw new Error('Unsafe or invalid source URL.');
    }
    return this.prisma.newsSource.create({
      data: {
        scope: 'TENANT',
        tenantId: ownerId,
        endpointHash: sha256(`TENANT:${ownerId}:${endpoint.toLowerCase()}`),
        name: data.name.trim(),
        sourceType: data.feedUrl ? 'RSS' : 'WEB',
        category: data.category as NewsCategory,
        homepageUrl: data.homepageUrl.trim(),
        feedUrl: data.feedUrl?.trim() || null,
        language: data.language?.trim().toUpperCase() || 'EN',
        country: data.country?.trim().toUpperCase() || null,
        priority: Math.min(5, Math.max(1, Math.floor(data.priority ?? 3))),
      },
    });
  }

  async startManualRefresh(ownerId: string) {
    await this.ensureSeedSources();
    const activeRun = await this.prisma.newsRun.findFirst({
      where: { tenantId: ownerId, status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (activeRun) return activeRun;

    const cooldownMinutes = this.intConfig('NEWS_MANUAL_COOLDOWN_MINUTES', 10, 1, 120);
    const latestManual = await this.prisma.newsRun.findFirst({
      where: { tenantId: ownerId, runType: 'MANUAL' },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latestManual &&
      Date.now() - latestManual.createdAt.getTime() < cooldownMinutes * 60_000
    ) {
      return this.prisma.newsRun.create({
        data: {
          tenantId: ownerId,
          runType: 'MANUAL',
          status: 'COOLDOWN',
          message: `Повторное обновление доступно через ${cooldownMinutes} минут после прошлого запуска.`,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
    }

    const run = await this.prisma.newsRun.create({
      data: {
        tenantId: ownerId,
        runType: 'MANUAL',
        status: 'RUNNING',
        startedAt: new Date(),
        message: 'Обновление запущено.',
      },
    });
    void this.processRun(run.id).catch((error) => {
      this.logger.error(`News refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    return run;
  }

  async getRun(ownerId: string, id: string) {
    return this.prisma.newsRun.findFirst({ where: { id, tenantId: ownerId } });
  }

  async testSource(id: string) {
    const source = await this.prisma.newsSource.findUniqueOrThrow({ where: { id } });
    const result = await this.collectSource(source);
    return this.prisma.newsSource.update({
      where: { id },
      data: {
        status: result.entries.length > 0 ? 'WORKING' : result.status,
        statusMessage: result.message,
        feedUrl: result.feedUrl ?? source.feedUrl,
        lastAttemptAt: new Date(),
        lastSuccessAt: result.entries.length > 0 ? new Date() : source.lastSuccessAt,
        consecutiveErrors: result.entries.length > 0 ? 0 : { increment: 1 },
      },
    });
  }

  private async processRun(runId: string) {
    const run = await this.prisma.newsRun.findUniqueOrThrow({ where: { id: runId } });
    const maxSources = this.intConfig('NEWS_MAX_SOURCES_PER_RUN', 12, 1, 50);
    const sources = await this.prisma.newsSource.findMany({
      where: {
        enabled: true,
        deletedAt: null,
        sourceType: { in: ['RSS', 'WEB'] },
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      take: maxSources,
    });

    let itemsFound = 0;
    let itemsAdded = 0;

    for (const source of sources) {
      const result = await this.collectSource(source);
      await this.prisma.newsSource.update({
        where: { id: source.id },
        data: {
          status: result.entries.length > 0 ? 'WORKING' : result.status,
          statusMessage: result.message,
          feedUrl: result.feedUrl ?? source.feedUrl,
          lastAttemptAt: new Date(),
          lastSuccessAt: result.entries.length > 0 ? new Date() : source.lastSuccessAt,
          consecutiveErrors:
            result.entries.length > 0 ? 0 : { increment: 1 },
        },
      });

      for (const entry of result.entries) {
        itemsFound += 1;
        const normalizedUrlHash = sha256(entry.url.toLowerCase());
        const created = await this.prisma.newsItem.upsert({
          where: { normalizedUrlHash },
          update: {},
          create: {
            sourceId: source.id,
            normalizedUrlHash,
            externalId: entry.externalId,
            originalUrl: entry.url,
            canonicalUrl: entry.url,
            titleOriginal: entry.title,
            titleRu: entry.title,
            summaryRu: entry.summary || 'Краткое описание в источнике не найдено.',
            keyFacts: [],
            category: source.category,
            tags: [source.category.toLowerCase()],
            language: source.language,
            publishedAt: entry.publishedAt,
            sourceName: source.name,
            summaryBasis: 'EXCERPT',
            relevanceScore: Math.min(100, source.priority * 15 + (entry.publishedAt ? 20 : 0)),
            qualityScore: entry.summary ? 70 : 45,
            contentSufficient: Boolean(entry.summary),
            warning: entry.summary ? null : 'Есть только заголовок и ссылка на источник.',
          },
        });
        if (created.createdAt.getTime() > run.createdAt.getTime()) itemsAdded += 1;
      }
    }

    const items = await this.prisma.newsItem.findMany({
      orderBy: [{ publishedAt: 'desc' }, { relevanceScore: 'desc' }, { createdAt: 'desc' }],
      take: DEFAULT_NEWS_LIMIT,
    });
    const editionDate = this.dateOnly();
    const edition = await this.prisma.newsEdition.create({
      data: {
        tenantId: run.tenantId,
        editionDate,
        version:
          (await this.prisma.newsEdition.count({
            where: { tenantId: run.tenantId, editionDate },
          })) + 1,
        status: items.length > 0 ? 'SUCCESS' : 'PARTIAL',
        summary:
          items.length > 0
            ? `Собрано ${items.length} новостей из доступных RSS/WEB-источников.`
            : 'RSS-ленты пока не найдены. Проверь источники или добавь прямые RSS-ссылки.',
        lastRunId: run.id,
        items: {
          create: items.map((item, index) => ({
            itemId: item.id,
            rank: index + 1,
          })),
        },
      },
    });

    await this.prisma.newsRun.update({
      where: { id: runId },
      data: {
        status: items.length > 0 ? 'SUCCESS' : 'PARTIAL',
        finishedAt: new Date(),
        sourcesChecked: sources.length,
        itemsFound,
        itemsAdded,
        message: edition.summary,
      },
    });
  }

  private async collectSource(source: {
    homepageUrl: string;
    feedUrl: string | null;
    sourceType: string;
  }): Promise<{
    entries: FeedEntry[];
    feedUrl: string | null;
    status: 'DEGRADED' | 'UNSUPPORTED' | 'ERROR';
    message: string;
  }> {
    if (source.sourceType === 'X' || source.sourceType === 'INSTAGRAM') {
      return {
        entries: [],
        feedUrl: null,
        status: 'UNSUPPORTED',
        message: 'Соцсети отключены до подключения официального API.',
      };
    }

    const feedUrl = source.feedUrl || (await this.discoverFeed(source.homepageUrl));
    if (!feedUrl) {
      return {
        entries: [],
        feedUrl: null,
        status: 'UNSUPPORTED',
        message: 'RSS/Atom-лента не найдена автоматически.',
      };
    }

    try {
      const xml = await this.fetchText(feedUrl);
      return {
        entries: parseFeed(xml, feedUrl).slice(0, 12),
        feedUrl,
        status: 'DEGRADED',
        message: 'Лента прочитана.',
      };
    } catch (error) {
      return {
        entries: [],
        feedUrl,
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Не удалось прочитать источник.',
      };
    }
  }

  private async discoverFeed(homepageUrl: string): Promise<string | null> {
    if (!isSafeHttpUrl(homepageUrl)) return null;
    try {
      const html = await this.fetchText(homepageUrl);
      const link = html.match(
        /<link[^>]+(?:application\/(?:rss|atom)\+xml|rss\+xml|atom\+xml)[^>]+>/i,
      )?.[0];
      if (!link) return null;
      const href = pickAttr(link, 'link', 'href');
      return href ? normalizeUrl(href, homepageUrl) : null;
    } catch {
      return null;
    }
  }

  private async fetchText(url: string): Promise<string> {
    if (!isSafeHttpUrl(url)) throw new Error('Источник заблокирован защитой URL.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8',
          'user-agent': 'PersonalTaskAssistantNewsBot/0.1',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return text.slice(0, 2_000_000);
    } finally {
      clearTimeout(timer);
    }
  }

  private dateOnly(value?: string): Date {
    const source = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
    return new Date(`${source}T00:00:00.000Z`);
  }

  private intConfig(key: string, fallback: number, min: number, max: number) {
    const parsed = Number(this.configService.get<string>(key));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }
}
