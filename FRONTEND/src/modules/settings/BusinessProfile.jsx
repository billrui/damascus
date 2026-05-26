import { useState } from "react";
import { C, Card, CardHeader, CardBody, FormRow, Input, Select, Toggle, Btn, SectionTitle, Badge } from "./shared";

export default function BusinessProfile({ toast, businessProfile, setBusinessProfile }) {
  const [form, setForm] = useState({
    name: businessProfile?.name || "Damascus Hotel",
    tagline: businessProfile?.tagline || "Where Comfort Meets Excellence",
    address: "Kericho CBD",
    city: "Kericho",
    country: "Kenya",
    phone: "+254 793935384",
    email: "info@damascushotel.co.ke",
    website: "www.damascushotel.co.ke",
    currency: "KES",
    vatEnabled: true,
    vatRate: "16",
    serviceChargeEnabled: true,
    serviceChargeRate: "10",
    pinNumber: "P051234567Z",
    kraPin: "P051234567Z",
  });

  const [logoPreview, setLogoPreview] = useState(null);
  const [dirty, setDirty] = useState(false);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); setDirty(true); };

  const handleLogoChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setDirty(true);
  };

  const handleSave = () => {
    setDirty(false);
    setBusinessProfile?.({ name: form.name, tagline: form.tagline });
    toast("Business profile saved successfully", "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>Business Profile</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Hotel identity, contact details, and tax configuration</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {dirty && <Badge label="Unsaved Changes" color="yellow" />}
          <Btn variant="primary" onClick={handleSave}>Save Changes</Btn>
        </div>
      </div>

      {/* Logo + Hotel Identity */}
      <Card>
        <CardHeader title="Hotel Identity" subtitle="Brand name and visual identity" />
        <CardBody>
          {/* Logo Upload */}
          <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <div style={{
              width: 80, height: 80, borderRadius: 6, background: logoPreview ? "transparent" : `linear-gradient(135deg, ${C.accent}, ${C.accent}80)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
              border: `1px solid ${C.border}`, overflow: "hidden", flexShrink: 0,
            }}>
              {logoPreview ? <img src={logoPreview} alt="Hotel Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "-"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6, letterSpacing: "0.3px" }}>Hotel Logo</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>PNG or JPG, recommended 200-200px</div>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", background: C.surfaceAlt,
                border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontWeight: 600,
                color: C.textPrimary, cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface}
              onMouseLeave={e => e.currentTarget.style.background = C.surfaceAlt}>
                Choose File
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
              </label>
              {logoPreview && (
                <button onClick={() => { setLogoPreview(null); setDirty(true); }} style={{ marginLeft: 10, background: "none", border: "none", color: C.red, fontSize: 11, cursor: "pointer", fontWeight: 600, padding: "7px 12px", borderRadius: 4, transition: "all 0.15s ease" }}
                  onMouseEnter={e => e.currentTarget.style.background = `${C.red}10`}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <FormRow label="Hotel Name" required hint="Appears on receipts and reports">
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g., Damascus Hotel" />
          </FormRow>
          <FormRow label="Tagline" hint="Short description shown on receipts">
            <Input value={form.tagline} onChange={e => set("tagline", e.target.value)} placeholder="e.g., Where Comfort Meets Excellence" />
          </FormRow>
        </CardBody>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader title="Contact & Location" />
        <CardBody>
          <FormRow label="Street Address" required>
            <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" />
          </FormRow>
          <FormRow label="City">
            <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
          </FormRow>
          <FormRow label="Country">
            <Select value={form.country} onChange={e => set("country", e.target.value)} options={[
              { value: "Kenya", label: "Kenya" },
              { value: "Uganda", label: "Uganda" },
              { value: "Tanzania", label: "Tanzania" },
            ]} />
          </FormRow>
          <FormRow label="Phone Number" required>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+254 7XX XXX XXX" />
          </FormRow>
          <FormRow label="Email Address">
            <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@hotel.co.ke" type="email" />
          </FormRow>
          <FormRow label="Website">
            <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.hotel.co.ke" />
          </FormRow>
        </CardBody>
      </Card>

      {/* Tax & Currency */}
      <Card>
        <CardHeader title="Currency & Tax Settings" subtitle="Kenya Revenue Authority compliance settings" />
        <CardBody>
          <FormRow label="Currency" required hint="All prices and reports will use this currency">
            <Select value={form.currency} onChange={e => set("currency", e.target.value)} options={[
              { value: "KES", label: "KES - Kenya Shilling" },
              { value: "UGX", label: "UGX - Uganda Shilling" },
              { value: "TZS", label: "TZS - Tanzania Shilling" },
              { value: "USD", label: "USD - US Dollar" },
            ]} style={{ maxWidth: 280 }} />
          </FormRow>

          <FormRow label="VAT (Value Added Tax)" hint="Standard KRA VAT is 16%">
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Toggle checked={form.vatEnabled} onChange={v => set("vatEnabled", v)} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>{form.vatEnabled ? "Enabled" : "Disabled"}</span>
              {form.vatEnabled && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input value={form.vatRate} onChange={e => set("vatRate", e.target.value)} type="number" style={{ width: 80 }} />
                  <span style={{ fontSize: 12, color: C.textSecondary }}>%</span>
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="Service Charge" hint="Additional charge on food & beverage sales">
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Toggle checked={form.serviceChargeEnabled} onChange={v => set("serviceChargeEnabled", v)} />
              <span style={{ fontSize: 12, color: C.textSecondary }}>{form.serviceChargeEnabled ? "Enabled" : "Disabled"}</span>
              {form.serviceChargeEnabled && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input value={form.serviceChargeRate} onChange={e => set("serviceChargeRate", e.target.value)} type="number" style={{ width: 80 }} />
                  <span style={{ fontSize: 12, color: C.textSecondary }}>%</span>
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="KRA PIN" hint="Kenya Revenue Authority PIN for tax compliance">
            <Input value={form.kraPin} onChange={e => set("kraPin", e.target.value)} placeholder="PXXXXXXXXX" style={{ maxWidth: 240 }} />
          </FormRow>

          {/* Preview */}
          {form.vatEnabled || form.serviceChargeEnabled ? (
            <div style={{ marginTop: 24, background: C.surfaceAlt, borderRadius: 6, padding: 18, border: `1px solid ${C.border}` }}>
              <SectionTitle>Tax Preview (on KES 1,000 sale)</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSecondary }}>
                  <span>Subtotal</span><span>KES 1,000.00</span>
                </div>
                {form.vatEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSecondary }}>
                    <span>VAT ({form.vatRate}%)</span><span>KES {(10 * parseFloat(form.vatRate || 0)).toFixed(2)}</span>
                  </div>
                )}
                {form.serviceChargeEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSecondary }}>
                    <span>Service Charge ({form.serviceChargeRate}%)</span><span>KES {(10 * parseFloat(form.serviceChargeRate || 0)).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: C.textPrimary, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span>
                  <span>KES {(1000 + 10 * parseFloat(form.vatEnabled ? form.vatRate || 0 : 0) + 10 * parseFloat(form.serviceChargeEnabled ? form.serviceChargeRate || 0 : 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}