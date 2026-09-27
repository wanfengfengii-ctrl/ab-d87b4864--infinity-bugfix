import { describe, expect, it } from 'vitest';
import { adjudicate } from './solver/adjudicate';
import { parseDraft, type Draft } from './draft';

/** 两条零力臂导轨 + 四块单位质量配重的草稿，代价由参数给出（原文）。 */
function draftOf(b1Costs: [string, string]): Draft {
  const zero: [string, string] = ['0', '0'];
  return {
    rails: [
      { id: 'Z1', name: '#1', coordinate: '0' },
      { id: 'Z2', name: '#2', coordinate: '0' },
    ],
    blocks: [
      { id: 'b1', name: 'b1', mass: '1', options: [{ railId: 'Z1', cost: b1Costs[0] }, { railId: 'Z2', cost: b1Costs[1] }] },
      { id: 'b2', name: 'b2', mass: '1', options: [{ railId: 'Z1', cost: zero[0] }, { railId: 'Z2', cost: zero[1] }] },
      { id: 'b3', name: 'b3', mass: '1', options: [{ railId: 'Z1', cost: '0' }, { railId: 'Z2', cost: '0' }] },
      { id: 'b4', name: 'b4', mass: '1', options: [{ railId: 'Z1', cost: '0' }, { railId: 'Z2', cost: '0' }] },
    ],
    maxLoad: '4',
    minTorque: '-1',
    maxTorque: '1',
  };
}

describe('parseDraft × adjudicate · 录入代价原文贯通', () => {
  it('极细小十进制差异经真实录入链路保留：0.10000000000000001 vs 0.1 选更便宜的 #2', () => {
    // 两个录入值在 Number() 后舍入为同一个双精度数，差异只能靠草稿原文保留。
    const parsed = parseDraft(draftOf(['0.10000000000000001', '0.1']));
    expect('scenario' in parsed).toBe(true);
    if ('errors' in parsed) throw new Error(parsed.errors.join('; '));
    // 解析出的场景必须携带原文，且 number 视图确实已不可区分
    expect(parsed.scenario.blocks[0].options[0].costText).toBe('0.10000000000000001');
    expect(parsed.scenario.blocks[0].options[0].cost).toBe(0.1);

    const outcome = adjudicate(parsed.scenario);
    expect(outcome.feasible).toBe(true);
    if (!outcome.feasible) return;
    // 报告要求：返回 1,0,0,0，b1 选代价为 0.1 的位置 #2
    expect(outcome.plan.steps.map((s) => s.optionIndex)).toEqual([1, 0, 0, 0]);
    expect(outcome.plan.steps[0].railName).toBe('#2');
    expect(outcome.plan.totalCost).toBe(0.1);
  });

  it('代价完全相等时稳定决胜：两块都录 0.1 仍取字典序最小的 #1（0,0,0,0）', () => {
    const parsed = parseDraft(draftOf(['0.1', '0.1']));
    if ('errors' in parsed) throw new Error(parsed.errors.join('; '));
    const outcome = adjudicate(parsed.scenario);
    expect(outcome.feasible).toBe(true);
    if (!outcome.feasible) return;
    expect(outcome.plan.steps.map((s) => s.optionIndex)).toEqual([0, 0, 0, 0]);
    expect(outcome.plan.totalCost).toBe(0.1);
  });

  it('大额有限成本端到端：每个位置录入 1e308 仍可行，总代价为精确有限的 4e308', () => {
    // 报告场景（经真实草稿解析链路）：两条零力臂导轨、4 块单位质量配重，
    // 每个位置安装代价均录入有限十进制 1e308；载荷上限 4、力矩区间 [-1,1]。
    // 1e308 经 Number() 仍是有限值，validate 不应拒绝；4×1e308 超出双精度，
    // 裁决结果必须以精确文本 "4e308" 呈现，不能是 Infinity 或缺失。
    const draft: Draft = {
      rails: [
        { id: 'Z1', name: '#1', coordinate: '0' },
        { id: 'Z2', name: '#2', coordinate: '0' },
      ],
      blocks: [1, 2, 3, 4].map((k) => ({
        id: `b${k}`,
        name: `b${k}`,
        mass: '1',
        options: [
          { railId: 'Z1', cost: '1e308' },
          { railId: 'Z2', cost: '1e308' },
        ],
      })),
      maxLoad: '4',
      minTorque: '-1',
      maxTorque: '1',
    };
    const parsed = parseDraft(draft);
    expect('errors' in parsed).toBe(false);
    if ('errors' in parsed) throw new Error(parsed.errors.join('; '));
    // number 视图确实是有限值，因此录入校验链路本应接受
    expect(parsed.scenario.blocks[0].options[0].cost).toBe(1e308);
    expect(Number.isFinite(parsed.scenario.blocks[0].options[0].cost)).toBe(true);

    const outcome = adjudicate(parsed.scenario);
    expect(outcome.feasible).toBe(true);
    if (!outcome.feasible) return;
    const plan = outcome.plan;
    expect(plan.steps).toHaveLength(4);
    expect(new Set(plan.steps.map((s) => s.blockIndex))).toEqual(new Set([0, 1, 2, 3]));
    plan.steps.forEach((s) => {
      expect(s.cumulativeMass).toBeLessThanOrEqual(4);
      expect(s.cumulativeTorque).toBe(0);
    });
    expect(plan.finalMass).toBe(4);
    expect(plan.minTorqueMargin).toBe(1);
    // 双精度总和溢出（旧缺陷），精确文本保留
    expect(plan.totalCost).toBe(Number.POSITIVE_INFINITY);
    expect(plan.totalCostText).toBe('4e308');
    expect(plan.totalCostText).not.toContain('Infinity');
    // 真同代价的稳定决胜不变：全部取位置录入序号 #1
    expect(plan.steps.map((s) => s.optionIndex)).toEqual([0, 0, 0, 0]);
  });
});
