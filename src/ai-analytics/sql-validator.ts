import { BadRequestException } from '@nestjs/common';
import {
  ANALYTICS_ALLOWED_VIEWS,
  AnalyticsAllowedView,
} from './analytics-schema';

interface Token {
  value: string;
  raw: string;
  type: 'identifier' | 'number' | 'punctuation' | 'operator';
}

export interface ValidatedAnalyticsSql {
  originalSql: string;
  executableSql: string;
  referencedViews: AnalyticsAllowedView[];
}

const allowedViews = new Set<string>(ANALYTICS_ALLOWED_VIEWS);

const sourceKeywords = new Set([
  'from',
  'join',
  'update',
  'into',
]);

const bannedKeywords = new Set([
  'alter',
  'analyze',
  'attach',
  'call',
  'comment',
  'commit',
  'copy',
  'create',
  'delete',
  'detach',
  'discard',
  'drop',
  'execute',
  'grant',
  'insert',
  'listen',
  'lock',
  'merge',
  'notify',
  'prepare',
  'reassign',
  'refresh',
  'reindex',
  'reset',
  'revoke',
  'rollback',
  'security',
  'set',
  'truncate',
  'unlisten',
  'update',
  'vacuum',
]);

const bannedIdentifiers = new Set([
  'dblink',
  'lo_export',
  'lo_import',
  'pg_advisory_lock',
  'pg_backend_pid',
  'pg_cancel_backend',
  'pg_create_restore_point',
  'pg_current_logfile',
  'pg_export_snapshot',
  'pg_logdir_ls',
  'pg_ls_dir',
  'pg_read_binary_file',
  'pg_read_file',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'pg_sleep',
  'pg_stat_file',
  'pg_terminate_backend',
]);

const bannedSchemas = new Set([
  'information_schema',
  'pg_catalog',
  'pg_toast',
  'public',
]);

export function validateAnalyticsSql(
  sql: string,
  options: { maxRows: number },
): ValidatedAnalyticsSql {
  const originalSql = sql.trim();
  if (!originalSql) {
    throw new BadRequestException('SQL is empty.');
  }

  const tokens = tokenizeSql(originalSql);
  if (!tokens.length) {
    throw new BadRequestException('SQL is empty.');
  }

  assertSingleStatement(tokens);

  const first = tokens[0]?.value;
  if (first !== 'select' && first !== 'with') {
    throw new BadRequestException('Only SELECT and WITH ... SELECT are allowed.');
  }

  for (const token of tokens) {
    if (token.type !== 'identifier') continue;
    if (bannedKeywords.has(token.value)) {
      throw new BadRequestException(`SQL keyword ${token.raw} is not allowed.`);
    }
    if (bannedIdentifiers.has(token.value)) {
      throw new BadRequestException(`Function or identifier ${token.raw} is not allowed.`);
    }
  }

  const cteNames = collectCteNames(tokens);
  const referencedViews = validateSources(tokens, cteNames);
  const cleanedSql = stripFinalSemicolon(originalSql);

  return {
    originalSql: cleanedSql,
    executableSql: `SELECT * FROM (${cleanedSql}) AS ai_safe_result LIMIT ${options.maxRows}`,
    referencedViews,
  };
}

function assertSingleStatement(tokens: Token[]) {
  const semicolonIndexes = tokens
    .map((token, index) => (token.value === ';' ? index : -1))
    .filter((index) => index >= 0);

  if (!semicolonIndexes.length) return;
  if (
    semicolonIndexes.length > 1 ||
    semicolonIndexes[0] !== tokens.length - 1
  ) {
    throw new BadRequestException('Only one SQL statement is allowed.');
  }
}

function validateSources(tokens: Token[], cteNames: Set<string>): AnalyticsAllowedView[] {
  const referenced = new Set<AnalyticsAllowedView>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (
      token.type === 'identifier' &&
      bannedSchemas.has(token.value) &&
      tokens[index + 1]?.value === '.'
    ) {
      throw new BadRequestException(`Schema ${token.raw} is not allowed.`);
    }

    if (!sourceKeywords.has(token.value)) continue;
    let sourceIndex = index + 1;

    while (
      ['lateral', 'only'].includes(tokens[sourceIndex]?.value) ||
      tokens[sourceIndex]?.value === '('
    ) {
      if (tokens[sourceIndex]?.value === '(') break;
      sourceIndex += 1;
    }

    const source = tokens[sourceIndex];
    if (!source) {
      throw new BadRequestException('SQL source is incomplete.');
    }

    if (source.value === '(') {
      continue;
    }

    if (source.type !== 'identifier') {
      throw new BadRequestException('SQL source must be an analytics view or CTE.');
    }

    const next = tokens[sourceIndex + 1];
    const afterDot = tokens[sourceIndex + 2];

    if (next?.value === '.') {
      if (source.value !== 'ai_analytics') {
        throw new BadRequestException('Only ai_analytics schema can be queried.');
      }
      if (!afterDot || afterDot.type !== 'identifier') {
        throw new BadRequestException('Analytics view name is missing.');
      }
      if (!allowedViews.has(afterDot.value)) {
        throw new BadRequestException(`Analytics view ${afterDot.raw} is not allowed.`);
      }
      referenced.add(afterDot.value as AnalyticsAllowedView);
      continue;
    }

    if (cteNames.has(source.value)) continue;

    throw new BadRequestException(
      `Use fully qualified analytics views like ai_analytics.${ANALYTICS_ALLOWED_VIEWS[0]}.`,
    );
  }

  return [...referenced];
}

function collectCteNames(tokens: Token[]) {
  const result = new Set<string>();
  if (tokens[0]?.value !== 'with') return result;

  let depth = 0;
  for (let index = 1; index < tokens.length - 2; index += 1) {
    const token = tokens[index];
    if (token.value === '(') depth += 1;
    if (token.value === ')') depth -= 1;

    if (
      depth === 0 &&
      token.type === 'identifier' &&
      tokens[index + 1]?.value === 'as' &&
      tokens[index + 2]?.value === '('
    ) {
      result.add(token.value);
    }
  }
  return result;
}

function stripFinalSemicolon(sql: string) {
  return sql.replace(/;\s*$/, '');
}

function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      index += 2;
      while (index < sql.length && sql[index] !== '\n') index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) {
        index += 1;
      }
      index += 2;
      continue;
    }

    if (char === "'") {
      index = skipSingleQuotedString(sql, index);
      continue;
    }

    if (char === '$') {
      const end = sql.slice(index + 1).search(/\$/);
      if (end >= 0) {
        const tag = sql.slice(index, index + end + 2);
        if (/^\$[A-Za-z_][A-Za-z0-9_]*?\$$|^\$\$$/.test(tag)) {
          const closeIndex = sql.indexOf(tag, index + tag.length);
          index = closeIndex >= 0 ? closeIndex + tag.length : sql.length;
          continue;
        }
      }
    }

    if (char === '"') {
      const start = index;
      index += 1;
      let raw = '';
      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          raw += '"';
          index += 2;
          continue;
        }
        if (sql[index] === '"') break;
        raw += sql[index];
        index += 1;
      }
      index += 1;
      tokens.push({
        value: raw.toLowerCase(),
        raw: sql.slice(start, index),
        type: 'identifier',
      });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index])) {
        index += 1;
      }
      const raw = sql.slice(start, index);
      tokens.push({ value: raw.toLowerCase(), raw, type: 'identifier' });
      continue;
    }

    if (/[0-9]/.test(char)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[0-9.]/.test(sql[index])) index += 1;
      tokens.push({ value: sql.slice(start, index), raw: sql.slice(start, index), type: 'number' });
      continue;
    }

    if (';(),.'.includes(char)) {
      tokens.push({ value: char, raw: char, type: 'punctuation' });
      index += 1;
      continue;
    }

    tokens.push({ value: char, raw: char, type: 'operator' });
    index += 1;
  }

  return tokens;
}

function skipSingleQuotedString(sql: string, start: number) {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === "'" && sql[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (sql[index] === "'") return index + 1;
    index += 1;
  }
  return sql.length;
}
