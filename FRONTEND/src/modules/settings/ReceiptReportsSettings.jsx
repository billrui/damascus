import { useState } from "react";
import { C, Card, CardHeader, CardBody, FormRow, Input, Select, Toggle, Btn, Badge, ConfirmModal } from "./shared";

// --- RECEIPT SETTINGS ---------------------------------------------------------
export function ReceiptSettings({ toast, businessProfile }) {
  const [settings, setSettings] = useState({
    headerText: businessProfile?.name || "Damascus Hotel",
    subHeaderText: businessProfile?.tagline || "Where Comfort Meets Excellence",
    footerMessage: "Thank you for dining with us\nWi-Fi Password: DamascusGuest2024",
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showVatNumber: true,
    printCopies: 1,
    printerType: "thermal_80",
    autoPrint: true,
    showItemCodes: false,
    showCashierName: true,
    showTableNumber: true,
    showSignatureLine: false,
    paperCut: true,
  });

  const [dirty, setDirty] = useState(false);
  const set = (key, val) => { setSettings(f => ({ ...f, [key]: val })); setDirty(true); };
  const handleSave = () => { setDirty(false); toast("Receipt settings saved", "success"); };

  const previewLines = [
    settings.showLogo ? "DAMASCUS HOTEL" : null,
    settings.headerText !== "Damascus Hotel" ? settings.headerText : null,
    settings.subHeaderText,
    "---------------------",
    "Receipt #INV-000189",
    `Date: ${new Date().toLocaleDateString("en-KE")}`,
    settings.showCashierName ? "Cashier: Jane Achieng" : null,
    settings.showTableNumber ? "Table: T-05" : null,
    "---------------------",
    "Beef Fillet  -1   KES 1,800",
    "Caesar Salad -2   KES   900",
    "Tusker Lager -2   KES   480",
    "---------------------",
    "Subtotal:       KES 3,180",
    "VAT (16%):        KES 509",
    "Service (10%):    KES 318",
    "TOTAL:          KES 4,007",
    "---------------------",
    "Paid: M-Pesa",
    settings.showSignatureLine ? "---------------------\nSignature: ___________" : null,
    "---------------------",
    ...settings.footerMessage.split("\n"),
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>Receipt & Printing</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Configure how receipts look and print</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {dirty && <Badge label="Unsaved Changes" color="yellow" />}
          <Btn variant="primary" onClick={handleSave}>Save Settings</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <CardHeader title="Receipt Header" />
            <CardBody>
              <div style={{ background: `${C.blue}15`, borderRadius: 4, padding: "8px 14px", fontSize: 11, color: C.blue, fontWeight: 500, marginBottom: 14 }}>
                Header text is pre-filled from Business Profile. Edit here to customise the receipt independently.
              </div>
              <FormRow label="Header Text" hint="Main business name on receipt">
                <Input value={settings.headerText} onChange={e => set("headerText", e.target.value)} />
              </FormRow>
              <FormRow label="Sub-header" hint="Tagline or slogan">
                <Input value={settings.subHeaderText} onChange={e => set("subHeaderText", e.target.value)} />
              </FormRow>
              <FormRow label="Show Logo"><Toggle checked={settings.showLogo} onChange={v => set("showLogo", v)} /></FormRow>
              <FormRow label="Show Address"><Toggle checked={settings.showAddress} onChange={v => set("showAddress", v)} /></FormRow>
              <FormRow label="Show Phone"><Toggle checked={settings.showPhone} onChange={v => set("showPhone", v)} /></FormRow>
              <FormRow label="Show VAT/KRA Number"><Toggle checked={settings.showVatNumber} onChange={v => set("showVatNumber", v)} /></FormRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Receipt Body" />
            <CardBody>
              <FormRow label="Show Cashier Name"><Toggle checked={settings.showCashierName} onChange={v => set("showCashierName", v)} /></FormRow>
              <FormRow label="Show Table Number"><Toggle checked={settings.showTableNumber} onChange={v => set("showTableNumber", v)} /></FormRow>
              <FormRow label="Show Item Codes"><Toggle checked={settings.showItemCodes} onChange={v => set("showItemCodes", v)} /></FormRow>
              <FormRow label="Signature Line" hint="Add a blank signature line at bottom"><Toggle checked={settings.showSignatureLine} onChange={v => set("showSignatureLine", v)} /></FormRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Footer Message" subtitle="Appears at the bottom of every receipt" />
            <CardBody>
              <textarea
                value={settings.footerMessage}
                onChange={e => set("footerMessage", e.target.value)}
                rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 12, color: C.textPrimary, resize: "vertical", fontFamily: "'Inter', monospace", outline: "none" }}
                placeholder="Thank you for your visit-"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Printer Settings" />
            <CardBody>
              <FormRow label="Printer Type">
                <Select value={settings.printerType} onChange={e => set("printerType", e.target.value)} style={{ maxWidth: 280 }} options={[
                  { value: "thermal_80", label: "Thermal - 80mm (standard)" },
                  { value: "thermal_58", label: "Thermal - 58mm (compact)" },
                  { value: "a4",         label: "A4 Paper (inkjet/laser)" },
                  { value: "pdf",        label: "PDF (digital only)" },
                ]} />
              </FormRow>
              <FormRow label="Print Copies" hint="Number of receipt copies per transaction">
                <Select value={String(settings.printCopies)} onChange={e => set("printCopies", parseInt(e.target.value))} style={{ maxWidth: 160 }} options={[
                  { value: "1", label: "1 copy" }, { value: "2", label: "2 copies" }, { value: "3", label: "3 copies" },
                ]} />
              </FormRow>
              <FormRow label="Auto Print" hint="Print receipt automatically after payment"><Toggle checked={settings.autoPrint} onChange={v => set("autoPrint", v)} /></FormRow>
              <FormRow label="Paper Cut" hint="Cut paper after printing (if printer supports it)"><Toggle checked={settings.paperCut} onChange={v => set("paperCut", v)} /></FormRow>
            </CardBody>
          </Card>
        </div>

        {/* Receipt Preview */}
        <div style={{ position: "sticky", top: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Live Preview</div>
          <div style={{ background: "#FFFFFF", borderRadius: 6, border: `1px solid ${C.border}`, padding: "20px 16px", fontFamily: "'Inter', monospace", fontSize: 10, lineHeight: 1.8, color: "#1A1A1A", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {previewLines.map((line, i) => (
              <div key={i} style={{ textAlign: line.startsWith("-") ? "center" : line.startsWith("TOTAL") ? "center" : "left", fontWeight: line.startsWith("TOTAL") ? 700 : 400 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- REPORTS SETTINGS ---------------------------------------------------------
export function ReportsSettings({ toast }) {
  const [settings, setSettings] = useState({
    closingTime: "23:00",
    autoGenerate: true,
    exportFormat: "pdf",
    emailReports: false,
    reportEmail: "manager@damascushotel.co.ke",
    reportSchedule: "daily",
    includeVatBreakdown: true,
    includeTopItems: true,
    includeStaffPerformance: false,
    includeWastage: true,
    fiscalYearStart: "01",
    weekStart: "monday",
  });

  const [dirty, setDirty] = useState(false);
  const set = (key, val) => { setSettings(f => ({ ...f, [key]: val })); setDirty(true); };
  const handleSave = () => { setDirty(false); toast("Reports settings saved", "success"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>Reports Settings</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Configure how reports are generated, exported, and scheduled</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {dirty && <Badge label="Unsaved Changes" color="yellow" />}
          <Btn variant="primary" onClick={handleSave}>Save Settings</Btn>
        </div>
      </div>

      <Card>
        <CardHeader title="Day Close & Reporting Period" />
        <CardBody>
          <FormRow label="Daily Closing Time" hint="End of business day for report grouping">
            <Input value={settings.closingTime} onChange={e => set("closingTime", e.target.value)} type="time" style={{ maxWidth: 160 }} />
          </FormRow>
          <FormRow label="Week Starts On">
            <Select value={settings.weekStart} onChange={e => set("weekStart", e.target.value)} style={{ maxWidth: 200 }} options={[
              { value: "monday", label: "Monday" },
              { value: "sunday", label: "Sunday" },
            ]} />
          </FormRow>
          <FormRow label="Fiscal Year Starts" hint="Month the accounting year begins">
            <Select value={settings.fiscalYearStart} onChange={e => set("fiscalYearStart", e.target.value)} style={{ maxWidth: 200 }} options={[
              { value: "01", label: "January" }, { value: "04", label: "April (KRA)" }, { value: "07", label: "July" },
            ]} />
          </FormRow>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Report Content" subtitle="What to include in generated reports" />
        <CardBody>
          <FormRow label="Auto-generate Daily Report" hint="Automatically create end-of-day report at closing time">
            <Toggle checked={settings.autoGenerate} onChange={v => set("autoGenerate", v)} />
          </FormRow>
          <FormRow label="VAT Breakdown" hint="Include detailed VAT calculation in reports">
            <Toggle checked={settings.includeVatBreakdown} onChange={v => set("includeVatBreakdown", v)} />
          </FormRow>
          <FormRow label="Top Selling Items" hint="Include best-sellers chart in report">
            <Toggle checked={settings.includeTopItems} onChange={v => set("includeTopItems", v)} />
          </FormRow>
          <FormRow label="Wastage Summary" hint="Include wastage and write-off totals">
            <Toggle checked={settings.includeWastage} onChange={v => set("includeWastage", v)} />
          </FormRow>
          <FormRow label="Staff Performance" hint="Include per-cashier sales breakdown">
            <Toggle checked={settings.includeStaffPerformance} onChange={v => set("includeStaffPerformance", v)} />
          </FormRow>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Export & Delivery" />
        <CardBody>
          <FormRow label="Default Export Format">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { v: "pdf", l: "PDF" }, 
                { v: "excel", l: "Excel" }, 
                { v: "csv", l: "CSV" }
              ].map(f => (
                <button key={f.v} onClick={() => set("exportFormat", f.v)} style={{
                  padding: "6px 16px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: settings.exportFormat === f.v ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: settings.exportFormat === f.v ? `${C.accent}15` : C.surface,
                  color: settings.exportFormat === f.v ? C.accent : C.textSecondary,
                  transition: "all 0.15s ease",
                }}>{f.l}</button>
              ))}
            </div>
          </FormRow>
          <FormRow label="Email Reports" hint="Send reports automatically to a designated email">
            <Toggle checked={settings.emailReports} onChange={v => set("emailReports", v)} />
          </FormRow>
          {settings.emailReports && (
            <>
              <FormRow label="Report Email">
                <Input value={settings.reportEmail} onChange={e => set("reportEmail", e.target.value)} placeholder="manager@hotel.co.ke" />
              </FormRow>
              <FormRow label="Schedule">
                <Select value={settings.reportSchedule} onChange={e => set("reportSchedule", e.target.value)} style={{ maxWidth: 220 }} options={[
                  { value: "daily", label: "Daily (end of day)" },
                  { value: "weekly", label: "Weekly (Mondays)" },
                  { value: "monthly", label: "Monthly (1st)" },
                ]} />
              </FormRow>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}