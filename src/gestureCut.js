const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function calculateGestureCut(startAngle, startDistanceDelta, deltaX, deltaY, options = {}) {
  const sensitivity = Number(options.sensitivity) || 1
  const precision = options.fine ? .25 : 1
  const depthUnits = deltaX * .025 * sensitivity * precision
  const angleMagnitude = clamp(Math.abs(startAngle) + (-deltaY * .035 * sensitivity * precision), .1, 89.9)
  const sign = startAngle < 0 ? -1 : 1
  return {
    angle: sign * angleMagnitude,
    distanceDelta: clamp(startDistanceDelta - depthUnits * .004, -.032, .032),
    depthUnits,
  }
}
