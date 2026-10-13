import { reelPose } from './menuReel'

export type ReelSide = 'text' | 'media'
export function counterReelPose(
  index: number,
  progress: number,
  count: number,
  side: ReelSide,
) {
  const pose = reelPose(index, progress, count)
  const sign = side === 'media' ? -1 : 1
  return { y: pose.y * sign, z: pose.z * 0.55, pitch: -pose.angle * sign }
}
export function pairedReelLayout(width: number, height: number) {
  const portrait = width < 720
  const short = height < 600
  const mediaWidth = portrait
    ? Math.min(width - 96, (height * (short ? 0.25 : 0.32) * 16) / 9)
    : Math.min(width * (short ? 0.42 : 0.49), (height * 0.64 * 16) / 9)
  const mediaHeight = (mediaWidth * 9) / 16
  const mediaX = portrait ? (width - 56) / 2 : width * (short ? 0.62 : 0.675)
  const mediaY = portrait ? height * (short ? 0.32 : 0.265) : height * 0.47
  const textWidth = portrait
    ? width - 96
    : Math.min(
        width * 0.33,
        mediaX - mediaWidth / 2 - Math.max(32, width * 0.03) - width * 0.0743,
      )
  const textHeight = portrait
    ? Math.min(300, height * 0.34)
    : Math.min(mediaHeight, height * 0.49)
  const textX = portrait ? mediaX : width * 0.0743 + textWidth / 2
  const textY = portrait
    ? Math.min(height - 90 - textHeight / 2, height * 0.6)
    : mediaY
  return {
    portrait,
    short,
    media: { x: mediaX, y: mediaY, width: mediaWidth, height: mediaHeight },
    text: { x: textX, y: textY, width: textWidth, height: textHeight },
    spacing: portrait
      ? Math.max(mediaHeight + 10, textHeight + 22)
      : mediaHeight + 36,
  }
}
