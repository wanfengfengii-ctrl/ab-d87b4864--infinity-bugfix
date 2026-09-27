import { describe, expect, it } from 'vitest';
import { fmt, fmtCost } from './format';

describe('fmt · 物理量展示', () => {
  it('小额数值保留至多 3 位小数', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(8)).toBe('8');
    expect(fmt(0.30000000000000004)).toBe('0.3');
    expect(fmt(-0)).toBe('0');
    expect(fmt(1 / 3)).toBe('0.333');
  });

  it('非有限值显示为缺失占位', () => {
    expect(fmt(Number.POSITIVE_INFINITY)).toBe('—');
    expect(fmt(Number.NaN)).toBe('—');
  });
});

describe('fmtCost · 安装代价展示', () => {
  it('小额安装代价的既有数值结果逐字不变', () => {
    expect(fmtCost(0)).toBe('0');
    expect(fmtCost(8)).toBe('8');
    expect(fmtCost(0.3)).toBe('0.3');
    expect(fmtCost(12)).toBe('12');
    expect(fmtCost(0.1 + 0.2)).toBe('0.3');
  });

  it('有限的大额录入（1e308）不得显示为 Infinity 或缺失值，按精确原文展示', () => {
    // 1e308 本身有限，但 ×1000 后溢出；没有原文时也应由 Decimal 层恢复
    expect(Number.isFinite(1e308)).toBe(true);
    expect(fmtCost(1e308, '1e308')).toBe('1e308');
    expect(fmtCost(1e308)).toBe('1e308');
  });

  it('超出双精度范围的总和（Infinity）以精确文本展示', () => {
    expect(fmtCost(Number.POSITIVE_INFINITY, '4e308')).toBe('4e308');
    expect(fmtCost(Number.POSITIVE_INFINITY, '4e308')).not.toContain('Infinity');
  });

  it('原文为超长固定形式时也紧凑展示', () => {
    expect(fmtCost(1e308, '1' + '0'.repeat(308))).toBe('1e308');
  });
});
