import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: '#1c1714',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          color: '#f4efe4',
          fontSize: 21,
          fontFamily: 'serif',
          lineHeight: 1,
          marginTop: 1,
        }}
      >
        α
      </div>
    </div>,
    { width: 32, height: 32 }
  )
}
