## ADDED Requirements

### Requirement: 应用必须提供统一品牌图标资产

Sessionary 必须（MUST）提供可维护的品牌图标与 logo 源资产，用于桌面应用、浏览器 favicon、应用侧栏、文档和发布材料。资产必须（MUST）体现 local-first AI coding session ledger / inbox 的产品定位，不得（MUST NOT）引入远程字体、远程图片或云端资源。

#### Scenario: 维护者查找品牌资产

- **WHEN** 维护者需要使用 Sessionary 品牌图形
- **THEN** 仓库必须包含 app icon、compact mark、horizontal logo 和 monochrome mark
- **AND** 必须提供用途、颜色和限制说明

#### Scenario: 用户打开桌面应用

- **WHEN** 用户打开 Sessionary 桌面应用
- **THEN** 侧栏品牌必须显示统一品牌 mark 和产品名
- **AND** 窄侧栏布局下必须保留可识别的 compact mark
- **AND** 品牌区域不得产生横向溢出或遮挡导航

#### Scenario: 用户在浏览器预览中打开应用

- **WHEN** 用户运行浏览器预览
- **THEN** 页面 favicon 必须使用同一品牌系统的图标
- **AND** 不得依赖 Tauri-only 路径才能显示 favicon

### Requirement: 品牌资产必须保持 local-first 数据边界

品牌资产变更必须（MUST）只添加本地静态文件和本地 UI 引用，不得（MUST NOT）新增网络请求、遥测、账户系统或远程资源加载。

#### Scenario: 应用加载品牌图标

- **WHEN** 应用渲染侧栏品牌或 favicon
- **THEN** 图标必须来自仓库内本地静态资产
- **AND** 应用不得因此发起远程网络请求
