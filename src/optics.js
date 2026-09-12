export const MATERIALS = {
  diamond: { name: '钻石', ior: 2.417, range: '2.417', density: 3.52, color: '#e8fbff' },
  corundum: { name: '刚玉', ior: 1.765, range: '1.760–1.770', density: 4.00, color: '#2f74ff' },
  spinel: { name: '尖晶石', ior: 1.718, range: '1.710–1.735', density: 3.60, color: '#ff4775' },
  garnet: { name: '石榴石', ior: 1.79, range: '1.730–1.895', density: 3.80, color: '#b91f3d' },
  quartz: { name: '石英', ior: 1.548, range: '1.544–1.553', density: 2.65, color: '#a76cff' },
  custom: { name: '自定义', ior: 1.5, range: '自定义', density: 3.00, color: '#69c7ff' },
}

export function criticalAngle(ior) {
  return Math.asin(1 / ior) * 180 / Math.PI
}

// 教学用一级近似：亭角与临界角越接近，光从亭部逸出的可能性越大。
export function leakageAssessment(pavilionAngle, ior) {
  const critical = criticalAngle(ior)
  const margin = pavilionAngle - critical
  if (margin < 0) return { level: 'high', label: '高风险', detail: '亭角低于临界角，容易产生明显漏光。', margin }
  if (margin < 3) return { level: 'medium', label: '需注意', detail: '亭角接近临界角，建议进一步进行光线追踪。', margin }
  return { level: 'low', label: '较低风险', detail: '亭角高于临界角，具备较好的全反射条件。', margin }
}
