import colorString from "color-string"

type AltiumColorFromCssInput = {
  cssColor: string
  fallbackAltiumColor: number
}

export function getAltiumColorFromCss({
  cssColor,
  fallbackAltiumColor,
}: AltiumColorFromCssInput): number {
  const rgbColor = colorString.get.rgb(cssColor.trim())
  if (!rgbColor || rgbColor.length < 3) return fallbackAltiumColor
  const [red = 0, green = 0, blue = 0] = rgbColor.map(Math.round)
  return red | (green << 8) | (blue << 16)
}
