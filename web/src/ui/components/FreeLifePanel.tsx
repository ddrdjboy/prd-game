import { useMemo, useState } from 'react'
import { eligibleClubRelations, fighterStats } from '../../game/clubPk'
import { FREE_LIFE_PLACES, monthLabel, placeLabel } from '../../game/freeLife'
import { STAGE_LABEL, stageFromAffinity } from '../../game/affinity'
import type { FreeLifePlaceId, GameAction, GameState } from '../../game/types'
import { freePlaceArt } from '../art'
import { Portrait } from './Portrait'
import './FreeLifePanel.css'

type Props = {
  state: GameState
  dispatch: (a: GameAction) => void
}

export function FreeLifePanel({ state, dispatch }: Props) {
  const human = state.players.find((p) => p.isHuman) ?? state.players[0]
  const [team, setTeam] = useState<string[]>([])
  const club = state.pendingClub
  const scene = state.pendingFreeScene?.scene

  const eligible = useMemo(() => eligibleClubRelations(human), [human])

  const toggle = (id: string) => {
    setTeam((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 6) return prev
      return [...prev, id]
    })
  }

  if (club?.step === 'pickTeam') {
    return (
      <div className="free-life free-life-club panel">
        <h2>会所 · 组队</h2>
        <p className="muted">最多 6 人。现金=血量，被动收入=攻击，资产=先手。</p>
        <div className="free-life-team">
          {eligible.map((r) => {
            const st = fighterStats(r.skills, r.affinity)
            const on = team.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                className={on ? 'picked' : ''}
                onClick={() => toggle(r.id)}
              >
                <Portrait name={r.name} portraitId={r.portraitId} size="sm" />
                <span>
                  <strong>{r.name}</strong>
                  <em>
                    {STAGE_LABEL[stageFromAffinity(r.affinity)]} · 血{st.hp} / 攻{st.atk} / 速
                    {st.spd}
                  </em>
                </span>
              </button>
            )
          })}
        </div>
        {!eligible.length && <p>还没有可出战的朋友（仇恨不可上场）。先去别处结识吧。</p>}
        <div className="free-life-actions">
          <button
            className="primary"
            disabled={!team.length}
            onClick={() => {
              dispatch({ type: 'CLUB_CONFIRM_TEAM', relationIds: team })
              setTeam([])
            }}
          >
            开战
          </button>
          <button
            onClick={() => {
              setTeam([])
              dispatch({ type: 'CLUB_CANCEL' })
            }}
          >
            离开
          </button>
        </div>
      </div>
    )
  }

  if (club?.step === 'battle') {
    const { result } = club
    return (
      <div className="free-life free-life-club panel">
        <h2>{result.winner === 'player' ? '会所胜利' : '会所落败'}</h2>
        <p className="muted">共 {result.rounds} 回合 · {result.log.length} 次出手</p>
        <ul className="free-life-battle-log">
          {result.log.slice(-12).map((h, i) => (
            <li key={`${h.actorId}-${i}`}>
              {h.actorName} → {h.targetName}：{h.damage}
              {h.crit ? '（暴击）' : ''}
              {h.ko ? ' · 倒下' : ''}
            </li>
          ))}
        </ul>
        <button className="primary" onClick={() => dispatch({ type: 'CLUB_FINISH_BATTLE' })}>
          结算
        </button>
      </div>
    )
  }

  if (club?.step === 'recruit') {
    return (
      <div className="free-life free-life-club panel">
        <h2>带走一位对方成员</h2>
        <div className="free-life-team">
          {club.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => dispatch({ type: 'CLUB_RECRUIT', fighterId: c.id })}
            >
              <Portrait name={c.name} portraitId={c.portraitId} size="sm" />
              <strong>{c.name}</strong>
            </button>
          ))}
        </div>
        <button onClick={() => dispatch({ type: 'CLUB_RECRUIT', fighterId: null })}>
          不要人，拿现金
        </button>
      </div>
    )
  }

  if (scene) {
    return (
      <div
        className="free-life free-life-scene"
        style={{ backgroundImage: `url(${freePlaceArt(scene.artKey)})` }}
      >
        <div className="free-life-scene-card panel">
          {scene.portraitId || scene.characterName ? (
            <Portrait
              name={scene.characterName ?? ''}
              portraitId={scene.portraitId}
              size="xl"
            />
          ) : null}
          <h2>{scene.title}</h2>
          <p className="muted">{placeLabel(scene.placeId)}</p>
          {scene.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="free-life-actions col">
            {scene.choices.map((c) => (
              <button
                key={c.id}
                className="primary"
                onClick={() => dispatch({ type: 'FREE_SCENE_CHOICE', choiceId: c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const questHint = (state.questFlags ?? [])
    .map((q) => q.label)
    .join(' · ')

  return (
    <div className="free-life free-life-map panel">
      <header className="free-life-head">
        <div>
          <h2>自由生活</h2>
          <p className="muted">
            {state.age} 岁 · {monthLabel(state.monthIndex)} · 行动点 {human.actionPoints}
          </p>
        </div>
        <button
          className="primary"
          disabled={human.actionPoints > 0 && Boolean(state.pendingFreeScene || state.pendingClub)}
          onClick={() => dispatch({ type: 'FREE_CLOSE_MONTH' })}
        >
          {human.actionPoints > 0 ? '提前结束本月' : '进入下月'}
        </button>
      </header>
      {questHint ? <p className="free-life-quest">进行中：{questHint}</p> : null}
      <div className="free-life-places">
        {FREE_LIFE_PLACES.map((p) => (
          <button
            key={p.id}
            type="button"
            className="free-life-place"
            style={{ backgroundImage: `url(${freePlaceArt(p.id)})` }}
            disabled={human.actionPoints <= 0}
            onClick={() => dispatch({ type: 'FREE_VISIT', placeId: p.id as FreeLifePlaceId })}
          >
            <span>
              <strong>{p.name}</strong>
              <em>{p.blurb}</em>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
