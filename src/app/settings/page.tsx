import PageHeader from "@/components/PageHeader";
import GeneralSettings from "@/components/settings/GeneralSettings";
import ColumnMappingEditor from "@/components/settings/ColumnMappingEditor";
import UserManagement from "@/components/settings/UserManagement";
import AuditLogViewer from "@/components/settings/AuditLogViewer";
import DataUpload from "@/components/DataUpload";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Global configuration, data source, column mappings, and user management"
      />

      <div className="space-y-8">
        {/* General, Data Source, Dedup, Escalation, Tracking settings */}
        <GeneralSettings />

        {/* Data Upload */}
        <section className="rounded-lg bg-slate-900 border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-50 mb-4">
            Upload Data
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Upload an Excel file to load investment data. This replaces any
            previously loaded data.
          </p>
          <DataUpload />
        </section>

        {/* Column Mappings */}
        <ColumnMappingEditor />

        {/* User Management */}
        <UserManagement />

        {/* Audit Log */}
        <AuditLogViewer />
      </div>
    </div>
  );
}
