// YouTube 썸네일 (1280×720) — 강의 제목을 가장 크게

import { AbsoluteFill } from 'remotion'
import { usePretendard } from './fonts'
import { BrandMark } from './parts'
import type { ThumbnailProps } from './props'
import { COLOR, FONT } from './theme'

export function LectureThumbnail({ title, subtitle, label }: ThumbnailProps) {
  usePretendard()
  const len = Array.from(title).length
  const size = len <= 6 ? 190 : len <= 9 ? 150 : len <= 14 ? 118 : 96
  return (
    <AbsoluteFill style={{ background: COLOR.indigo, fontFamily: FONT.family, padding: '64px 80px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <BrandMark size={60} color="#FFFFFF" fg={COLOR.indigo} />
        <span style={{ fontSize: 44, fontWeight: 800, color: '#FFFFFF', letterSpacing: -0.5 }}>WeGoUp English</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: size, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: -4, wordBreak: 'keep-all' }}>{title}</div>
        <div style={{ width: 260, height: 18, background: COLOR.gold, borderRadius: 9, margin: '34px 0 26px' }} />
        {subtitle ? <div style={{ fontFamily: FONT.english, fontSize: 60, fontWeight: 700, color: COLOR.indigoSoft, letterSpacing: -1 }}>{subtitle}</div> : null}
      </div>
      <div style={{ alignSelf: 'flex-start', padding: '12px 30px', borderRadius: 999, background: COLOR.navyDeep, color: '#FFFFFF', fontSize: 40, fontWeight: 700 }}>
        {label || '중학 영문법'}
      </div>
    </AbsoluteFill>
  )
}
