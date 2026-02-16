"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import ContactMappingTable from "@/components/contacts/ContactMappingTable";
import UnmatchedIndustriesPanel from "@/components/contacts/UnmatchedIndustriesPanel";

export default function ContactsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div>
      <PageHeader
        title="Contact Mapping"
        description="Manage industry to SEL, Ops Manager, and Concierge mappings"
      />

      <div className="space-y-6">
        <UnmatchedIndustriesPanel
          refreshKey={refreshKey}
          onQuickAdd={triggerRefresh}
        />
        <ContactMappingTable onDataChange={triggerRefresh} />
      </div>
    </div>
  );
}
