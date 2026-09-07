import { CloudSettingsPanel } from "@/components/cloud-settings-panel";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <CloudSettingsPanel />
    </div>
  );
}
