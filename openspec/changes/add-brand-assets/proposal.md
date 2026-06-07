# Change: 增加 Sessionary 品牌图标与 Logo 资产

## 背景

Sessionary 当前只有默认应用图标和侧栏文字品牌，缺少能表达产品调性与能力的统一视觉资产。产品定位是 local-first AI coding session ledger / inbox，品牌语气应清晰、克制、可复盘、不审判用户。

## 目标

- 生成一套可维护的 Sessionary 图标与 logo 资产。
- 视觉语义必须体现 session ledger、inbox、timeline overlap 和 local-first 隐私边界。
- 资产颜色应沿用应用现有色彩系统，避免夸张营销感或单一色相堆叠。
- 应用侧栏品牌和浏览器 favicon 应使用同一品牌系统。
- Tauri 桌面应用图标应从同一视觉方向导出。

## 不做

- 不重做整体 UI 主题。
- 不引入远程字体、远程图片或云端品牌资源。
- 不改变产品文案、数据模型或扫描行为。

## 成功标准

- 仓库包含 app icon、compact mark、horizontal logo 和 monochrome mark 等矢量源资产。
- 侧栏品牌在桌面、窄侧栏和移动布局下均不产生文字或图形溢出。
- favicon 和 Tauri icon 使用新的 Sessionary 品牌图形。
- 资产说明记录颜色、用途和不推荐用法，便于后续维护。
