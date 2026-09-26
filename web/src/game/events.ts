import type { EventKind, PlayerState } from './types'

export type EventEffect =
  | { type: 'cash'; delta: number }
  | { type: 'salary'; delta: number }
  | { type: 'meet'; relationKind: 'network' | 'romance'; score?: number }
  | { type: 'boostRelation'; amount: number; kind?: 'network' | 'romance' }
  | { type: 'offerShop'; name: string; baseCashflow: number; cost: number; typeId?: string }
  | { type: 'offerInvest'; name: string; cost: number; cashflow: number; big?: boolean }
  | { type: 'marketBump'; factor: number }
  | { type: 'liability'; delta: number }
  | { type: 'poachAttempt' }
  | { type: 'marriagePrompt' }

export interface EventChoice {
  id: string
  label: string
  effects: EventEffect[]
}

export interface GameEvent {
  id: string
  kind: EventKind
  title: string
  text: string
  choices: EventChoice[]
}

function c(
  id: string,
  label: string,
  effects: EventEffect[],
): EventChoice {
  return { id, label, effects }
}

/** 选项所需现金（负现金与购买成本） */
export function choiceCashCost(effects: EventEffect[]): number {
  let cost = 0
  for (const e of effects) {
    if (e.type === 'cash' && e.delta < 0) cost += -e.delta
    if (e.type === 'offerShop') cost += e.cost
    if (e.type === 'offerInvest') cost += e.cost
  }
  return Math.round(cost * 100) / 100
}

export function canAffordChoice(cash: number, effects: EventEffect[]): boolean {
  return cash + 1e-9 >= choiceCashCost(effects)
}

/** AI / 自动季选策；若全部付不起则返回 `__skip__`（空手过关） */
export function pickEventChoice(
  event: GameEvent,
  player: Pick<PlayerState, 'cash' | 'aiStyle'>,
): string {
  const style = player.aiStyle ?? 'steady'
  const affordable = event.choices.filter((ch) => canAffordChoice(player.cash, ch.effects))
  if (!affordable.length) return '__skip__'

  const raise = affordable.find((x) => x.id === 'raise')
  const accept = affordable.find((x) => x.id === 'accept')
  const decline = affordable.find((x) => x.id === 'decline')

  if (style === 'aggressive') {
    if (raise) return raise.id
    if (accept) return accept.id
    return decline?.id ?? affordable[0].id
  }

  if (style === 'social') {
    if (event.kind === 'relation') {
      if (raise) return raise.id
      if (accept) return accept.id
    }
    if (accept) return accept.id
    if (decline) return decline.id
    return affordable[0].id
  }

  // steady
  if (accept) return accept.id
  if (decline) return decline.id
  return affordable[0].id
}


export const EVENTS: GameEvent[] = [
  // ——— 机会 ———
  {
    id: 'opp1',
    kind: 'opportunity',
    title: '路边摊意向',
    text: '朋友提议一起摆摊试水。',
    choices: [
      c('accept', '入伙开摊', [{ type: 'offerShop', name: '街头摊位', typeId: 'stall', baseCashflow: 0.25, cost: 0.8 }]),
      c('decline', '婉拒', []),
      c('raise', '加码装修摊位', [{ type: 'offerShop', name: '精装摊位', baseCashflow: 0.38, cost: 1.3 }]),
    ],
  },
  {
    id: 'opp2',
    kind: 'opportunity',
    title: '兼职咨询',
    text: '周末有人找你接小单。',
    choices: [
      c('accept', '接单', [{ type: 'cash', delta: 0.3 }]),
      c('decline', '休息', []),
      c('raise', '加急双倍干', [{ type: 'cash', delta: 0.5 }]),
    ],
  },
  {
    id: 'opp3',
    kind: 'opportunity',
    title: '指数定投',
    text: '有人安利你定投宽基。',
    choices: [
      c('accept', '开始定投', [{ type: 'offerInvest', name: '宽基定投', cost: 1.0, cashflow: 0.08 }]),
      c('decline', '再观望', []),
      c('raise', '加大定投', [{ type: 'offerInvest', name: '宽基加仓', cost: 1.6, cashflow: 0.13 }]),
    ],
  },
  {
    id: 'opp4',
    kind: 'opportunity',
    title: '二手电瓶车生意',
    text: '小区里有人转让小买卖份额。',
    choices: [
      c('accept', '接手份额', [{ type: 'offerInvest', name: '电瓶车份额', cost: 1.2, cashflow: 0.12 }]),
      c('decline', '不碰', []),
      c('raise', '多买一份', [{ type: 'offerInvest', name: '电瓶车加仓', cost: 1.9, cashflow: 0.19 }]),
    ],
  },
  {
    id: 'opp5',
    kind: 'opportunity',
    title: '咖啡馆合伙',
    text: '熟人想开咖啡馆找人搭一脚。',
    choices: [
      c('accept', '入股合伙', [{ type: 'offerShop', name: '角落咖啡馆', typeId: 'cafe', baseCashflow: 0.4, cost: 1.5 }]),
      c('decline', '只喝咖啡不投资', []),
      c('raise', '占更大股份', [{ type: 'offerShop', name: '主理咖啡馆', baseCashflow: 0.6, cost: 2.4 }]),
    ],
  },
  {
    id: 'opp6',
    kind: 'opportunity',
    title: '技能变现',
    text: '你可以把爱好做成付费课。',
    choices: [
      c('accept', '上架小课', [{ type: 'cash', delta: 0.5 }]),
      c('decline', '先不公开', []),
      c('raise', '砸广告推广', [{ type: 'cash', delta: 0.35 }, { type: 'boostRelation', amount: 4, kind: 'network' }]),
    ],
  },
  {
    id: 'opp7',
    kind: 'opportunity',
    title: '小额借贷机会',
    text: '银行推销信用贷扩盘。',
    choices: [
      c('accept', '贷一笔', [{ type: 'liability', delta: 1.0 }, { type: 'cash', delta: 1.0 }]),
      c('decline', '不借', []),
      c('raise', '贷多一点', [{ type: 'liability', delta: 1.6 }, { type: 'cash', delta: 1.6 }]),
    ],
  },
  {
    id: 'opp8',
    kind: 'opportunity',
    title: '便利店加盟',
    text: '连锁便利店开放加盟名额。',
    choices: [
      c('accept', '加盟', [{ type: 'offerShop', name: '便利店', typeId: 'convenience', baseCashflow: 0.55, cost: 2.2 }]),
      c('decline', '名额让出', []),
      c('raise', '开双班旗舰', [{ type: 'offerShop', name: '旗舰便利店', baseCashflow: 0.8, cost: 3.5 }]),
    ],
  },
  {
    id: 'opp9',
    kind: 'opportunity',
    title: '大额项目',
    text: '有人甩卖一套公寓份额。',
    choices: [
      c('accept', '买入份额', [
        { type: 'offerInvest', name: '公寓份额', cost: 3.5, cashflow: 0.35, big: true },
      ]),
      c('decline', '太大了不碰', []),
      c('raise', '拿更大份额', [
        { type: 'offerInvest', name: '公寓大份额', cost: 5.0, cashflow: 0.52, big: true },
      ]),
    ],
  },
  {
    id: 'opp10',
    kind: 'opportunity',
    title: '公司股权',
    text: '创业公司开放小额股权。',
    choices: [
      c('accept', '入股', [
        { type: 'offerInvest', name: '创业股权', cost: 4.0, cashflow: 0.45, big: true },
      ]),
      c('decline', '风险太大', []),
      c('raise', '多买一档', [
        { type: 'offerInvest', name: '创业股权加码', cost: 5.5, cashflow: 0.65, big: true },
      ]),
    ],
  },

  // ——— 市场 ———
  {
    id: 'mkt1',
    kind: 'market',
    title: '行情上扬',
    text: '你的投资组合小涨，要不要跟进？',
    choices: [
      c('accept', '落袋一部分', [{ type: 'cash', delta: 0.25 }, { type: 'marketBump', factor: 1.05 }]),
      c('decline', '继续持有', [{ type: 'marketBump', factor: 1.1 }]),
      c('raise', '追涨加仓', [{ type: 'offerInvest', name: '追涨仓', cost: 1.2, cashflow: 0.12 }]),
    ],
  },
  {
    id: 'mkt2',
    kind: 'market',
    title: '行情回调',
    text: '账户短暂缩水。',
    choices: [
      c('accept', '减仓止损', [{ type: 'cash', delta: 0.15 }, { type: 'marketBump', factor: 0.95 }]),
      c('decline', '死扛', [{ type: 'marketBump', factor: 0.9 }]),
      c('raise', '抄底加仓', [{ type: 'offerInvest', name: '抄底仓', cost: 1.0, cashflow: 0.11 }]),
    ],
  },
  {
    id: 'mkt3',
    kind: 'market',
    title: '出手窗口',
    text: '有人高价求购你的小份额。',
    choices: [
      c('accept', '卖掉', [{ type: 'cash', delta: 0.4 }]),
      c('decline', '不卖', []),
      c('raise', '再抬价谈', [{ type: 'cash', delta: 0.55 }]),
    ],
  },
  {
    id: 'mkt4',
    kind: 'market',
    title: '分红红利',
    text: '持仓派息到账。',
    choices: [
      c('accept', '落袋', [{ type: 'cash', delta: 0.2 }]),
      c('decline', '再投回去', [{ type: 'offerInvest', name: '股息再投', cost: 0.2, cashflow: 0.03 }]),
    ],
  },
  {
    id: 'mkt5',
    kind: 'market',
    title: '汇率波动',
    text: '跨境消费可能吃亏。',
    choices: [
      c('accept', '认栽换汇', [{ type: 'cash', delta: -0.15 }]),
      c('decline', '推迟消费', []),
    ],
  },
  {
    id: 'mkt6',
    kind: 'market',
    title: '行业风口',
    text: '你踩中了一波主题热。',
    choices: [
      c('accept', '兑现利润', [{ type: 'cash', delta: 0.35 }]),
      c('decline', '继续拿着', [{ type: 'marketBump', factor: 1.08 }]),
      c('raise', 'All-in 主题', [{ type: 'offerInvest', name: '主题仓', cost: 1.8, cashflow: 0.2 }]),
    ],
  },
  {
    id: 'mkt7',
    kind: 'market',
    title: '流动性紧张',
    text: '有人急着套现找你接盘。',
    choices: [
      c('accept', '接一笔', [{ type: 'offerInvest', name: '急售份额', cost: 1.5, cashflow: 0.18 }]),
      c('decline', '不接盘', []),
      c('raise', '大口吃进', [{ type: 'offerInvest', name: '急售大包', cost: 2.4, cashflow: 0.28 }]),
    ],
  },
  {
    id: 'mkt8',
    kind: 'market',
    title: '平静的一周',
    text: '市场波澜不惊。',
    choices: [
      c('accept', '收点小息', [{ type: 'cash', delta: 0.05 }]),
      c('decline', '什么都不做', []),
    ],
  },

  // ——— 消费 ———
  {
    id: 'dd1',
    kind: 'doodad',
    title: '新手机',
    text: '旧手机罢工，要不要换新？',
    choices: [
      c('accept', '换入门机', [{ type: 'cash', delta: -0.4 }]),
      c('decline', '先修一修', []),
      c('raise', '上旗舰', [{ type: 'cash', delta: -0.7 }, { type: 'boostRelation', amount: 3 }]),
    ],
  },
  {
    id: 'dd2',
    kind: 'doodad',
    title: '朋友婚礼',
    text: '随礼只能硬着头皮。',
    choices: [
      c('accept', '正常随礼', [{ type: 'cash', delta: -0.25 }, { type: 'boostRelation', amount: 5, kind: 'network' }]),
      c('decline', '象征性一点', [{ type: 'boostRelation', amount: -2, kind: 'network' }]),
      c('raise', '大气一笔', [{ type: 'cash', delta: -0.45 }, { type: 'boostRelation', amount: 10, kind: 'network' }]),
    ],
  },
  {
    id: 'dd3',
    kind: 'doodad',
    title: '冲动外卖月',
    text: '点外卖点到手软。',
    choices: [
      c('accept', '认账', [{ type: 'cash', delta: -0.12 }]),
      c('decline', '本周自己煮', []),
    ],
  },
  {
    id: 'dd4',
    kind: 'doodad',
    title: '健身年卡',
    text: '你说服自己这是投资身体。',
    choices: [
      c('accept', '办年卡', [{ type: 'cash', delta: -0.3 }]),
      c('decline', '改跑步', []),
      c('raise', '私教套餐', [{ type: 'cash', delta: -0.5 }, { type: 'boostRelation', amount: 4 }]),
    ],
  },
  {
    id: 'dd5',
    kind: 'doodad',
    title: '牙齿修理',
    text: '牙医账单不讲情面。',
    choices: [
      c('accept', '治完', [{ type: 'cash', delta: -0.35 }]),
      c('decline', '先止痛', []),
      c('raise', '全口护理', [{ type: 'cash', delta: -0.55 }]),
    ],
  },
  {
    id: 'dd6',
    kind: 'doodad',
    title: '短途旅行',
    text: '周末说走就走。',
    choices: [
      c('accept', '经济游', [
        { type: 'cash', delta: -0.28 },
        { type: 'boostRelation', amount: 5, kind: 'romance' },
      ]),
      c('decline', '宅家', []),
      c('raise', '升级度假', [
        { type: 'cash', delta: -0.5 },
        { type: 'boostRelation', amount: 12, kind: 'romance' },
      ]),
    ],
  },
  {
    id: 'dd7',
    kind: 'doodad',
    title: '订阅全家桶',
    text: '会员不知不觉续了一堆。',
    choices: [
      c('accept', '先付再说', [{ type: 'cash', delta: -0.1 }]),
      c('decline', '批量退订', [{ type: 'cash', delta: 0.05 }]),
    ],
  },
  {
    id: 'dd8',
    kind: 'doodad',
    title: '幸运红包',
    text: '群里抢到了大红包。',
    choices: [
      c('accept', '收下', [{ type: 'cash', delta: 0.15 }]),
      c('decline', '转赠群友', [{ type: 'boostRelation', amount: 6, kind: 'network' }]),
    ],
  },

  // ——— 关系 ———
  {
    id: 'rel1',
    kind: 'relation',
    title: '新同事',
    text: '茶水间认识了靠谱同事。',
    choices: [
      c('accept', '多聊几句', [{ type: 'meet', relationKind: 'network', score: 40 }]),
      c('decline', '点头走开', []),
      c('raise', '请喝咖啡深聊', [
        { type: 'cash', delta: -0.08 },
        { type: 'meet', relationKind: 'network', score: 55 },
      ]),
    ],
  },
  {
    id: 'rel2',
    kind: 'relation',
    title: '客户饭局',
    text: '一顿饭能拉近距离。',
    choices: [
      c('accept', '赴约', [
        { type: 'cash', delta: -0.15 },
        { type: 'meet', relationKind: 'network', score: 45 },
      ]),
      c('decline', '推掉', [{ type: 'boostRelation', amount: -2, kind: 'network' }]),
      c('raise', '做东加菜', [
        { type: 'cash', delta: -0.35 },
        { type: 'meet', relationKind: 'network', score: 60 },
      ]),
    ],
  },
  {
    id: 'rel3',
    kind: 'relation',
    title: '偶遇',
    text: '书店里对上了眼。',
    choices: [
      c('accept', '要联系方式', [{ type: 'meet', relationKind: 'romance', score: 35 }]),
      c('decline', '装作看书', []),
      c('raise', '请喝杯咖啡', [
        { type: 'cash', delta: -0.1 },
        { type: 'meet', relationKind: 'romance', score: 48 },
      ]),
    ],
  },
  {
    id: 'rel4',
    kind: 'relation',
    title: '朋友介绍',
    text: '朋友张罗着给你相亲。',
    choices: [
      c('accept', '见一面', [{ type: 'meet', relationKind: 'romance', score: 40 }]),
      c('decline', '下次再说', []),
      c('raise', '认真打扮赴约', [
        { type: 'cash', delta: -0.12 },
        { type: 'meet', relationKind: 'romance', score: 52 },
      ]),
    ],
  },
  {
    id: 'rel5',
    kind: 'relation',
    title: '深谈一夜',
    text: '关系有机会升温。',
    choices: [
      c('accept', '坦诚聊聊', [{ type: 'boostRelation', amount: 12 }]),
      c('decline', '改天', []),
      c('raise', '准备小礼物', [
        { type: 'cash', delta: -0.2 },
        { type: 'boostRelation', amount: 18 },
      ]),
    ],
  },
  {
    id: 'rel6',
    kind: 'relation',
    title: '小摩擦',
    text: '冷战了几天。',
    choices: [
      c('accept', '主动和解', [{ type: 'cash', delta: -0.1 }, { type: 'boostRelation', amount: 5 }]),
      c('decline', '继续冷战', [{ type: 'boostRelation', amount: -10 }]),
      c('raise', '好好道个歉', [
        { type: 'cash', delta: -0.25 },
        { type: 'boostRelation', amount: 12 },
      ]),
    ],
  },
  {
    id: 'rel7',
    kind: 'relation',
    title: '挖角风声',
    text: '有人试图撬走你身边的人。',
    choices: [
      c('accept', '花钱挽留', [
        { type: 'cash', delta: -0.25 },
        { type: 'boostRelation', amount: 8 },
      ]),
      c('decline', '放人走人', [{ type: 'boostRelation', amount: -18 }]),
      c('raise', '盛大挽留', [
        { type: 'cash', delta: -0.5 },
        { type: 'boostRelation', amount: 15 },
      ]),
    ],
  },
  {
    id: 'rel8',
    kind: 'relation',
    title: '求婚念头',
    text: '关系到了谈婚论嫁的时候。',
    choices: [
      c('accept', '求婚', [{ type: 'marriagePrompt' }]),
      c('decline', '再等等', [{ type: 'boostRelation', amount: -5, kind: 'romance' }]),
      c('raise', '盛大求婚', [
        { type: 'cash', delta: -0.8 },
        { type: 'boostRelation', amount: 10, kind: 'romance' },
        { type: 'marriagePrompt' },
      ]),
    ],
  },
  {
    id: 'rel9',
    kind: 'relation',
    title: '导师提携',
    text: '前辈愿意带你。',
    choices: [
      c('accept', '拜师', [{ type: 'meet', relationKind: 'network', score: 55 }]),
      c('decline', '保持距离', []),
      c('raise', '请吃饭深交', [
        { type: 'cash', delta: -0.2 },
        { type: 'meet', relationKind: 'network', score: 70 },
      ]),
    ],
  },
  {
    id: 'rel10',
    kind: 'relation',
    title: '周年纪念',
    text: '你们一起复盘这一年。',
    choices: [
      c('accept', '简单庆祝', [
        { type: 'cash', delta: -0.15 },
        { type: 'boostRelation', amount: 15, kind: 'romance' },
      ]),
      c('decline', '口头纪念', [{ type: 'boostRelation', amount: 3, kind: 'romance' }]),
      c('raise', '惊喜派对', [
        { type: 'cash', delta: -0.4 },
        { type: 'boostRelation', amount: 22, kind: 'romance' },
      ]),
    ],
  },

  // ——— 经营 ———
  {
    id: 'biz1',
    kind: 'business',
    title: '旺季',
    text: '店铺客流不错。',
    choices: [
      c('accept', '维持节奏', [{ type: 'cash', delta: 0.25 }]),
      c('decline', '提前收工', [{ type: 'cash', delta: 0.1 }]),
      c('raise', '加人手冲量', [
        { type: 'cash', delta: -0.2 },
        { type: 'cash', delta: 0.55 },
      ]),
    ],
  },
  {
    id: 'biz2',
    kind: 'business',
    title: '淡季',
    text: '得想想怎么过。',
    choices: [
      c('accept', '硬撑促销', [{ type: 'cash', delta: -0.15 }]),
      c('decline', '收缩开支', []),
      c('raise', '投广告翻盘', [
        { type: 'cash', delta: -0.4 },
        { type: 'cash', delta: 0.35 },
      ]),
    ],
  },
  {
    id: 'biz3',
    kind: 'business',
    title: '装修升级',
    text: '加投入可能换更高流水。',
    choices: [
      c('accept', '小改一波', [{ type: 'offerShop', name: '升级小店', baseCashflow: 0.35, cost: 1.2 }]),
      c('decline', '维持原样', []),
      c('raise', '大翻新', [{ type: 'offerShop', name: '精品店面', baseCashflow: 0.55, cost: 2.0 }]),
    ],
  },
  {
    id: 'biz4',
    kind: 'business',
    title: '口碑爆发',
    text: '回头客变多了。',
    choices: [
      c('accept', '乘势收钱', [{ type: 'cash', delta: 0.4 }]),
      c('decline', '低调经营', [{ type: 'cash', delta: 0.15 }]),
      c('raise', '扩品类', [{ type: 'offerShop', name: '扩店', baseCashflow: 0.3, cost: 1.0 }]),
    ],
  },
  {
    id: 'biz5',
    kind: 'business',
    title: '员工难寻',
    text: '经营者喊累，需要维护。',
    choices: [
      c('accept', '加薪抚慰', [
        { type: 'cash', delta: -0.2 },
        { type: 'boostRelation', amount: 8, kind: 'network' },
      ]),
      c('decline', '先拖着', [{ type: 'boostRelation', amount: -5, kind: 'network' }]),
      c('raise', '分红+聚餐', [
        { type: 'cash', delta: -0.4 },
        { type: 'boostRelation', amount: 14, kind: 'network' },
      ]),
    ],
  },
  {
    id: 'biz6',
    kind: 'business',
    title: '供应链优惠',
    text: '进货价谈下来了。',
    choices: [
      c('accept', '按量进货', [{ type: 'cash', delta: 0.2 }]),
      c('decline', '暂不囤货', []),
      c('raise', '大批囤货', [
        { type: 'cash', delta: -0.5 },
        { type: 'cash', delta: 0.85 },
      ]),
    ],
  },
  {
    id: 'biz7',
    kind: 'business',
    title: '卫生检查',
    text: '罚款虽小刺痛不小。',
    choices: [
      c('accept', '认罚整改', [{ type: 'cash', delta: -0.2 }]),
      c('decline', '讨价还价', []),
      c('raise', '一次到位改造', [{ type: 'cash', delta: -0.4 }, { type: 'boostRelation', amount: 3 }]),
    ],
  },
  {
    id: 'biz8',
    kind: 'business',
    title: '联名活动',
    text: '和友商互推一波。',
    choices: [
      c('accept', '参与联名', [
        { type: 'cash', delta: 0.3 },
        { type: 'boostRelation', amount: 8, kind: 'network' },
      ]),
      c('decline', '自己干', []),
      c('raise', '主赞助', [
        { type: 'cash', delta: -0.3 },
        { type: 'cash', delta: 0.55 },
        { type: 'boostRelation', amount: 12, kind: 'network' },
      ]),
    ],
  },

  // ——— 职场 ———
  {
    id: 'car1',
    kind: 'career',
    title: '加薪',
    text: '绩效过关，薪资可上调。',
    choices: [
      c('accept', '接受方案', [{ type: 'salary', delta: 0.15 }]),
      c('decline', '先不谈', []),
      c('raise', '谈判再加一点', [{ type: 'salary', delta: 0.22 }]),
    ],
  },
  {
    id: 'car2',
    kind: 'career',
    title: '裁员风声',
    text: '团队缩编，你惊出冷汗。',
    choices: [
      c('accept', '接受调岗降薪', [{ type: 'salary', delta: -0.1 }]),
      c('decline', '硬刚不接受', [{ type: 'salary', delta: -0.18 }, { type: 'cash', delta: 0.2 }]),
      c('raise', '主动找下家', [{ type: 'salary', delta: 0.05 }, { type: 'cash', delta: -0.15 }]),
    ],
  },
  {
    id: 'car3',
    kind: 'career',
    title: '跳槽机会',
    text: '猎头来电。',
    choices: [
      c('accept', '跳槽', [{ type: 'salary', delta: 0.2 }, { type: 'cash', delta: -0.2 }]),
      c('decline', '留任', []),
      c('raise', '谈更高 offer', [
        { type: 'salary', delta: 0.3 },
        { type: 'cash', delta: -0.35 },
      ]),
    ],
  },
  {
    id: 'car4',
    kind: 'career',
    title: '项目奖金',
    text: '加班可能换来奖金。',
    choices: [
      c('accept', '冲刺拿奖', [{ type: 'cash', delta: 0.45 }]),
      c('decline', '保命不加班', []),
      c('raise', '带队通宵', [{ type: 'cash', delta: 0.7 }, { type: 'boostRelation', amount: -3 }]),
    ],
  },
  {
    id: 'car5',
    kind: 'career',
    title: '培训补贴',
    text: '公司可报销一门课。',
    choices: [
      c('accept', '报名', [{ type: 'cash', delta: 0.1 }]),
      c('decline', '不学了', []),
      c('raise', '报高阶课', [{ type: 'cash', delta: -0.15 }, { type: 'salary', delta: 0.08 }]),
    ],
  },
  {
    id: 'car6',
    kind: 'career',
    title: '无薪任务',
    text: '义务劳动占掉周末。',
    choices: [
      c('accept', '硬着头皮去', [
        { type: 'cash', delta: -0.05 },
        { type: 'boostRelation', amount: 5, kind: 'network' },
      ]),
      c('decline', '婉拒', [{ type: 'boostRelation', amount: -4, kind: 'network' }]),
    ],
  },
  {
    id: 'car7',
    kind: 'career',
    title: '部门聚餐',
    text: '人脉温度可以上升。',
    choices: [
      c('accept', '参加', [
        { type: 'cash', delta: -0.1 },
        { type: 'boostRelation', amount: 8, kind: 'network' },
      ]),
      c('decline', '早退', []),
      c('raise', '多买几轮', [
        { type: 'cash', delta: -0.25 },
        { type: 'boostRelation', amount: 14, kind: 'network' },
      ]),
    ],
  },
  {
    id: 'car8',
    kind: 'career',
    title: '平稳季度',
    text: '工作波澜不惊。',
    choices: [
      c('accept', '摸鱼收息', [{ type: 'cash', delta: 0.05 }]),
      c('decline', '加班表现', [{ type: 'salary', delta: 0.05 }]),
    ],
  },

  // ——— 现金流（投资人圈） ———
  {
    id: 'cf1',
    kind: 'cashflowDay',
    title: '现金流日',
    text: '被动收入集中入账。',
    choices: [
      c('accept', '落袋为安', [{ type: 'cash', delta: 0.2 }]),
      c('decline', '先放着', [{ type: 'cash', delta: 0.1 }]),
      c('raise', '立刻再投', [{ type: 'offerInvest', name: '现金流再投', cost: 0.2, cashflow: 0.04 }]),
    ],
  },
  {
    id: 'cf2',
    kind: 'cashflowDay',
    title: '分红到账',
    text: '投资人圈的好处显现。',
    choices: [
      c('accept', '落袋', [{ type: 'cash', delta: 0.35 }]),
      c('decline', '部分再投', [{ type: 'offerInvest', name: '股息滚入', cost: 0.2, cashflow: 0.03 }]),
    ],
  },
  {
    id: 'cf3',
    kind: 'cashflowDay',
    title: '再投资冲动',
    text: '想把利润滚进去。',
    choices: [
      c('accept', '加仓', [
        { type: 'offerInvest', name: '加仓组合', cost: 2.0, cashflow: 0.22, big: true },
      ]),
      c('decline', '落袋休息', [{ type: 'cash', delta: 0.15 }]),
      c('raise', '大举加仓', [
        { type: 'offerInvest', name: '重仓组合', cost: 3.2, cashflow: 0.35, big: true },
      ]),
    ],
  },
  {
    id: 'cf4',
    kind: 'cashflowDay',
    title: '平稳收息',
    text: '一切按计划发生。',
    choices: [
      c('accept', '收息', [{ type: 'cash', delta: 0.15 }]),
      c('decline', '忽略提醒', []),
    ],
  },
  {
    id: 'cf5',
    kind: 'cashflowDay',
    title: '杠杆提醒',
    text: '利息咬了一口。',
    choices: [
      c('accept', '还一点', [{ type: 'cash', delta: -0.1 }, { type: 'liability', delta: -0.1 }]),
      c('decline', '先拖着', []),
      c('raise', '多还一截', [{ type: 'cash', delta: -0.3 }, { type: 'liability', delta: -0.3 }]),
    ],
  },
  {
    id: 'cf6',
    kind: 'cashflowDay',
    title: '资产盘点',
    text: '你更清楚自己的位置。',
    choices: [
      c('accept', '微调仓位', [{ type: 'cash', delta: 0.05 }]),
      c('decline', '维持现状', []),
    ],
  },
  {
    id: 'cf7',
    kind: 'cashflowDay',
    title: '合伙人提案',
    text: '更大生意找上门。',
    choices: [
      c('accept', '开品牌店', [{ type: 'offerShop', name: '品牌店', typeId: 'brand', baseCashflow: 0.7, cost: 3.0 }]),
      c('decline', '婉拒', []),
      c('raise', '双店计划', [{ type: 'offerShop', name: '双子品牌店', baseCashflow: 1.0, cost: 4.5 }]),
    ],
  },
  {
    id: 'cf8',
    kind: 'cashflowDay',
    title: '安心的一天',
    text: '账目漂亮。',
    choices: [
      c('accept', '庆祝一下', [{ type: 'cash', delta: 0.25 }]),
      c('decline', '继续抠门', [{ type: 'cash', delta: 0.1 }]),
    ],
  },

  // ——— 休息（含原叙事） ———
  {
    id: 'rest1',
    kind: 'rest',
    title: '睡到自然醒',
    text: '状态回升。',
    choices: [
      c('accept', '好好睡', [{ type: 'boostRelation', amount: 3 }]),
      c('decline', '起来加班', [{ type: 'cash', delta: 0.08 }]),
    ],
  },
  {
    id: 'rest2',
    kind: 'rest',
    title: '整理房间',
    text: '可能意外找到零钱。',
    choices: [
      c('accept', '认真收拾', [{ type: 'cash', delta: 0.05 }]),
      c('decline', '堆着不管', []),
    ],
  },
  {
    id: 'rest3',
    kind: 'rest',
    title: '散步思考',
    text: '想通了一个小决定。',
    choices: [
      c('accept', '享受散步', []),
      c('decline', '边走边回消息赚钱', [{ type: 'cash', delta: 0.08 }]),
    ],
  },
  {
    id: 'rest4',
    kind: 'rest',
    title: '老友叙旧',
    text: '人脉温度回升。',
    choices: [
      c('accept', '好好聊聊', [{ type: 'boostRelation', amount: 6, kind: 'network' }]),
      c('decline', '寒暄几句', [{ type: 'boostRelation', amount: 2, kind: 'network' }]),
      c('raise', '请顿饭', [
        { type: 'cash', delta: -0.15 },
        { type: 'boostRelation', amount: 12, kind: 'network' },
      ]),
    ],
  },
  {
    id: 'rest5',
    kind: 'rest',
    title: '宅家充电',
    text: '什么都可以不花。',
    choices: [
      c('accept', '彻底躺平', []),
      c('decline', '顺便兼职', [{ type: 'cash', delta: 0.1 }]),
    ],
  },
  {
    id: 'rest6',
    kind: 'rest',
    title: '读了本书',
    text: '心态更稳。',
    choices: [
      c('accept', '读完', [{ type: 'boostRelation', amount: 2 }]),
      c('decline', '刷短视频', []),
    ],
  },
  {
    id: 'rest7',
    kind: 'rest',
    title: '社区活动',
    text: '可能认识新面孔。',
    choices: [
      c('accept', '参加', [{ type: 'meet', relationKind: 'network', score: 30 }]),
      c('decline', '路过', []),
    ],
  },
  {
    id: 'rest8',
    kind: 'rest',
    title: '发呆有理',
    text: '休息也是生产力。',
    choices: [
      c('accept', '发呆', []),
      c('decline', '列待办清单', [{ type: 'cash', delta: 0.05 }]),
    ],
  },
  {
    id: 'nar1',
    kind: 'narrative',
    title: '远方想象',
    text: '你在阳台上看城市夜景。',
    choices: [
      c('accept', '沉浸一会儿', []),
      c('decline', '回去算账', [{ type: 'cash', delta: 0.05 }]),
    ],
  },
  {
    id: 'nar2',
    kind: 'narrative',
    title: '自由感',
    text: '某个月，你感觉离自由近了一点。',
    choices: [
      c('accept', '记下这一刻', [{ type: 'boostRelation', amount: 4 }]),
      c('decline', '别多想', []),
    ],
  },
  {
    id: 'nar3',
    kind: 'narrative',
    title: '对照表',
    text: '你把支出又划掉两行。',
    choices: [
      c('accept', '执行省钱', [{ type: 'cash', delta: 0.1 }]),
      c('decline', '允许自己花一点', []),
    ],
  },
  {
    id: 'nar4',
    kind: 'narrative',
    title: '朋友圈凡尔赛',
    text: '有人晒旅居，你选择？',
    choices: [
      c('accept', '继续攒', []),
      c('decline', '跟风旅居梦', [{ type: 'boostRelation', amount: 3 }]),
    ],
  },
  {
    id: 'nar5',
    kind: 'narrative',
    title: '深夜复盘',
    text: '被动收入曲线让你微笑。',
    choices: [
      c('accept', '开心收下', [{ type: 'cash', delta: 0.05 }]),
      c('decline', '关掉 App', []),
    ],
  },
  {
    id: 'nar6',
    kind: 'narrative',
    title: '给自己写信',
    text: '写给 45 岁的自己。',
    choices: [
      c('accept', '认真写', [{ type: 'boostRelation', amount: 5, kind: 'romance' }]),
      c('decline', '写不下去', []),
    ],
  },
  {
    id: 'nar7',
    kind: 'narrative',
    title: '城市漫步',
    text: '路过你想买的那家店。',
    choices: [
      c('accept', '心动入局', [{ type: 'offerShop', name: '梦想小店', baseCashflow: 0.45, cost: 1.8 }]),
      c('decline', '只是看看', []),
      c('raise', '直接谈转让', [
        { type: 'offerShop', name: '梦想主店', baseCashflow: 0.65, cost: 2.8 },
      ]),
    ],
  },
  {
    id: 'nar8',
    kind: 'narrative',
    title: '平静',
    text: '日子普通，也值得。',
    choices: [
      c('accept', '享受普通', []),
      c('decline', '找点刺激', [{ type: 'cash', delta: -0.08 }, { type: 'cash', delta: 0.12 }]),
    ],
  },
]

export function eventsForKind(kind: EventKind): GameEvent[] {
  if (kind === 'rest') {
    return EVENTS.filter((e) => e.kind === 'rest' || e.kind === 'narrative')
  }
  return EVENTS.filter((e) => e.kind === kind)
}

export function pickEvent(kind: EventKind, rng: () => number): GameEvent {
  const pool = eventsForKind(kind)
  const list = pool.length ? pool : eventsForKind('rest')
  return list[Math.floor(rng() * list.length)]
}

export function getEvent(id: string): GameEvent | undefined {
  return EVENTS.find((e) => e.id === id)
}
