## ADDED Requirements

### Requirement: App.tsx 必须只承担顶层编排职责

`src/App.tsx` 必须（MUST）只保留应用级状态、数据加载、API action 和视图路由，不应继续承载所有页面组件实现。

#### Scenario: 开发者修改 Settings 页面

- **WHEN** 开发者需要修改 Settings UI
- **THEN** 应该能在 `src/views/SettingsView.tsx` 或相关局部组件中完成
- **AND** 不需要编辑顶层 `App.tsx` 的业务状态逻辑

### Requirement: 前端重构不得改变用户可见行为

组件拆分必须（MUST）保持现有视图、文案、className、API action 和 fallback 行为不变。

#### Scenario: 用户打开主界面

- **WHEN** 应用完成加载
- **THEN** Today、Inbox、Timeline、Operating Review、Report 和 Settings 必须保持可渲染
- **AND** 现有按钮和状态流必须继续工作
