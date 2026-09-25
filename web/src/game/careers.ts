import type { Career } from './types'

export const CAREERS: Career[] = [
  {
    id: 'dev',
    name: '程序员',
    salary: 1.4,
    fixedExpense: 0.9,
    startingCash: 2.0,
    trait: 'investDiscount',
    traitLabel: '投资标的九折',
  },
  {
    id: 'sales',
    name: '销售',
    salary: 1.2,
    fixedExpense: 0.85,
    startingCash: 1.5,
    trait: 'networkBoost',
    traitLabel: '人脉事件加成',
  },
  {
    id: 'nurse',
    name: '护士',
    salary: 1.0,
    fixedExpense: 0.7,
    startingCash: 1.2,
    trait: 'expenseResist',
    traitLabel: '支出抗性',
  },
  {
    id: 'civil',
    name: '公务员',
    salary: 1.1,
    fixedExpense: 0.75,
    startingCash: 1.8,
    trait: 'expenseResist',
    traitLabel: '支出抗性',
  },
  {
    id: 'designer',
    name: '设计师',
    salary: 1.15,
    fixedExpense: 0.8,
    startingCash: 1.4,
    trait: 'romanceBoost',
    traitLabel: '恋爱好感更快',
  },
  {
    id: 'teacher',
    name: '教师',
    salary: 1.05,
    fixedExpense: 0.72,
    startingCash: 1.6,
    trait: 'networkBoost',
    traitLabel: '人脉事件加成',
  },
  {
    id: 'chef',
    name: '厨师',
    salary: 0.95,
    fixedExpense: 0.65,
    startingCash: 1.0,
    trait: 'romanceBoost',
    traitLabel: '恋爱好感更快',
  },
  {
    id: 'lawyer',
    name: '律师',
    salary: 1.6,
    fixedExpense: 1.1,
    startingCash: 2.5,
    trait: 'investDiscount',
    traitLabel: '投资标的九折',
  },
  {
    id: 'media',
    name: '自媒体',
    salary: 0.9,
    fixedExpense: 0.7,
    startingCash: 1.1,
    trait: 'networkBoost',
    traitLabel: '人脉事件加成',
  },
]

export function pickCareers(count: number, rng: () => number): Career[] {
  const pool = [...CAREERS]
  const result: Career[] = []
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length)
    result.push(pool.splice(idx, 1)[0])
  }
  return result
}
