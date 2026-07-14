import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TextCommandParserService } from './text-command-parser.service';

const parser = new TextCommandParserService();

test('parses direct project creation text', () => {
  assert.deepEqual(parser.parseDirectCommand('Проект: Villa Geneva'), {
    kind: 'PROJECT',
    name: 'Villa Geneva',
  });
});

test('parses task title and optional project', () => {
  assert.deepEqual(
    parser.parseDirectCommand('Задача: Проверить оплату | Dublin'),
    {
      kind: 'TASK',
      title: 'Проверить оплату',
      projectName: 'Dublin',
      originalText: 'Проверить оплату | Dublin',
    },
  );
});

test('returns null for text outside the stage-one syntax', () => {
  assert.equal(parser.parseDirectCommand('Что у меня сегодня?'), null);
});
