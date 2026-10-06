import { useMemo, useRef, useState } from 'react'
import { eligibleClubRelations, fighterStats } from '../../game/clubPk'
import {
  FREE_LIFE_PLACES,
  listFriendHomePins,
  monthLabel,
  placeLabel,
} from '../../game/freeLife'
import { STAGE_LABEL, stageFromAffinity } from '../../game/affinity'
import type { FreeLifeTile, GameAction, GameState } from '../../game/types'
import { FREE_LIFE_MAP_TILE_ART, FREE_LIFE_WORLD_ART, freePlaceArt } from '../art'
import {
  FREE_LIFE_MAP_TILES,
  WORLD_TILE_HOTSPOTS,
  hotspotsForTile,
  tileLabel,
} from '../freeLifeMapLayout'
import { MapPanViewport } from './MapPanViewport'
import { Portrait } from './Portrait'
import './FreeLifePanel.css'

type Props = {
  state: GameState
  dispatch: (a: GameAction) => void
}

type MapView = 'overview' | FreeLifeTile

export function FreeLifePanel({ state, dispatch }: Props) {
  const human = state.players.find((p) => p.isHuman) ?? state.players[0]
  const [team, setTeam] = useState<string[]>([])
  const [mapView, setMapView] = useState<MapView>('overview')
  const suppressWorldClick = useRef(false)
  const club = state.pendingClub
  const scene = state.pendingFreeScene?.scene

  const eligible = useMemo(() => eligibleClubRelations(human), [human])
  const friendPins = useMemo(() => listFriendHomePins(human), [human])
  const districtPins = useMemo(
    () => (mapView === 'overview' ? [] : hotspotsForTile(mapView)),
    [mapView],
  )

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
          <p className="muted">
            {scene.artKey === 'friendHome'
              ? `${scene.characterName ?? ''}的家`
              : placeLabel(scene.placeId)}
          </p>
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

  const statusLine = (
    <p className="muted">
      {state.age} 岁 · {monthLabel(state.monthIndex)} · 行动点 {human.actionPoints}
    </p>
  )

  const endMonthBtn = (
    <button
      className="primary"
      disabled={human.actionPoints > 0 && Boolean(state.pendingFreeScene || state.pendingClub)}
      onClick={() => dispatch({ type: 'FREE_CLOSE_MONTH' })}
    >
      {human.actionPoints > 0 ? '提前结束本月' : '进入下月'}
    </button>
  )

  if (mapView === 'overview') {
    return (
      <div className="free-life free-life-map">
        <div className="free-life-park-frame">
          <header className="free-life-head free-life-head-overlay">
            <div>
              {statusLine}
              <p className="free-life-pan-hint">拖动浏览 · 点选区域进入</p>
              {questHint ? <p className="free-life-quest">进行中：{questHint}</p> : null}
            </div>
            {endMonthBtn}
          </header>
          <MapPanViewport
            className="free-life-world-viewport"
            suppressClickRef={suppressWorldClick}
          >
            <img
              src={FREE_LIFE_WORLD_ART}
              alt="自由生活城市总览"
              className="free-life-world-img"
              draggable={false}
            />
            <div className="free-life-world-hotspots" role="navigation" aria-label="园区总览">
              {WORLD_TILE_HOTSPOTS.map((h) => {
                const meta = FREE_LIFE_MAP_TILES.find((t) => t.id === h.id)
                if (!meta) return null
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`free-life-world-hotspot free-life-world-hotspot-${h.id}`}
                    style={{
                      left: `${h.left}%`,
                      top: `${h.top}%`,
                      width: `${h.width}%`,
                      height: `${h.height}%`,
                    }}
                    aria-label={`进入${meta.name}区：${meta.blurb}`}
                    onClick={() => {
                      if (suppressWorldClick.current) return
                      setMapView(h.id)
                    }}
                  >
                    <span className="free-life-world-label">
                      <strong>{meta.name}</strong>
                      <em>{meta.blurb}</em>
                    </span>
                  </button>
                )
              })}
            </div>
          </MapPanViewport>
        </div>
      </div>
    )
  }

  return (
    <div className="free-life free-life-map">
      <div className="free-life-park-frame">
        <header className="free-life-head free-life-head-overlay">
          <div>
            <p className="muted">
              <button
                type="button"
                className="free-life-back"
                onClick={() => setMapView('overview')}
              >
                ← 返回地图
              </button>
              {' · '}
              {tileLabel(mapView)}区 · 行动点 {human.actionPoints}
            </p>
            {questHint ? <p className="free-life-quest">进行中：{questHint}</p> : null}
          </div>
          {endMonthBtn}
        </header>

        <div className="free-life-district">
          <div className="free-life-district-stage">
            <img
              src={FREE_LIFE_MAP_TILE_ART[mapView]}
              alt={`${tileLabel(mapView)}区地图`}
              className="free-life-district-img"
              draggable={false}
            />
            {districtPins.map((h) => {
              const place = FREE_LIFE_PLACES.find((p) => p.id === h.id)
              if (!place) return null
              return (
                <button
                  key={h.id}
                  type="button"
                  className="free-life-pin"
                  style={{ left: `${h.left}%`, top: `${h.top}%` }}
                  disabled={human.actionPoints <= 0}
                  aria-label={`前往${place.name}：${place.blurb}`}
                  title={place.blurb}
                  onClick={() => dispatch({ type: 'FREE_VISIT', placeId: h.id })}
                >
                  <span className="free-life-pin-dot" aria-hidden />
                  <span className="free-life-pin-name">{place.name}</span>
                </button>
              )
            })}
            {mapView === 'sw'
              ? friendPins.map((f) => (
                  <button
                    key={f.relationId}
                    type="button"
                    className="free-life-pin free-life-pin-friend"
                    style={{ left: `${f.left}%`, top: `${f.top}%` }}
                    disabled={human.actionPoints <= 0}
                    aria-label={`去${f.name}的家做客`}
                    title={`${f.name}的家`}
                    onClick={() =>
                      dispatch({ type: 'FREE_VISIT_FRIEND', relationId: f.relationId })
                    }
                  >
                    <span className="free-life-pin-dot" aria-hidden />
                    <span className="free-life-pin-name">{f.name}家</span>
                  </button>
                ))
              : null}
          </div>
        </div>
      </div>
    </div>
  )
}
