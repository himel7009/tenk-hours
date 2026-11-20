import { describe, expect, it } from 'vitest';
import { buildDebtBook, describeDue, summarizeDebt, type Debt, type DebtPayment } from './debts';
import { summarizeMoneyMonth, type MoneyEntry, type MoneySection } from './money';

const debt = (extra: Partial<Debt>): Debt => ({
  id: 'd1',
  direction: 'borrowed',
  person: 'Rahim',
  amount: 100000,
  day: '2026-11-10',
  dueDay: '2026-11-30',
  sectionId: null,
  inBudget: false,
  note: '',
  createdAt: 0,
  ...extra,
});
let n = 0;
const payment = (
  debtId: string,
  day: string,
  taka: number,
  sectionId: string | null = null,
): DebtPayment => ({
  id: `p${(n += 1)}`,
  debtId,
  day,
  amount: taka * 100,
  sectionId,
  note: '',
  createdAt: n,
});

describe('summarizeDebt', () => {
  it('adds up part payments and what is left', () => {
    const summary = summarizeDebt(
      debt({}),
      [
        payment('d1', '2026-11-12', 300),
        payment('d1', '2026-11-15', 200),
        payment('other', '2026-11-15', 50),
      ],
      '2026-11-20',
    );
    expect(summary).toMatchObject({ paid: 50000, left: 50000, status: 'open', daysToDue: 10 });
  });

  it('knows when a debt is due soon, overdue or settled', () => {
    expect(summarizeDebt(debt({ dueDay: '2026-11-22' }), [], '2026-11-20').status).toBe('due-soon');
    expect(summarizeDebt(debt({ dueDay: '2026-11-18' }), [], '2026-11-20')).toMatchObject({
      status: 'overdue',
      daysToDue: -2,
    });
    const settled = summarizeDebt(debt({}), [payment('d1', '2026-11-19', 1000)], '2026-11-20');
    expect(settled).toMatchObject({ status: 'settled', left: 0, settledOn: '2026-11-19' });
    expect(summarizeDebt(debt({ dueDay: null }), [], '2026-11-20').status).toBe('open');
  });

  it('describes the deadline', () => {
    expect(describeDue({ status: 'open', daysToDue: 0 })).toBe('Due today');
    expect(describeDue({ status: 'open', daysToDue: 3 })).toBe('Due in 3 days');
    expect(describeDue({ status: 'overdue', daysToDue: -1 })).toBe('1 day overdue');
    expect(describeDue({ status: 'open', daysToDue: null })).toBe('No deadline');
  });
});

describe('buildDebtBook', () => {
  it('splits what you owe from what you are owed, most urgent first', () => {
    const book = buildDebtBook(
      [
        debt({ id: 'a', dueDay: '2026-12-10' }),
        debt({ id: 'b', dueDay: '2026-11-19', amount: 50000 }),
        debt({ id: 'c', direction: 'lent', person: 'Karim', amount: 20000, dueDay: null }),
        debt({ id: 'd', amount: 10000 }),
      ],
      [payment('d', '2026-11-15', 100)],
      '2026-11-20',
    );
    expect(book.owe.map((s) => s.debt.id)).toEqual(['b', 'a']);
    expect(book.owed.map((s) => s.debt.id)).toEqual(['c']);
    expect(book.settled.map((s) => s.debt.id)).toEqual(['d']);
    expect(book.oweTotal).toBe(150000);
    expect(book.owedTotal).toBe(20000);
    expect(book.urgent.map((s) => s.debt.id)).toEqual(['b']);
  });
});

describe('debts in section balances', () => {
  const meal: MoneySection = {
    id: 'meal',
    name: 'Meal',
    icon: '🍚',
    color: 'moss',
    carryOver: false,
    createdAt: 0,
  };
  const pe: MoneySection = {
    id: 'pe',
    name: 'PE',
    icon: '👤',
    color: 'cobalt',
    carryOver: false,
    createdAt: 0,
  };
  const add: MoneyEntry = {
    id: 'e1',
    sectionId: 'meal',
    kind: 'add',
    toSectionId: null,
    day: '2026-11-01',
    amount: 200000,
    note: '',
    createdAt: 0,
  };

  it('leaves balances alone for debts kept as a record, payments included', () => {
    const debts = [
      debt({ id: 'b', sectionId: 'meal', amount: 100000, day: '2026-11-10' }),
      debt({ id: 'l', direction: 'lent', sectionId: 'pe', amount: 30000, day: '2026-11-12' }),
    ];
    const payments = [payment('b', '2026-11-18', 400, 'pe'), payment('l', '2026-11-19', 100, 'pe')];
    const month = summarizeMoneyMonth([meal, pe], [add], '2026-11', '2026-11-20', debts, payments);
    const [m, p] = month.sections;
    expect(m).toMatchObject({ budget: 200000, remaining: 200000 });
    expect(p).toMatchObject({ budget: 0, remaining: 0 });
    expect(m?.debt).toEqual({ borrowed: 0, repaid: 0, lent: 0, returned: 0 });
  });

  it('puts borrowed money into a section and takes repayments and lending out, none of it spending', () => {
    const debts = [
      debt({ id: 'b', sectionId: 'meal', amount: 100000, day: '2026-11-10', inBudget: true }),
      debt({
        id: 'l',
        direction: 'lent',
        sectionId: 'pe',
        amount: 30000,
        day: '2026-11-12',
        inBudget: true,
      }),
    ];
    const payments = [payment('b', '2026-11-18', 400, 'pe'), payment('l', '2026-11-19', 100, 'pe')];
    const month = summarizeMoneyMonth([meal, pe], [add], '2026-11', '2026-11-20', debts, payments);
    const [m, p] = month.sections;
    expect(m?.debt).toEqual({ borrowed: 100000, repaid: 0, lent: 0, returned: 0 });
    expect(m).toMatchObject({ budget: 300000, spent: 0, remaining: 300000 });
    expect(p?.debt).toEqual({ borrowed: 0, repaid: 40000, lent: 30000, returned: 10000 });
    expect(p).toMatchObject({ budget: -60000, spent: 0 });
    expect(month.spent).toBe(0);
  });

  it('carries debt flows over for a section that carries over', () => {
    const fund = { ...meal, id: 'fund', carryOver: true };
    const debts = [
      debt({ id: 'b', sectionId: 'fund', amount: 50000, day: '2026-10-05', inBudget: true }),
    ];
    const month = summarizeMoneyMonth([fund], [], '2026-11', '2026-11-20', debts, []);
    expect(month.sections[0]).toMatchObject({ opening: 50000, remaining: 50000 });
  });
});
