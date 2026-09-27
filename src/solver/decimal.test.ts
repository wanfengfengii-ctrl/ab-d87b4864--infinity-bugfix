import { describe, expect, it } from 'vitest';
import {
  DECIMAL_ZERO,
  decimalAdd,
  decimalCompare,
  decimalFromNumber,
  decimalFromText,
  decimalToDisplayString,
  decimalToNumber,
  decimalToScientificString,
  decimalToString,
} from './decimal';

const d = decimalFromNumber;
const t = decimalFromText;

describe('decimal · 精确十进制表示', () => {
  it('由录入值恢复十进制：0.1、1e-10、整数与科学计数法', () => {
    expect(decimalToString(d(0.1))).toBe('0.1');
    expect(decimalToString(d(0.3))).toBe('0.3');
    expect(decimalToString(d(1e-10))).toBe('0.0000000001');
    expect(decimalToString(d(4))).toBe('4');
    expect(decimalToString(d(0))).toBe('0');
    expect(decimalToString(d(1.5e-7))).toBe('0.00000015');
    expect(decimalToString(d(1e21))).toBe('1' + '0'.repeat(21));
    expect(decimalToString(d(0.1000000001))).toBe('0.1000000001');
  });

  it('非有限数值抛出错误', () => {
    expect(() => d(Number.NaN)).toThrow();
    expect(() => d(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('十进制加法精确：0.1 + 0.2 严格等于 0.3', () => {
    // 二进制浮点下并不相等，这正是十进制累计要消除的误差来源
    expect(0.1 + 0.2 === 0.3).toBe(false);
    const sum = decimalAdd(d(0.1), d(0.2));
    expect(decimalCompare(sum, d(0.3))).toBe(0);
    expect(decimalToString(sum)).toBe('0.3');
    expect(decimalToNumber(sum)).toBe(0.3);
  });

  it('加法与次序无关：同一组代价任意次序求和结果逐位相同', () => {
    const terms = [0.1, 0.2, 0.3, 1e-10, 4, 0.0000000001];
    const forward = terms.reduce((acc, x) => decimalAdd(acc, d(x)), DECIMAL_ZERO);
    const reverse = terms.reduceRight((acc, x) => decimalAdd(acc, d(x)), DECIMAL_ZERO);
    expect(decimalCompare(forward, reverse)).toBe(0);
    expect(decimalToString(forward)).toBe('4.6000000002');
  });

  it('比较保持极小十进制差额：1e-10 与 0 严格有序', () => {
    expect(decimalCompare(d(1e-10), DECIMAL_ZERO)).toBe(1);
    expect(decimalCompare(DECIMAL_ZERO, d(1e-10))).toBe(-1);
    expect(decimalCompare(d(0.3000000001), d(0.3))).toBe(1);
    expect(decimalCompare(d(0.3), d(0.3))).toBe(0);
    // 四个 1e-10 的精确和为 4e-10，仍严格大于 0
    const four = decimalAdd(decimalAdd(d(1e-10), d(1e-10)), decimalAdd(d(1e-10), d(1e-10)));
    expect(decimalCompare(four, DECIMAL_ZERO)).toBe(1);
    expect(decimalToNumber(four)).toBe(4e-10);
  });

  it('转回双精度正确舍入，展示值与录入值一致', () => {
    expect(decimalToNumber(decimalAdd(d(0.1), d(0.2)))).toBe(0.3);
    expect(decimalToNumber(d(0))).toBe(0);
    expect(decimalToString(decimalAdd(d(0.1), d(0.2)))).toBe('0.3');
  });
});

describe('decimal · 录入原文精确解析（decimalFromText）', () => {
  it('保留超出双精度精度的录入差异：0.10000000000000001 严格大于 0.1', () => {
    // 双精度下两者舍入为同一个数，差异只能凭录入原文保留
    expect(Number('0.10000000000000001')).toBe(0.1);
    expect(decimalCompare(t('0.10000000000000001'), t('0.1'))).toBe(1);
    expect(decimalCompare(t('0.1'), t('0.10000000000000001'))).toBe(-1);
    expect(decimalToString(t('0.10000000000000001'))).toBe('0.10000000000000001');
    // 转回双精度会再次舍入为 0.1，但精确比较已在 Decimal 层完成
    expect(decimalToNumber(t('0.10000000000000001'))).toBe(0.1);
  });

  it('与 decimalFromNumber 对常规录入一致，并支持 .5 / 5. / 指数 / 前导零 / 空白', () => {
    expect(decimalCompare(t('0.1'), d(0.1))).toBe(0);
    expect(decimalCompare(t('0.3000000001'), d(0.3000000001))).toBe(0);
    expect(decimalToString(t('.5'))).toBe('0.5');
    expect(decimalToString(t('5.'))).toBe('5');
    expect(decimalToString(t('1e3'))).toBe('1000');
    expect(decimalToString(t('+2E-2'))).toBe('0.02');
    expect(decimalToString(t('000.10'))).toBe('0.1');
    expect(decimalToString(t('  0.25  '))).toBe('0.25');
    expect(decimalToString(t('-0.5'))).toBe('-0.5');
    expect(decimalCompare(t('0'), DECIMAL_ZERO)).toBe(0);
  });

  it('非法文本抛出错误', () => {
    expect(() => t('')).toThrow();
    expect(() => t('abc')).toThrow();
    expect(() => t('1.2.3')).toThrow();
    expect(() => t('e5')).toThrow();
  });
});

describe('decimal · 超大有限值的精确累计与展示（不溢出为 Infinity）', () => {
  it('四个 1e308 的精确和为 4e308，转回双精度溢出但精确文本仍有限', () => {
    // 复现报告场景：每块录入 1e308（本身是有限双精度），四块之和 4e308
    // 已超出 Number.MAX_VALUE——旧实现经 Number() 转出 Infinity。
    expect(Number.isFinite(1e308)).toBe(true);
    expect(Number.isFinite(4e308 as unknown as number)).toBe(false); // 双精度下 4e308 即 Infinity
    const one = t('1e308');
    const sum = [one, one, one, one].reduce((acc, x) => decimalAdd(acc, x), DECIMAL_ZERO);
    expect(decimalCompare(sum, t('4e308'))).toBe(0);
    expect(decimalToNumber(sum)).toBe(Number.POSITIVE_INFINITY); // 双精度确实装不下
    // 精确层不受影响：比较仍严格有序
    expect(decimalCompare(sum, one)).toBe(1);
    expect(decimalCompare(t('3.9999e308'), sum)).toBe(-1);
    // 展示文本精确且有限
    expect(decimalToScientificString(sum)).toBe('4e308');
    expect(decimalToDisplayString(sum)).toBe('4e308');
    expect(decimalToDisplayString(sum)).not.toContain('Infinity');
  });

  it('科学计数法展示对各数量级与正负号正确', () => {
    expect(decimalToScientificString(t('4e308'))).toBe('4e308');
    expect(decimalToScientificString(t('1.23e308'))).toBe('1.23e308');
    expect(decimalToScientificString(t('-5e200'))).toBe('-5e200');
    expect(decimalToScientificString(t('1e-300'))).toBe('1e-300');
    expect(decimalToScientificString(t('6.022e23'))).toBe('6.022e23');
    expect(decimalToScientificString(t('0'))).toBe('0');
    // normalize 已去尾零：100 × 10^0 不展示成 100e0
    expect(decimalToScientificString(t('100'))).toBe('1e2');
  });

  it('display 在固定形式不过长时保持不带指数，过长时退回科学计数法', () => {
    expect(decimalToDisplayString(t('0.3'))).toBe('0.3');
    expect(decimalToDisplayString(t('8'))).toBe('8');
    expect(decimalToDisplayString(t('1e21'))).toBe('1' + '0'.repeat(21)); // 22 位，仍走固定形式
    expect(decimalToDisplayString(t('1e22'))).toBe('1' + '0'.repeat(22)); // 23 位，仍走固定形式
    expect(decimalToDisplayString(t('1e23'))).toBe('1' + '0'.repeat(23)); // 24 位（含边界），仍走固定形式
    expect(decimalToDisplayString(t('1e24'))).toBe('1e24'); // 25 位，退回科学计数法
    expect(decimalToDisplayString(t('1.5e-25'))).toBe('1.5e-25');
  });
});