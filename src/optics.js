export const MATERIALS = {
  diamond: { group: 'natural', name: '钻石', ior: 2.417, range: '2.417', dispersion: .044, density: 3.52, birefringence: 0, optical: '单折射', color: '#ffffff', colorStrength: .05 },
  ruby: { group: 'natural', name: '红宝石（刚玉）', ior: 1.765, range: '1.760–1.770', dispersion: .018, density: 4.00, birefringence: .008, optical: '单轴双折射', color: '#e11445', colorStrength: .82 },
  sapphire: { group: 'natural', name: '蓝宝石（刚玉）', ior: 1.765, range: '1.760–1.770', dispersion: .018, density: 4.00, birefringence: .008, optical: '单轴双折射', color: '#245bd7', colorStrength: .78 },
  corundum: { group: 'natural', name: '刚玉（自选颜色）', ior: 1.765, range: '1.760–1.770', dispersion: .018, density: 4.00, birefringence: .008, optical: '单轴双折射', color: '#d7e6ff', colorStrength: .35 },
  emerald: { group: 'natural', name: '祖母绿（绿柱石）', ior: 1.577, range: '1.565–1.602', dispersion: .014, density: 2.72, birefringence: .006, optical: '单轴双折射', color: '#078a58', colorStrength: .78 },
  aquamarine: { group: 'natural', name: '海蓝宝（绿柱石）', ior: 1.577, range: '1.565–1.602', dispersion: .014, density: 2.72, birefringence: .006, optical: '单轴双折射', color: '#72d9eb', colorStrength: .42 },
  spinel: { group: 'natural', name: '尖晶石', ior: 1.718, range: '1.710–1.735', dispersion: .020, density: 3.60, birefringence: 0, optical: '单折射', color: '#ef4775', colorStrength: .75 },
  garnet: { group: 'natural', name: '石榴石（通用）', ior: 1.79, range: '1.730–1.895', dispersion: .027, density: 3.80, birefringence: 0, optical: '单折射', color: '#a71936', colorStrength: .84 },
  quartz: { group: 'natural', name: '石英 / 紫水晶', ior: 1.548, range: '1.544–1.553', dispersion: .013, density: 2.65, birefringence: .009, optical: '单轴双折射', color: '#9e78d1', colorStrength: .48 },
  tourmaline: { group: 'natural', name: '碧玺', ior: 1.634, range: '1.624–1.644', dispersion: .016, density: 3.06, birefringence: .020, optical: '单轴双折射', color: '#df3f78', colorStrength: .76 },
  topaz: { group: 'natural', name: '托帕石', ior: 1.619, range: '1.609–1.643', dispersion: .014, density: 3.53, birefringence: .009, optical: '双轴双折射', color: '#64c8e7', colorStrength: .40 },
  peridot: { group: 'natural', name: '橄榄石', ior: 1.67, range: '1.654–1.690', dispersion: .020, density: 3.34, birefringence: .036, optical: '双轴双折射', color: '#8fc63d', colorStrength: .68 },
  tanzanite: { group: 'natural', name: '坦桑石', ior: 1.696, range: '1.691–1.700', dispersion: .019, density: 3.35, birefringence: .009, optical: '双轴双折射', color: '#6250cb', colorStrength: .76 },
  zircon: { group: 'natural', name: '锆石', ior: 1.93, range: '1.810–2.024', dispersion: .039, density: 4.65, birefringence: .059, optical: '单轴双折射', color: '#c7f3ff', colorStrength: .25 },
  alexandrite: { group: 'natural', name: '亚历山大变石', ior: 1.746, range: '1.741–1.760', dispersion: .015, density: 3.73, birefringence: .009, optical: '双轴双折射', color: '#4c9b72', colorStrength: .68 },
  cubicZirconia: { group: 'synthetic', name: '立方氧化锆（CZ）', ior: 2.15, range: '2.150–2.180', dispersion: .060, density: 5.80, birefringence: 0, optical: '单折射', color: '#ffffff', colorStrength: .03 },
  moissanite: { group: 'synthetic', name: '合成莫桑石', ior: 2.67, range: '2.648–2.691', dispersion: .104, density: 3.22, birefringence: .043, optical: '单轴双折射', color: '#f8fff7', colorStrength: .08 },
  custom: { group: 'custom', name: '自定义材料', ior: 1.5, range: '自定义', dispersion: .020, density: 3.00, birefringence: 0, optical: '自定义', color: '#69c7ff', colorStrength: .65 },
}

export const MATERIAL_GROUPS = [
  { id: 'natural', name: '天然宝石' },
  { id: 'synthetic', name: '人造宝石与仿钻' },
  { id: 'custom', name: '自定义' },
]

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
