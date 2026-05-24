## Summary

<!-- What changed and why? -->

## OpenSpec

<!-- Link the change under openspec/changes/<change-id>, or explain why this is trivial. -->

## Validation

- [ ] `npm run openspec:validate`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm test`

## Privacy Impact

<!-- Note whether this reads new local data, changes storage/export behavior, or adds network behavior. -->

## UI Evidence

<!-- Add screenshots or a short rendered-verification note for visible UI changes. -->

<!-- codex-project-init:user-action-contract:start -->
## User Action Contract

涉及用户触发、可能超过 300ms 的动作时，必须按全局 `user-action-contract` skill 检查。

- [ ] 本 PR 是否包含用户触发的长任务？
- [ ] 若包含，是否没有阻塞现有界面？
- [ ] 是否有 action-local 进行中反馈？
- [ ] 完成后相关数据和业务时间是否刷新？
- [ ] 失败后是否保留旧数据？
- [ ] 是否实际点击验证，并在任务运行中尝试其他交互？
<!-- codex-project-init:user-action-contract:end -->
