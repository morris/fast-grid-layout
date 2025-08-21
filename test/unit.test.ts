import { expect, test } from '@playwright/test';
import { GridLayout, GridLayoutItem } from '../src/fast-grid-layout.js';

test.describe('GridLayout.moveItems', () => {
  test('(1)', async () => {
    // given
    const input: GridLayoutItem[] = [
      { i: '0', x: 0, y: 0, w: 2, h: 1 },
      { i: '1', x: 2, y: 0, w: 1, h: 1 },
      { i: '2', x: 3, y: 0, w: 1, h: 1 },
    ];

    // when
    const output = GridLayout.moveItems(input, {}, new Set(['0']), 2, 0);

    // then
    expect(output.sort((a, b) => (a.i < b.i ? -1 : a.i > b.i ? 1 : 0))).toEqual(
      [
        { i: '0', x: 2, y: 0, w: 2, h: 1 },
        { i: '1', x: 2, y: 1, w: 1, h: 1 },
        { i: '2', x: 3, y: 1, w: 1, h: 1 },
      ],
    );
  });
});

test.describe('GridLayout.resizeItems', () => {
  test('(1)', async () => {
    // given
    const input: GridLayoutItem[] = [
      { i: '0', x: 0, y: 0, w: 2, h: 1 },
      { i: '1', x: 2, y: 0, w: 1, h: 1 },
      { i: '2', x: 3, y: 0, w: 1, h: 1 },
    ];

    // when
    const output = GridLayout.resizeItem(input, {}, '0', 'e', 2, 0);

    // then
    expect(output.sort((a, b) => (a.i < b.i ? -1 : a.i > b.i ? 1 : 0))).toEqual(
      [
        { i: '0', x: 0, y: 0, w: 4, h: 1 },
        { i: '1', x: 2, y: 1, w: 1, h: 1 },
        { i: '2', x: 3, y: 1, w: 1, h: 1 },
      ],
    );
  });
});
