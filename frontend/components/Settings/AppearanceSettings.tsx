import { ChevronRight, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/store";
import {
  defaultFocusModeDisplaySettings,
  type FocusModeDisplaySettings,
  selectFocusModeDisplaySettings,
} from "@/store/slices";
import { cn } from "@/lib/utils";

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Indent the row to show nesting */
  nested?: boolean;
  /** Gray out when a parent toggle makes these irrelevant */
  dimmed?: boolean;
}

function ToggleRow({ id, label, description, checked, onCheckedChange, nested, dimmed }: ToggleRowProps) {
  return (
    <div className={cn("flex items-center justify-between", nested && "pl-4", dimmed && "opacity-40 pointer-events-none")}>
      <div className={cn("space-y-1", nested && "flex items-start gap-1.5")}>
        {nested && <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground/50" />}
        <div>
          <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function AppearanceSettings() {
  const displaySettings = useStore(selectFocusModeDisplaySettings);
  const setFocusModeDisplaySettings = useStore((state) => state.setFocusModeDisplaySettings);

  const update = (patch: Partial<FocusModeDisplaySettings>) => {
    setFocusModeDisplaySettings({ ...displaySettings, ...patch });
  };

  const allShown = Object.values(displaySettings).every(Boolean);
  const allHidden = Object.values(displaySettings).every((v) => !v);

  const statusBarSubOptions: Array<keyof FocusModeDisplaySettings> = [
    "showInputModeToggle",
    "showStatusBadge",
    "showAgentModeSelector",
    "showContextUsage",
    "showMcpBadge",
  ];

  return (
    <div className="space-y-6">
      {/* Focus Mode section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Focus Mode</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure which UI elements remain visible when Focus Mode is active (
            <kbd className="inline-flex items-center rounded border border-[var(--border-medium)] bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘.
            </kbd>
            ). Toggle on to keep an element visible; toggle off to hide it.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border-medium)] bg-card/50 divide-y divide-[var(--border-subtle)]">
          {/* Notification Bell */}
          <div className="px-4 py-3">
            <ToggleRow
              id="focus-show-notification-bell"
              label="Notification Bell"
              description="Keep the notification bell visible in the tab bar"
              checked={displaySettings.showNotificationBell}
              onCheckedChange={(checked) => update({ showNotificationBell: checked })}
            />
          </div>

          {/* Status Bar — parent toggle */}
          <div className="px-4 py-3 space-y-3">
            <ToggleRow
              id="focus-show-status-bar"
              label="Status Bar"
              description="Keep the entire bottom status bar visible"
              checked={displaySettings.showStatusBar}
              onCheckedChange={(checked) => {
                // When forcing the whole bar visible, sub-options become irrelevant — reset them
                update({
                  showStatusBar: checked,
                  ...(checked
                    ? Object.fromEntries(statusBarSubOptions.map((k) => [k, false]))
                    : {}),
                });
              }}
            />

            {/* Nested sub-options — dimmed when the whole bar is forced visible */}
            <div className="space-y-3">
              <ToggleRow
                id="focus-show-input-mode-toggle"
                label="Input Mode Toggle"
                description="Show the full Terminal / AI segmented toggle instead of collapsing it"
                checked={displaySettings.showInputModeToggle}
                onCheckedChange={(checked) => update({ showInputModeToggle: checked })}
                nested
                dimmed={displaySettings.showStatusBar}
              />
              <ToggleRow
                id="focus-show-status-badge"
                label="Status & Model Badge"
                description="Keep the connection status and active model name badge visible"
                checked={displaySettings.showStatusBadge}
                onCheckedChange={(checked) => update({ showStatusBadge: checked })}
                nested
                dimmed={displaySettings.showStatusBar}
              />
              <ToggleRow
                id="focus-show-agent-mode-selector"
                label="Agent Mode Selector"
                description="Keep the agent mode (Auto / Plan / etc.) dropdown visible"
                checked={displaySettings.showAgentModeSelector}
                onCheckedChange={(checked) => update({ showAgentModeSelector: checked })}
                nested
                dimmed={displaySettings.showStatusBar}
              />
              <ToggleRow
                id="focus-show-context-usage"
                label="Token Usage"
                description="Keep the context window / token usage percentage badge visible"
                checked={displaySettings.showContextUsage}
                onCheckedChange={(checked) => update({ showContextUsage: checked })}
                nested
                dimmed={displaySettings.showStatusBar}
              />
              <ToggleRow
                id="focus-show-mcp-badge"
                label="MCP Servers Badge"
                description="Keep the MCP servers connected indicator visible"
                checked={displaySettings.showMcpBadge}
                onCheckedChange={(checked) => update({ showMcpBadge: checked })}
                nested
                dimmed={displaySettings.showStatusBar}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={allShown}
            onClick={() =>
              setFocusModeDisplaySettings({
                showNotificationBell: true,
                showStatusBar: true,
                showInputModeToggle: true,
                showStatusBadge: true,
                showAgentModeSelector: true,
                showContextUsage: true,
                showMcpBadge: true,
              })
            }
            className="text-xs text-accent hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            Show all
          </button>
          <span className="text-xs text-muted-foreground/50">·</span>
          <button
            type="button"
            disabled={allHidden}
            onClick={() =>
              setFocusModeDisplaySettings({
                showNotificationBell: false,
                showStatusBar: false,
                showInputModeToggle: false,
                showStatusBadge: false,
                showAgentModeSelector: false,
                showContextUsage: false,
                showMcpBadge: false,
              })
            }
            className="text-xs text-accent hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            Hide all
          </button>
          <span className="text-xs text-muted-foreground/50">·</span>
          <button
            type="button"
            onClick={() => setFocusModeDisplaySettings({ ...defaultFocusModeDisplaySettings })}
            className="text-xs text-accent hover:underline"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
