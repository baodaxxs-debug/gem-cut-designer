# 宝石智能琢型设计系统

面向宝石琢型设计与课堂演示的浏览器应用。支持参数化刻面、对称与自由设计、直接切割、材料折射率、光学检查、原石包容分析，以及 ASC、DXF 和切割步骤表导出。

当前版本包含圆明亮式和 8 射线烟花切等内置设计。烟花切提供亭部星芒强调面、整层联动切割，以及光面/磨砂表面效果。

## 本地运行

```bash
npm install
npm run dev
```

## 检查与构建

```bash
npm test
npm run build
```

## 在线发布

推送到 `main` 或 `master` 分支后，`.github/workflows/deploy-pages.yml` 会测试、构建并发布 `dist` 到 GitHub Pages。

本程序用于设计辅助与教学演示。正式切磨前仍需结合材料、原石、设备精度和实物缺陷复核。
