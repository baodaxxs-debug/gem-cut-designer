const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function calculateGestureCut(startAngle, startDistanceDelta, deltaX, deltaY, options = {}) {
  const sensitivity = Number(options.sensitivity) || 1
  const precision = options.fine ? .2 : 1
  const depthUnits = deltaX * .02 * sensitivity * precision
  const angleMagnitude = clamp(Math.abs(startAngle) + (-deltaY * .028 * sensitivity * precision), .1, 89.9)
  const sign = startAngle < 0 ? -1 : 1
  return {
    angle: sign * Math.round(angleMagnitude * 100) / 100,
    distanceDelta: Math.round(clamp(startDistanceDelta - depthUnits * .004, -.032, .032) * 100000) / 100000,
    depthUnits,
  }
}
