# AGENTS.md — 《45岁财富自由》

给 AI 与协作者的项目简报。**改代码或改需求前先读本文件。**

## 这是什么

网页双圈人生财务竞技：**18→45 岁**，四季推进；打工人圈经营关系/店铺抬被动收入，达标可晋级投资人圈；终局看财富自由 + 总资产 / 人脉 / 恋人三维。

- 推进：**777 拉霸**（不是掷骰）— 第 1 位步数，第 2 位事件大类，第 3 位抽牌  
- 地图格：**落点互动**（发薪/空地/商店/事务所/经营/公园/投资所/赌场），与事件类型解耦  
- 对战：单人 + AI 补位；中文 UI；MVP 本地 `localStorage`

## 文档怎么读（勿只啃旧 PRD 正文）

| 顺序 | 文件 | 用途 |
|------|------|------|
| 1 | 本文件 | 边界与改动地图 |
| 2 | `docs/superpowers/specs/2026-09-25-45岁财富自由-PRD.md` **§0** | v1.1 变更摘要、现行循环、子规格索引 |
| 3 | 任务相关子规格（下表） | 功能细节 |
| 4 | `web/src/game/*` + `web/tests/*` | 实现真相 |

**冲突规则：** 代码与更新后的子规格 > 主 PRD §0 > 主 PRD 旧正文（仍含 v1.0「掷骰」叙述，仅供溯源）。

| 你要改… | 先读 |
|---------|------|
| 事件选项 / 数值带 | `docs/superpowers/specs/2026-09-25-事件选择设计.md` + `events.ts` |
| 约会·交友 | `…约会功能设计.md` + `dating.ts` |
| 私人事务所 | `…私人事务所设计.md` + `office.ts` |
| 竖屏布局 | `…mobile-web适配设计.md` + `PlayScreen.css` 等 |
| AI / 文档约定本身 | `…2026-09-26-ai-harness-design.md` |

玩法行为变了 → 更新对应子规格，并在主 PRD §0 / §19 记一笔。不要在 `AGENTS.md` 复制大段数值。

## 目录地图

```
PRD/                          # 仓库根
  AGENTS.md                   # 本文件
  docs/superpowers/specs/     # PRD + 功能设计
  docs/superpowers/plans/     # 历史实现计划
  web/                        # Vite + React + TS 应用
    src/game/                 # 纯逻辑（无 DOM）
    src/ui/                   # 屏幕与组件
    src/persist.ts            # localStorage
    src/App.tsx               # 相位路由 + useReducer 外壳
    tests/                    # Vitest（逻辑单测）
```

## 模块边界（硬规则）

### 1. `web/src/game/` — 唯一规则引擎

| 文件 | 职责 |
|------|------|
| `types.ts` | 领域类型、`GameAction`、pending 状态 |
| `config.ts` | 年龄、格数、阈值等常量；`?fast=1` 缩短终局 |
| `reduce.ts` | **主状态机**：所有动作入口 |
| `createGame.ts` | 开局装配 |
| `board.ts` | 双圈格子定义与移动几何 |
| `slotEvents.ts` | 拉霸三位 → 事件/组合奖 |
| `events.ts` | 事件池与 choices 效果 |
| `finance.ts` | 财报、晋级/财富自由判定 |
| `dating.ts` / `office.ts` / `location.ts` / `relations.ts` / `ai.ts` | 约会、事务所、落点、关系衰减、AI 落点策 |
| `autoSeason.ts` | 自动推进与打断 |
| `scoring.ts` / `careers.ts` / `rng.ts` / `relationsCatalog.ts` | 结算、职业、随机、名册 |

**可以：** 纯函数改状态、写日志、改 pending。  
**禁止：** `document` / React / CSS；在 View 里复制结算公式。

### 2. `web/src/ui/` — 只负责呈现与派发动作

- `screens/`：Home / CareerPick / Play / Settlement  
- `components/`：Board、SlotMachine、FinancePanel、TopBar  

**可以：** 读 `GameState`、`dispatch(GameAction)`、动画定时器触发已有 action（如 `FINISH_SLOT`）。  
**禁止：** 直接改现金/关系/店铺；在组件内实现「选项效果」或挖角成功率。

### 3. `App.tsx` / `persist.ts`

- `App`：相位切换、存档、自动季循环调用 `runAutoUntilBreak`  
- 新全局副作用优先放这里或 `persist`，不要堆进 `PlayScreen`

### 4. 拉霸 vs 落点（易混）

- **事件** ← `ROLL_AND_MOVE` / `FINISH_SLOT` / `slotEvents` / `RESOLVE_EVENT_CHOICE`  
- **落点** ← `pendingLocation` + `LOCATION_*` / `OFFICE_*`  
- 不要把事件大类绑回 `SpaceKind`；二者已解耦。

## 常见改动该去哪

| 你想改… | 优先打开 |
|---------|----------|
| 新 `GameAction` / 回合流程 | `types.ts` → `reduce.ts` → 对应 test |
| 拉霸步数/大类映射/777 奖励 | `slotEvents.ts` + `slotEvents.test.ts` |
| 事件文案与选项效果 | `events.ts` + `eventChoices.test.ts` |
| 约会场所与好感 | `dating.ts` + `dating.test.ts` |
| 事务所费用与挖角率 | `office.ts` + `office.test.ts` |
| 棋盘格种类布局 | `board.ts` + `board.test.ts` |
| 财报公式 / 晋级 | `finance.ts` + `finance.test.ts` |
| 自动季打断条件 | `autoSeason.ts` + `autoSeason.test.ts` |
| 对局页按钮与弹层 | `PlayScreen.tsx`（只 dispatch） |
| 竖屏高度预算 | `PlayScreen.css` / `TopBar.css` 等 + mobile 规格 |
| 存档字段 | `persist.ts`（注意旧档兼容） |

## 绝对禁忌

- 按主 PRD 旧正文实现「掷骰 + 落格抽事件牌」——那是 v1.0，已被拉霸取代  
- 在 `ui/` 里写被动收入、挖角判定、事件 effect 结算  
- 把玩法逻辑继续堆进已经很大的 `PlayScreen`（能下沉的状态机步骤放 `reduce`）  
- 成人内容 / 露骨文案  
- 提交密钥或把隐私数据上传到服务端（MVP 仅本地）  
- 新建 `.cursor/rules/` 与本文双份漂移（约定只维护本文件）

## 自测

```bash
cd web && npm test && npm run build
cd web && npm run test:e2e   # Playwright 关键路径（自动起 Vite）
```

改规则必跑相关 `web/tests/*.test.ts`；改对局 UI 流程优先补/跑 `web/e2e/`。验收可用 `?fast=1` 缩短到约 21 岁终局。
