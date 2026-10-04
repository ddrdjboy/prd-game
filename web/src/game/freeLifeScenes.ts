import { applyAffinityDelta } from './affinity'
import { charactersAtPlace, clearQuest, upsertQuest } from './freeLife'
import { round2 } from './finance'
import { CHARACTERS, characterByName } from './portraits'
import { initialSkillsForName } from './relationsCatalog'
import type {
  FreeLifeChoiceEffect,
  FreeLifePlaceId,
  FreeLifeQuest,
  FreeLifeScene,
  FreeLifeSceneChoice,
  PlayerState,
  Relation,
} from './types'

function uid(prefix: string, rng: () => number): string {
  return `${prefix}-${Math.floor(rng() * 1e9)}`
}

function makeMeetRelation(name: string, portraitId: string | undefined, rng: () => number): Relation {
  const roll = rng()
  const affinity = roll < 0.3 ? 40 : roll < 0.8 ? 150 : 240
  return {
    id: uid('rel', rng),
    name,
    affinity,
    locked: false,
    skills: initialSkillsForName(name),
    training: null,
    portraitId,
  }
}

type SceneTemplate = {
  id: string
  placeId: FreeLifePlaceId
  title: string
  lines: string[]
  preferCharacter?: boolean
  questId?: string
  choices: {
    id: string
    label: string
    effects: FreeLifeChoiceEffect[]
  }[]
}

const TEMPLATES: SceneTemplate[] = [
  {
    id: 'home-bill',
    placeId: 'home',
    title: '家里的账单',
    lines: ['信箱里塞着一叠费用单。', '有些可以立刻付清，有些可以再拖一拖。'],
    choices: [
      { id: 'pay', label: '全部付清（−0.15 现金）', effects: [{ type: 'cash', amount: -0.15 }] },
      { id: 'skim', label: '只付紧急的（−0.05）', effects: [{ type: 'cash', amount: -0.05 }] },
      { id: 'ignore', label: '先放一放', effects: [] },
    ],
  },
  {
    id: 'home-guest',
    placeId: 'home',
    title: '门铃响了',
    lines: ['有人按门铃。打开门，是一位熟人站在玄关。'],
    preferCharacter: true,
    choices: [
      {
        id: 'invite',
        label: '请进坐坐（好感 +12）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 12 }],
      },
      {
        id: 'gift',
        label: '送点伴手礼（−0.08，好感 +18）',
        effects: [
          { type: 'cash', amount: -0.08 },
          { type: 'meet' },
          { type: 'affinity', amount: 18 },
        ],
      },
      { id: 'busy', label: '改天再聊', effects: [{ type: 'meet' }] },
    ],
  },
  {
    id: 'cafe-chat',
    placeId: 'cafe',
    title: '咖啡馆窗边',
    lines: ['座位不多，你和对方隔着一杯美式闲聊。'],
    preferCharacter: true,
    choices: [
      {
        id: 'listen',
        label: '认真听（好感 +10）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 10 }],
      },
      {
        id: 'treat',
        label: '请客（−0.06，好感 +16）',
        effects: [
          { type: 'cash', amount: -0.06 },
          { type: 'meet' },
          { type: 'affinity', amount: 16 },
        ],
      },
      {
        id: 'quest',
        label: '约下回还来（任务）',
        effects: [
          { type: 'meet' },
          {
            type: 'quest',
            quest: {
              id: 'cafe-return',
              placeId: 'cafe',
              label: '再来咖啡馆',
              characterName: '',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'cafe-return',
    placeId: 'cafe',
    title: '如约而至',
    lines: ['对方已经占好了位子，冲你招手。'],
    preferCharacter: true,
    questId: 'cafe-return',
    choices: [
      {
        id: 'done',
        label: '把话说开（好感 +22，+0.05 被动）',
        effects: [
          { type: 'affinity', amount: 22 },
          { type: 'passive', amount: 0.05 },
          { type: 'clearQuest', questId: 'cafe-return' },
        ],
      },
      {
        id: 'soft',
        label: '随便聊聊（好感 +10）',
        effects: [
          { type: 'affinity', amount: 10 },
          { type: 'clearQuest', questId: 'cafe-return' },
        ],
      },
    ],
  },
  {
    id: 'river-walk',
    placeId: 'riverside',
    title: '江风',
    lines: ['江面上泛着细碎的光。并肩走了一段。'],
    preferCharacter: true,
    choices: [
      {
        id: 'walk',
        label: '慢慢走（好感 +14）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 14 }],
      },
      {
        id: 'photo',
        label: '合影留念（好感 +8）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 8 }],
      },
      { id: 'alone', label: '独自吹风', effects: [] },
    ],
  },
  {
    id: 'gallery-show',
    placeId: 'gallery',
    title: '画廊开幕',
    lines: ['墙上是霓虹色块。有人请你品评一幅新作。'],
    preferCharacter: true,
    choices: [
      {
        id: 'buy',
        label: '买下小品（−0.25 现金，+0.3 资产）',
        effects: [
          { type: 'cash', amount: -0.25 },
          { type: 'asset', amount: 0.3, name: '画廊小品' },
          { type: 'meet' },
        ],
      },
      {
        id: 'praise',
        label: '真心夸赞（好感 +12）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 12 }],
      },
      { id: 'leave', label: '看完就走', effects: [] },
    ],
  },
  {
    id: 'market-stall',
    placeId: 'market',
    title: '市集摊位',
    lines: ['人声嘈杂。一个摊主压价推销库存。'],
    choices: [
      { id: 'flip', label: '吃进再转手（+0.12 现金）', effects: [{ type: 'cash', amount: 0.12 }] },
      { id: 'pass', label: '只看看', effects: [] },
      {
        id: 'help',
        label: '帮摊一天（+0.04 被动，−0.1 现金）',
        effects: [
          { type: 'cash', amount: -0.1 },
          { type: 'passive', amount: 0.04 },
        ],
      },
    ],
  },
  {
    id: 'office-deal',
    placeId: 'office',
    title: '旧事务所的方案',
    lines: ['桌上摊着一份入股合同。数字不大，但要立刻拍板。'],
    preferCharacter: true,
    choices: [
      {
        id: 'invest',
        label: '出 0.3 万入股（−现金，+0.08 被动）',
        effects: [
          { type: 'cash', amount: -0.3 },
          { type: 'passive', amount: 0.08 },
          { type: 'meet' },
          { type: 'affinity', amount: 10 },
        ],
      },
      {
        id: 'advice',
        label: '只给建议（好感 +6）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 6 }],
      },
      { id: 'no', label: '婉拒', effects: [{ type: 'meet' }] },
    ],
  },
  {
    id: 'office-river-quest',
    placeId: 'office',
    title: '托你一件事',
    lines: ['「下个月去江边找我，有东西给你看。」'],
    preferCharacter: true,
    choices: [
      {
        id: 'ok',
        label: '答应（任务：江边）',
        effects: [
          { type: 'meet' },
          {
            type: 'quest',
            quest: {
              id: 'river-meet',
              placeId: 'riverside',
              label: '去江边赴约',
              characterName: '',
            },
          },
        ],
      },
      { id: 'later', label: '看情况', effects: [{ type: 'meet' }] },
    ],
  },
  {
    id: 'river-meet',
    placeId: 'riverside',
    title: '江边的约定',
    lines: ['对方靠在栏杆上，递来一份薄薄的资料。'],
    preferCharacter: true,
    questId: 'river-meet',
    choices: [
      {
        id: 'take',
        label: '收下线索（+0.2 资产，好感 +20）',
        effects: [
          { type: 'asset', amount: 0.2, name: '江边线索' },
          { type: 'affinity', amount: 20 },
          { type: 'clearQuest', questId: 'river-meet' },
        ],
      },
      {
        id: 'share',
        label: '一起研究（+0.06 被动）',
        effects: [
          { type: 'passive', amount: 0.06 },
          { type: 'affinity', amount: 12 },
          { type: 'clearQuest', questId: 'river-meet' },
        ],
      },
    ],
  },
]

function pickCharacterForPlace(
  placeId: FreeLifePlaceId,
  player: PlayerState,
  questName: string | undefined,
  rng: () => number,
): { name: string; portraitId: string } | null {
  if (questName) {
    const ch = characterByName(questName)
    if (ch) return { name: ch.name, portraitId: ch.portraitId }
  }
  const at = charactersAtPlace(placeId, player)
  if (!at.length) {
    const any = CHARACTERS[Math.floor(rng() * CHARACTERS.length)]
    return { name: any.name, portraitId: any.portraitId }
  }
  const unmet = at.filter((c) => !c.met)
  const pool = unmet.length ? unmet : at
  return pool[Math.floor(rng() * pool.length)] ?? null
}

export function pickFreeLifeScene(
  placeId: FreeLifePlaceId,
  player: PlayerState,
  quests: FreeLifeQuest[],
  rng: () => number,
): FreeLifeScene {
  const quest = quests.find((q) => q.placeId === placeId)
  let pool = TEMPLATES.filter((t) => t.placeId === placeId)
  if (quest) {
    const qScenes = pool.filter((t) => t.questId === quest.id)
    pool = qScenes.length ? qScenes : pool.filter((t) => !t.questId)
  } else {
    pool = pool.filter((t) => !t.questId)
  }
  if (!pool.length) {
    pool = TEMPLATES.filter((t) => t.placeId === placeId && !t.questId)
  }
  const tmpl = pool[Math.floor(rng() * pool.length)] ?? TEMPLATES[0]

  let characterName: string | undefined
  let portraitId: string | undefined
  if (tmpl.preferCharacter) {
    const ch = pickCharacterForPlace(placeId, player, quest?.characterName || undefined, rng)
    if (ch) {
      characterName = ch.name
      portraitId = ch.portraitId
    }
  }

  const choices: FreeLifeSceneChoice[] = tmpl.choices.map((c) => ({
    ...c,
    effects: c.effects.map((e) => {
      if (e.type === 'quest') {
        return {
          ...e,
          quest: {
            ...e.quest,
            characterName: characterName ?? e.quest.characterName,
          },
        }
      }
      return e
    }),
  }))

  return {
    id: tmpl.id,
    placeId,
    title: tmpl.title,
    lines: tmpl.lines,
    characterName,
    portraitId,
    artKey: placeId,
    choices,
  }
}

export function applyFreeLifeChoice(
  player: PlayerState,
  scene: FreeLifeScene,
  choiceId: string,
  quests: FreeLifeQuest[],
  rng: () => number,
): {
  player: PlayerState
  quests: FreeLifeQuest[]
  logs: string[]
  metNew: Relation | null
} {
  const choice = scene.choices.find((c) => c.id === choiceId)
  if (!choice) return { player, quests, logs: [], metNew: null }

  let p: PlayerState = {
    ...player,
    relations: [...player.relations],
    investments: [...player.investments],
    maintainedRelationIds: [...(player.maintainedRelationIds ?? [])],
  }
  let flags = [...quests]
  const logs: string[] = []
  let metNew: Relation | null = null

  const ensureRelation = (): Relation | null => {
    if (!scene.characterName) return null
    const existing = p.relations.find((r) => r.name === scene.characterName)
    if (existing) return existing
    const rel = makeMeetRelation(scene.characterName, scene.portraitId, rng)
    p = { ...p, relations: [...p.relations, rel] }
    metNew = rel
    logs.push(`结识了「${rel.name}」`)
    return rel
  }

  for (const e of choice.effects) {
    switch (e.type) {
      case 'cash': {
        p = { ...p, cash: round2(Math.max(0, p.cash + e.amount)) }
        logs.push(`现金 ${e.amount >= 0 ? '+' : ''}${e.amount}`)
        break
      }
      case 'passive': {
        p = {
          ...p,
          investments: [
            ...p.investments,
            { id: uid('fl-cf', rng), name: '自由生活收益', cost: 0, cashflow: e.amount },
          ],
        }
        logs.push(`被动收入 ${e.amount >= 0 ? '+' : ''}${e.amount}/季`)
        break
      }
      case 'asset': {
        p = {
          ...p,
          investments: [
            ...p.investments,
            {
              id: uid('fl-asset', rng),
              name: e.name ?? '自由生活资产',
              cost: e.amount,
              cashflow: 0,
            },
          ],
        }
        logs.push(`资产 +${e.amount}`)
        break
      }
      case 'meet': {
        ensureRelation()
        break
      }
      case 'affinity': {
        const rel = ensureRelation()
        if (!rel) break
        p = {
          ...p,
          relations: p.relations.map((r) => {
            if (r.id !== rel.id && r.name !== scene.characterName) return r
            const { affinity } = applyAffinityDelta(r.affinity, e.amount)
            return { ...r, affinity }
          }),
          maintainedRelationIds: [...new Set([...(p.maintainedRelationIds ?? []), rel.id])],
        }
        logs.push(`好感 ${e.amount >= 0 ? '+' : ''}${e.amount}`)
        break
      }
      case 'quest': {
        flags = upsertQuest(flags, e.quest)
        logs.push(`接到：${e.quest.label}`)
        break
      }
      case 'clearQuest': {
        flags = clearQuest(flags, e.questId)
        break
      }
    }
  }

  return { player: p, quests: flags, logs, metNew }
}
