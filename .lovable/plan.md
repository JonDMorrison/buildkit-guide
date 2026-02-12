

# Invoicing Module -- QA, UX/UI Audit and Improvement Plan

## Executive Summary
The invoicing module has solid foundational coverage (clients, invoices, payments, aging, recurring, PDF, email). However, compared to industry tools like FreshBooks, Wave, or QuickBooks, there are functional bugs, missing safeguards, UX friction points, and feature gaps that need addressing before this is production-ready.

---

## CATEGORY 1: Bugs and Data Integrity Issues (Critical)

### 1A. No confirmation before destructive actions
- **Void**, **Delete Template**, **Credit Note**, and **Clone** actions execute immediately on click with no confirmation dialog. One mis-tap voids an invoice permanently.
- **Fix**: Add AlertDialog confirmation for Void, Delete, and Credit Note actions.

### 1B. Send button only appears on Draft invoices
- Line 316: the Mail/Send button is gated to `inv.status === "draft"`, meaning you cannot re-send a "Sent" or "Overdue" invoice. Industry standard allows resending at any status.
- **Fix**: Show the Send button for draft, sent, and overdue statuses.

### 1C. No validation on overpayment
- RecordPaymentModal allows entering an amount greater than the remaining balance, which could result in a negative balance with no warning.
- **Fix**: Add a warning/cap when the amount exceeds the outstanding balance.

### 1D. Recurring templates have no automation
- The recurring_invoice_templates table stores `next_issue_date` and `frequency`, but there is no scheduled function or cron job that actually generates invoices from them. The feature is UI-only.
- **Fix**: Create a backend function (cron or manual trigger) that generates invoices from active templates whose `next_issue_date` has passed.

### 1E. Detail modal doesn't refresh after save
- In InvoiceDetailModal, after saving line items and updating the invoice, the parent's `fetchInvoices()` is not called, and the detail modal still shows stale data (the `detailInvoice` object isn't refreshed).
- **Fix**: After save, re-fetch the invoice and line items and update the modal state.

### 1F. Logo not rendered in PDF
- InvoicePDFExport.tsx never uses `settings.logo_url`. The logo upload exists in settings but the PDF generator completely ignores it.
- **Fix**: Use jsPDF's `addImage()` to render the logo at the top of the PDF.

### 1G. Invoice status never auto-transitions to "overdue"
- There is no logic anywhere that moves a "sent" invoice to "overdue" when the due date passes. The status badge will always say "Sent" even months past due.
- **Fix**: Either compute overdue status on-the-fly in the UI, or add a scheduled function to update statuses.

---

## CATEGORY 2: UX Friction and Missing Workflows

### 2A. No search/filter on invoices
- With dozens or hundreds of invoices, there's only a status filter dropdown. No search by invoice number, client name, or date range.
- **Fix**: Add a search input and date range filters.

### 2B. No payment history visible in detail modal
- InvoiceDetailModal shows total paid and balance, but there's no list of individual payments (dates, methods, references). The `useInvoicePayments` hook has `fetchPayments()` but it's never called in the detail view.
- **Fix**: Add a "Payment History" section to the detail modal listing all recorded payments.

### 2C. No delete invoice capability
- There's no way to delete a draft invoice. RLS allows admins to delete, but the UI has no delete button.
- **Fix**: Add a delete action for draft invoices (with confirmation).

### 2D. Invoice email uses `onboarding@resend.dev` sender
- The edge function hardcodes `from: onboarding@resend.dev`. Emails will likely land in spam and look unprofessional. Resend requires a verified domain for production use.
- **Fix**: Document the requirement for users to configure a verified domain, and add a "From Email" setting in invoice_settings.

### 2E. Settings not auto-saved / no dirty-state indicator
- The settings form requires manually clicking "Save Settings" but provides no visual indication when there are unsaved changes. Easy to navigate away and lose work.
- **Fix**: Add a dirty-state indicator (e.g., highlighted save button or "unsaved changes" warning).

### 2F. Client list has no invoice count or total billed
- The Clients tab shows basic contact info but no relationship to invoicing data (how many invoices, total billed, outstanding balance).
- **Fix**: Add computed columns for invoice count and outstanding balance per client.

---

## CATEGORY 3: UI Polish and Industry Parity

### 3A. Invoice table not mobile-friendly
- The 7-column invoice table breaks on small screens. No responsive adaptation.
- **Fix**: Use a card-based layout on mobile with key info (number, client, total, status) and actions in a dropdown menu.

### 3B. No invoice preview before sending
- Users must download the PDF to see what the invoice looks like. There's no in-app preview.
- **Fix**: Add an inline preview (rendered HTML) in the detail modal or a preview step in the Send flow.

### 3C. Tab icons increase cognitive load on mobile
- All five tab triggers have icons + text which crowds the TabsList on narrow screens.
- **Fix**: Show icon-only tabs on mobile with tooltips.

### 3D. Aging Report lacks export
- The AR Aging report is view-only. Accountants need to export this data to CSV/PDF.
- **Fix**: Add export buttons (CSV and PDF) to the Aging tab.

### 3E. No currency configuration
- Everything is hardcoded to USD (`$`). Canadian construction companies use CAD, and the system should support configurable currency symbols.
- **Fix**: Add a currency field to invoice_settings and use it throughout.

---

## CATEGORY 4: Security and Access Control

### 4A. No role gating on invoicing page
- The page imports `useProjectRole` and `isGlobalAdmin` but never uses them to restrict access. Any org member (including workers) can access invoicing, create invoices, and void them.
- **Fix**: Gate the invoicing page to Admin and Project Manager roles only.

### 4B. Projects query not org-scoped
- Line 107: `supabase.from("projects").select("id, name")` fetches all non-deleted projects without filtering by organization, potentially leaking project names across orgs.
- **Fix**: Add `.eq('organization_id', activeOrganizationId)` to the projects query.

---

## Implementation Priority and Sequencing

**Phase 1 -- Critical Fixes (bugs and data integrity)**
1. Confirmation dialogs for destructive actions (1A)
2. Fix overdue auto-detection (1G)
3. Fix Send button visibility for non-draft statuses (1B)
4. Add overpayment validation (1C)
5. Render logo in PDF (1F)
6. Scope projects query to organization (4B)
7. Role-gate the invoicing page (4A)

**Phase 2 -- UX Completeness**
8. Search and date-range filters on invoices (2A)
9. Payment history in detail modal (2B)
10. Delete draft invoices (2C)
11. Dirty-state indicator on settings (2E)
12. Detail modal refresh after save (1E)
13. Client invoice summary columns (2F)

**Phase 3 -- Industry Parity and Polish**
14. Recurring invoice automation (backend function) (1D)
15. Mobile-responsive invoice table (3A)
16. Aging report CSV/PDF export (3D)
17. Currency configuration (3E)
18. Email sender domain configuration (2D)
19. Invoice preview before send (3B)
20. Mobile tab optimization (3C)

---

## Technical Details

### Files to modify:
- `src/pages/Invoicing.tsx` -- role gating, confirmations, search, filters, org-scoped projects, send button logic, delete action, overdue computation, dirty state
- `src/components/invoicing/InvoiceDetailModal.tsx` -- payment history section, refresh after save, inline preview
- `src/components/invoicing/InvoicePDFExport.tsx` -- logo rendering, currency symbol
- `src/components/invoicing/RecordPaymentModal.tsx` -- overpayment validation
- `src/components/invoicing/AgingReport.tsx` -- CSV/PDF export buttons
- `src/components/invoicing/SendInvoiceModal.tsx` -- allow resending
- `src/types/invoicing.ts` -- currency field on InvoiceSettings
- `supabase/functions/send-invoice-email/index.ts` -- configurable from address
- New migration -- add `currency` column to `invoice_settings`
- New edge function or cron -- recurring invoice generation

### Estimated scope: ~3 implementation rounds matching the phases above.

