import { applyAffinityDelta } from './affinity'
import { charactersAtPlace, clearQuest, placeLabel, placeVibe, upsertQuest } from './freeLife'
import { round2 } from './finance'
import { CHARACTERS, characterByName } from './portraits'
import { initialSkillsForName } from './relationsCatalog'
import type {
  FreeLifeChoiceEffect,
  FreeLifePlaceId,
  FreeLifeQuest,
  FreeLifeScene,
  FreeLifeSceneChoice,
  FreeLifeVibe,
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
  /** 精确地点（优先）；与 vibe 二选一 */
  placeId?: FreeLifePlaceId
  vibe?: FreeLifeVibe
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
    id: 'clinic-check',
    placeId: 'clinic',
    title: '社区诊所',
    lines: ['号没排多久。护士递来一张费用单。'],
    choices: [
      { id: 'full', label: '做个全套（−0.12）', effects: [{ type: 'cash', amount: -0.12 }] },
      { id: 'basic', label: '只做基础项（−0.04）', effects: [{ type: 'cash', amount: -0.04 }] },
      { id: 'skip', label: '改日再说', effects: [] },
    ],
  },
  {
    id: 'chat-window',
    vibe: 'chat',
    title: '随便聊聊',
    lines: ['气氛不紧不慢。对方似乎也有话想说。'],
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
        label: '约下回咖啡馆（任务）',
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
    id: 'chat-soft',
    vibe: 'chat',
    title: '轻声寒暄',
    lines: ['没有大事，只是把近况对了一下表。'],
    preferCharacter: true,
    choices: [
      {
        id: 'warm',
        label: '关心近况（好感 +8）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 8 }],
      },
      {
        id: 'tip',
        label: '打听消息（好感 +4）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 4 }],
      },
      { id: 'bye', label: '点头告别', effects: [{ type: 'meet' }] },
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
    id: 'date-walk',
    vibe: 'date',
    title: '并肩走走',
    lines: ['风不大。有人放慢脚步等你。'],
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
      { id: 'alone', label: '独自待会儿', effects: [] },
    ],
  },
  {
    id: 'date-treat',
    vibe: 'date',
    title: '气氛正好',
    lines: ['灯色偏暖。对方看向你，像在等一个邀请。'],
    preferCharacter: true,
    choices: [
      {
        id: 'pay',
        label: '请客（−0.1，好感 +18）',
        effects: [
          { type: 'cash', amount: -0.1 },
          { type: 'meet' },
          { type: 'affinity', amount: 18 },
        ],
      },
      {
        id: 'talk',
        label: '深聊一阵（好感 +12）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 12 }],
      },
      { id: 'early', label: '早点回去', effects: [{ type: 'meet' }] },
    ],
  },
  {
    id: 'creative-show',
    vibe: 'creative',
    title: '新作品',
    lines: ['有人请你看一眼刚完成的东西。'],
    preferCharacter: true,
    choices: [
      {
        id: 'buy',
        label: '买下小品（−0.25 现金，+0.3 资产）',
        effects: [
          { type: 'cash', amount: -0.25 },
          { type: 'asset', amount: 0.3, name: '创作小品' },
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
    id: 'creative-collab',
    vibe: 'creative',
    title: '临时搭把手',
    lines: ['工期紧。对方问你愿不愿意帮一点忙。'],
    preferCharacter: true,
    choices: [
      {
        id: 'help',
        label: '帮忙收尾（好感 +10，−0.05）',
        effects: [
          { type: 'cash', amount: -0.05 },
          { type: 'meet' },
          { type: 'affinity', amount: 10 },
        ],
      },
      {
        id: 'idea',
        label: '给个点子（好感 +7）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 7 }],
      },
      { id: 'no', label: '这次没空', effects: [{ type: 'meet' }] },
    ],
  },
  {
    id: 'market-stall',
    vibe: 'market',
    title: '摊位前',
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
    id: 'market-deal',
    vibe: 'market',
    title: '一口价',
    lines: ['对方报了个含糊的数字，等你点头。'],
    choices: [
      { id: 'take', label: '成交（−0.08，+0.15 资产）', effects: [{ type: 'cash', amount: -0.08 }, { type: 'asset', amount: 0.15, name: '市集货' }] },
      { id: 'haggle', label: '砍一半再买（−0.04，+0.08 资产）', effects: [{ type: 'cash', amount: -0.04 }, { type: 'asset', amount: 0.08, name: '市集货' }] },
      { id: 'walk', label: '算了', effects: [] },
    ],
  },
  {
    id: 'rest-breathe',
    vibe: 'rest',
    title: '缓一口气',
    lines: ['身体先放松下来。脑子也清了一点。'],
    preferCharacter: true,
    choices: [
      {
        id: 'with',
        label: '和熟人一起（好感 +9）',
        effects: [{ type: 'meet' }, { type: 'affinity', amount: 9 }],
      },
      { id: 'solo', label: '自己静一静', effects: [] },
      {
        id: 'spa-extra',
        label: '加个小项目（−0.07，好感 +6）',
        effects: [
          { type: 'cash', amount: -0.07 },
          { type: 'meet' },
          { type: 'affinity', amount: 6 },
        ],
      },
    ],
  },
  {
    id: 'rest-nap',
    vibe: 'rest',
    title: '偷得浮生',
    lines: ['没有任务。你可以什么都不做。'],
    choices: [
      { id: 'nap', label: '彻底放空', effects: [] },
      {
        id: 'snack',
        label: '买点补给（−0.03）',
        effects: [{ type: 'cash', amount: -0.03 }],
      },
    ],
  },
  {
    id: 'office-deal',
    vibe: 'office',
    title: '桌上的方案',
    lines: ['摊着一份数字不大的合同，要立刻拍板。'],
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
  {
    id: 'friend-home-tea',
    vibe: 'friendHome',
    title: '做客',
    lines: ['玄关放着两双拖鞋。屋里有茶的味道。'],
    preferCharacter: true,
    choices: [
      {
        id: 'chat',
        label: '坐下来聊（好感 +14）',
        effects: [{ type: 'affinity', amount: 14 }],
      },
      {
        id: 'gift',
        label: '带了点心（−0.05，好感 +20）',
        effects: [
          { type: 'cash', amount: -0.05 },
          { type: 'affinity', amount: 20 },
        ],
      },
      { id: 'short', label: '坐一会儿就走（好感 +6）', effects: [{ type: 'affinity', amount: 6 }] },
    ],
  },
  {
    id: 'friend-home-help',
    vibe: 'friendHome',
    title: '帮一点忙',
    lines: ['对方指了指角落里堆着的纸箱：「能搭把手吗？」'],
    preferCharacter: true,
    choices: [
      {
        id: 'help',
        label: '帮忙收拾（好感 +16）',
        effects: [{ type: 'affinity', amount: 16 }],
      },
      {
        id: 'order',
        label: '叫外卖一起吃（−0.08，好感 +18）',
        effects: [
          { type: 'cash', amount: -0.08 },
          { type: 'affinity', amount: 18 },
        ],
      },
      { id: 'rain', label: '改日再来', effects: [{ type: 'affinity', amount: 4 }] },
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

function templatesForPlace(placeId: FreeLifePlaceId): SceneTemplate[] {
  const vibe = placeVibe(placeId)
  const byPlace = TEMPLATES.filter((t) => t.placeId === placeId)
  const byVibe = TEMPLATES.filter((t) => t.vibe === vibe && !t.placeId)
  return [...byPlace, ...byVibe]
}

function materializeScene(
  tmpl: SceneTemplate,
  placeId: FreeLifePlaceId,
  player: PlayerState,
  quests: FreeLifeQuest[],
  rng: () => number,
  forced?: { name: string; portraitId?: string },
): FreeLifeScene {
  const quest = quests.find((q) => q.placeId === placeId)
  let characterName: string | undefined
  let portraitId: string | undefined
  if (forced) {
    characterName = forced.name
    portraitId = forced.portraitId
  } else if (tmpl.preferCharacter) {
    const ch = pickCharacterForPlace(placeId, player, quest?.characterName || undefined, rng)
    if (ch) {
      characterName = ch.name
      portraitId = ch.portraitId
    }
  }

  const placeName = placeLabel(placeId)
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
    title: tmpl.title.includes('{place}') ? tmpl.title.replace('{place}', placeName) : tmpl.title,
    lines: tmpl.lines.map((l) => l.replaceAll('{place}', placeName)),
    characterName,
    portraitId,
    artKey: placeId,
    choices,
  }
}

export function pickFreeLifeScene(
  placeId: FreeLifePlaceId,
  player: PlayerState,
  quests: FreeLifeQuest[],
  rng: () => number,
): FreeLifeScene {
  const quest = quests.find((q) => q.placeId === placeId)
  let pool = templatesForPlace(placeId)
  if (quest) {
    const qScenes = pool.filter((t) => t.questId === quest.id)
    pool = qScenes.length ? qScenes : pool.filter((t) => !t.questId)
  } else {
    pool = pool.filter((t) => !t.questId)
  }
  if (!pool.length) {
    pool = templatesForPlace(placeId).filter((t) => !t.questId)
  }
  const tmpl = pool[Math.floor(rng() * pool.length)] ?? TEMPLATES[0]
  return materializeScene(tmpl, placeId, player, quests, rng)
}

/** 去好友家做客：固定角色 + friendHome 池 */
export function pickFriendHomeScene(
  relation: Relation,
  player: PlayerState,
  rng: () => number,
): FreeLifeScene {
  const pool = TEMPLATES.filter((t) => t.vibe === 'friendHome' && !t.questId)
  const tmpl = pool[Math.floor(rng() * pool.length)] ?? pool[0]!
  const scene = materializeScene(
    tmpl,
    'home',
    player,
    [],
    rng,
    { name: relation.name, portraitId: relation.portraitId },
  )
  return {
    ...scene,
    title: `${relation.name}的家`,
    lines: [`你按响了门铃。${relation.name} 打开门，让你进去。`, ...scene.lines],
    artKey: 'friendHome',
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
