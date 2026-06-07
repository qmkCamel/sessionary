import { Activity, Download, RefreshCw } from "lucide-react";
import type { LanguageSetting, TranslationKey } from "../i18n";
import type {
  AppSettings,
  BackupResult,
  IntegrationDiagnosticsResult,
  IntegrationSyncResult
} from "../shared/types";
import { byteLabel } from "../app/format";
import { sourceLabels } from "../app/labels";
import { useTranslation } from "../app/translation";

export function SettingsEditor({
  settings,
  onChange,
  onSave,
  onScan,
  onSyncIntegrations,
  onDiagnoseIntegrations,
  onCreateBackup,
  onRestoreBackup,
  integrationSyncing = false,
  integrationSyncResult,
  integrationDiagnostics,
  integrationDiagnosing = false,
  backupResult,
  backupWorking = false,
  restorePath,
  onRestorePathChange,
  compact = false
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSave: () => void;
  onScan?: () => void;
  onSyncIntegrations?: () => void;
  onDiagnoseIntegrations?: () => void;
  onCreateBackup?: () => void;
  onRestoreBackup?: () => void;
  integrationSyncing?: boolean;
  integrationSyncResult?: IntegrationSyncResult | null;
  integrationDiagnostics?: IntegrationDiagnosticsResult | null;
  integrationDiagnosing?: boolean;
  backupResult?: BackupResult | null;
  backupWorking?: boolean;
  restorePath?: string;
  onRestorePathChange?: (value: string) => void;
  compact?: boolean;
}) {
  const t = useTranslation();
  const updatePaths = (source: "codex" | "claude", value: string) => {
    onChange({
      ...settings,
      sourceConfigs: settings.sourceConfigs.map((config) =>
        config.source === source ? { ...config, paths: value.split("\n").map((line) => line.trim()).filter(Boolean) } : config
      )
    });
  };

  const toggleSource = (source: "codex" | "claude") => {
    onChange({
      ...settings,
      sourceConfigs: settings.sourceConfigs.map((config) =>
        config.source === source ? { ...config, enabled: !config.enabled } : config
      )
    });
  };

  const updateLanguage = (language: LanguageSetting) => {
    onChange({
      ...settings,
      language
    });
  };

  const updateIntegration = (
    provider: "github" | "linear",
    patch: Partial<AppSettings["integrationSettings"]["github"]>
  ) => {
    onChange({
      ...settings,
      integrationSettings: {
        ...settings.integrationSettings,
        [provider]: {
          ...settings.integrationSettings[provider],
          ...patch
        }
      }
    });
  };

  return (
    <div className={compact ? "settings-editor compact" : "settings-editor"}>
      <section className="panel settings-language-panel">
        <div className="panel-header">
          <h2>{t("settings.language")}</h2>
          <span>{t("settings.languageHint")}</span>
        </div>
        <div className="segmented-control language-control">
          {([
            ["system", "language.system"],
            ["en", "language.english"],
            ["zh-CN", "language.simplifiedChinese"]
          ] as Array<[LanguageSetting, TranslationKey]>).map(([value, labelKey]) => (
            <button key={value} className={(settings.language ?? "system") === value ? "active" : ""} onClick={() => updateLanguage(value)}>
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>
      <section className="panel settings-sources-panel">
        <div className="panel-header">
          <h2>{t("settings.sources")}</h2>
          <span>{settings.sourceConfigs.length} {t("settings.sources")}</span>
        </div>
        <div className="settings-source-grid">
          {settings.sourceConfigs.map((config) => (
            <article className="settings-source-card" key={config.source}>
              <div className="settings-card-head">
                <div>
                  <h3>{sourceLabels[config.source]}</h3>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={config.enabled} onChange={() => toggleSource(config.source)} />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                  <span>{config.enabled ? t("common.enabled") : t("common.off")}</span>
                </label>
              </div>
              <textarea
                value={config.paths.join("\n")}
                onChange={(event) => updatePaths(config.source, event.target.value)}
                spellCheck={false}
              />
            </article>
          ))}
        </div>
      </section>
      <section className="panel settings-project-roots-panel">
        <div className="panel-header">
          <h2>{t("settings.projectRoots")}</h2>
          <span>{t("common.optional")}</span>
        </div>
        <textarea
          value={settings.projectRoots.join("\n")}
          placeholder={t("settings.projectRootsPlaceholder")}
          onChange={(event) =>
            onChange({
              ...settings,
              projectRoots: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean)
            })
          }
          spellCheck={false}
        />
      </section>
      {!compact && (
        <section className="panel integrations-panel">
          <div className="panel-header">
            <div>
              <h2>{t("settings.integrations")}</h2>
              <span>{t("settings.integrationsHint")}</span>
            </div>
            {integrationSyncResult && (
              <span>{integrationSyncResult.sessionsUpdated} {t("settings.sessionsUpdated")}</span>
            )}
          </div>
          <div className="integration-provider-list">
            {([
              ["github", "GitHub", "settings.githubToken"],
              ["linear", "Linear", "settings.linearToken"]
            ] as Array<["github" | "linear", string, TranslationKey]>).map(([provider, label, placeholderKey]) => (
              <div className="integration-provider" key={provider}>
                <div className="integration-provider-head">
                  <strong>{label}</strong>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={settings.integrationSettings[provider].enabled}
                      onChange={() =>
                        updateIntegration(provider, {
                          enabled: !settings.integrationSettings[provider].enabled
                        })
                      }
                    />
                    <span className="switch-track" aria-hidden="true">
                      <span className="switch-thumb" />
                    </span>
                    <span>{settings.integrationSettings[provider].enabled ? t("common.enabled") : t("common.off")}</span>
                  </label>
                </div>
                <input
                  type="password"
                  value={settings.integrationSettings[provider].token}
                  placeholder={t(placeholderKey)}
                  onChange={(event) => updateIntegration(provider, { token: event.target.value })}
                  spellCheck={false}
                />
                {settings.integrationSettings[provider].tokenSaved && !settings.integrationSettings[provider].token && (
                  <small>
                    {t("settings.tokenSaved")}
                  </small>
                )}
                {settings.integrationSettings[provider].tokenSaved && (
                  <button
                    className="quiet-button"
                    onClick={() => updateIntegration(provider, { token: "", tokenSaved: false, clearToken: true })}
                  >
                    {t("settings.clearToken")}
                  </button>
                )}
                {integrationSyncResult && <small>{integrationSyncResult[provider].message}</small>}
              </div>
            ))}
          </div>
          <div className="settings-action-row">
            <button className="sync-button" onClick={onSyncIntegrations} disabled={integrationSyncing}>
              <RefreshCw className={integrationSyncing ? "spin" : ""} size={15} />
              {integrationSyncing ? t("settings.syncingIntegrations") : t("settings.syncIntegrations")}
            </button>
            <button className="sync-button" onClick={onDiagnoseIntegrations} disabled={integrationDiagnosing}>
              <Activity className={integrationDiagnosing ? "spin" : ""} size={15} />
              {integrationDiagnosing ? t("settings.runningDiagnostics") : t("settings.runDiagnostics")}
            </button>
          </div>
          {integrationDiagnostics && (
            <div className="diagnostic-grid">
              {(["github", "linear"] as const).map((provider) => (
                <div className={`diagnostic-card ${integrationDiagnostics[provider].ok ? "pass" : "warning"}`} key={provider}>
                  <strong>{provider === "github" ? "GitHub" : "Linear"}</strong>
                  <span>{integrationDiagnostics[provider].message}</span>
                  {integrationDiagnostics[provider].details.map((detail) => (
                    <small className={`diagnostic-detail ${detail.level}`} key={`${provider}-${detail.label}-${detail.value}`}>
                      {detail.label}: {detail.value}
                    </small>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {!compact && (
        <section className="panel settings-backup-panel">
          <div className="panel-header">
            <div>
              <h2>{t("settings.backupRestore")}</h2>
              <span>{t("settings.backupHint")}</span>
            </div>
          </div>
          <div className="settings-action-row">
            <button className="sync-button" onClick={onCreateBackup} disabled={backupWorking}>
              <Download size={15} />
              {t("settings.createBackup")}
            </button>
          </div>
          {backupResult && (
            <div className="result-box">
              <strong>{backupResult.message}</strong>
              <small>{backupResult.path}</small>
              <small>{byteLabel(backupResult.bytes)}</small>
            </div>
          )}
          <input
            type="text"
            value={restorePath ?? ""}
            placeholder={t("settings.restorePath")}
            onChange={(event) => onRestorePathChange?.(event.target.value)}
            spellCheck={false}
          />
          <button className="sync-button" onClick={onRestoreBackup} disabled={backupWorking || !(restorePath ?? "").trim()}>
            <RefreshCw size={15} />
            {t("settings.restoreBackup")}
          </button>
        </section>
      )}
      <div className="settings-actions">
        <button className="primary-button" onClick={onSave}>{t("common.save")}</button>
        {onScan && <button onClick={onScan}>{t("common.saveAndScan")}</button>}
      </div>
    </div>
  );
}

export function SettingsView({
  settings,
  onChange,
  onSave,
  onScan,
  onSyncIntegrations,
  onDiagnoseIntegrations,
  onCreateBackup,
  onRestoreBackup,
  integrationSyncing,
  integrationSyncResult,
  integrationDiagnostics,
  integrationDiagnosing,
  backupResult,
  backupWorking,
  restorePath,
  onRestorePathChange
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onSave: () => void;
  onScan: () => void;
  onSyncIntegrations: () => void;
  onDiagnoseIntegrations: () => void;
  onCreateBackup: () => void;
  onRestoreBackup: () => void;
  integrationSyncing: boolean;
  integrationSyncResult: IntegrationSyncResult | null;
  integrationDiagnostics: IntegrationDiagnosticsResult | null;
  integrationDiagnosing: boolean;
  backupResult: BackupResult | null;
  backupWorking: boolean;
  restorePath: string;
  onRestorePathChange: (value: string) => void;
}) {
  const t = useTranslation();
  return (
    <main className="workspace settings-workspace">
      <div className="page-title">
        <div>
          <p>{t("common.localOnly")}</p>
          <h1>{t("nav.settings")}</h1>
        </div>
      </div>
      <SettingsEditor
        settings={settings}
        onChange={onChange}
        onSave={onSave}
        onScan={onScan}
        onSyncIntegrations={onSyncIntegrations}
        onDiagnoseIntegrations={onDiagnoseIntegrations}
        onCreateBackup={onCreateBackup}
        onRestoreBackup={onRestoreBackup}
        integrationSyncing={integrationSyncing}
        integrationSyncResult={integrationSyncResult}
        integrationDiagnostics={integrationDiagnostics}
        integrationDiagnosing={integrationDiagnosing}
        backupResult={backupResult}
        backupWorking={backupWorking}
        restorePath={restorePath}
        onRestorePathChange={onRestorePathChange}
      />
    </main>
  );
}

export function Onboarding({
  settings,
  onChange,
  onComplete
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onComplete: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="onboarding-shell">
      <div className="onboarding-copy">
        <strong>Sessionary</strong>
        <h1>{t("onboarding.title")}</h1>
        <p>{t("onboarding.body")}</p>
      </div>
      <SettingsEditor settings={settings} onChange={onChange} onSave={onComplete} onScan={onComplete} compact />
    </div>
  );
}
