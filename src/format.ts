import { decimalFromNumber, decimalFromText, decimalToDisplayString } from './solver/decimal';

/** 物理量展示：保留至多 3 位小数并去掉多余的 0；非有限值显示为缺失占位。 */
export function fmt(x: number): string {
  if (!Number.isFinite(x)) return '—';
  const v = Math.round(x * 1000) / 1000;
  return Object.is(v, -0) ? '0' : String(v);
}

/**
 * 安装代价展示：常规有限值与 {@link fmt} 完全一致（至多 3 位小数），
 * 小额安装代价的既有展示逐字不变。
 *
 * 但双精度下「值有限」不等于「×1000 后仍有限」：如 1e308 本身是可接受的
 * 有限录入，Math.round(1e308 * 1000) 却溢出为 Infinity，直接展示会变成
 * "Infinity"；多块大额代价的总和还可能直接越过 Number.MAX_VALUE（如
 * 4×1e308 = 4e308）。这两种情况都退回 Decimal 层逐位生成的精确有限文本
 * （优先录入原文），保证任何可接受的有限代价都不显示为 Infinity 或缺失值。
 */
export function fmtCost(x: number, exactText?: string): string {
  if (Number.isFinite(x)) {
    const v = Math.round(x * 1000) / 1000;
    if (Number.isFinite(v)) return Object.is(v, -0) ? '0' : String(v);
  }
  if (exactText !== undefined) {
    try {
      return decimalToDisplayString(decimalFromText(exactText));
    } catch {
      // 原文形态无法按十进制解析时落到下方 number 恢复
    }
  }
  if (Number.isFinite(x)) {
    try {
      return decimalToDisplayString(decimalFromNumber(x));
    } catch {
      // 两者都不可用才显示缺失
    }
  }
  return '—';
}
