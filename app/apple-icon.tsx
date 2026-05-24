import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: '#1c1714',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      {/* α symbol */}
      <div
        style={{
          color: '#f4efe4',
          fontSize: 108,
          fontFamily: 'serif',
          lineHeight: 1,
          marginTop: 8,
        }}
      >
        α
      </div>
      {/* subtle wordmark underneath */}
      <div
        style={{
          color: '#7a6f62',
          fontSize: 18,
          fontFamily: 'sans-serif',
          letterSpacing: 4,
          marginTop: -4,
          textTransform: 'uppercase',
        }}
      >
        alphalpha
      </div>
    </div>,
    { width: 180, height: 180 }
  )
}
