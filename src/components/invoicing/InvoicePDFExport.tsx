import jsPDF from "jspdf";
import type { Invoice, InvoiceLineItem, InvoiceSettings, Client } from "@/types/invoicing";
import { format } from "date-fns";

/**
 * Generate and download an invoice PDF. Includes logo if available.
 */
export const generateInvoicePDF = async (
  invoice: Invoice,
  lineItems: InvoiceLineItem[],
  settings: InvoiceSettings | null,
  client: Client | null,
) => {
  const doc = new jsPDF();
  const m = 14;
  let y = 20;
  const cs = "$";
  const currencyCode = (settings as any)?.currency || "CAD";

  // Logo rendering (1F fix)
  if (settings?.logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = settings.logo_url!;
      });
      const maxW = 40, maxH = 20;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      doc.addImage(img, "PNG", m, y, w, h);
      y += h + 4;
    } catch {
      // Logo failed to load, continue without
    }
  }

  // Company header
  doc.setFontSize(18);
  doc.text(settings?.company_name || "Invoice", m, y);
  y += 7;
  if (settings?.company_address) {
    doc.setFontSize(9);
    doc.text(settings.company_address, m, y);
    y += 5;
  }
  y += 5;

  // Credit note indicator
  if (invoice.credit_note_for) {
    doc.setFontSize(12);
    doc.setTextColor(220, 50, 50);
    doc.text("CREDIT NOTE", m, y);
    doc.setTextColor(0, 0, 0);
    y += 7;
  }

  // Invoice details
  doc.setFontSize(12);
  doc.text(`Invoice #${invoice.invoice_number}`, m, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Issue Date: ${format(new Date(invoice.issue_date), "MMM d, yyyy")}`, m, y);
  y += 5;
  if (invoice.due_date) {
    doc.text(`Due Date: ${format(new Date(invoice.due_date), "MMM d, yyyy")}`, m, y);
    y += 5;
  }
  if (settings?.default_payment_terms) {
    doc.text(`Payment Terms: ${settings.default_payment_terms}`, m, y);
    y += 5;
  }
  doc.text(`Status: ${invoice.status.toUpperCase()}`, m, y);
  y += 8;

  // Bill To
  if (client) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", m, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(client.name, m, y); y += 4;
    if (client.contact_name) { doc.text(client.contact_name, m, y); y += 4; }
    if (client.billing_address) { doc.text(client.billing_address, m, y); y += 4; }
    const cityLine = [client.city, client.province, client.postal_code].filter(Boolean).join(", ");
    if (cityLine) { doc.text(cityLine, m, y); y += 4; }
    if (client.email) { doc.text(client.email, m, y); y += 4; }
    y += 4;
  }

  // Line items table header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Description", m, y);
  doc.text("Qty", 110, y, { align: "right" });
  doc.text("Price", 140, y, { align: "right" });
  doc.text("Amount", 180, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");

  // Line items
  for (const li of lineItems) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.text(li.description, m, y);
    doc.text(String(li.quantity), 110, y, { align: "right" });
    doc.text(`${cs}${Number(li.unit_price).toFixed(2)}`, 140, y, { align: "right" });
    doc.text(`${cs}${Number(li.amount).toFixed(2)}`, 180, y, { align: "right" });
    y += 5;
  }

  y += 3;
  doc.text("Subtotal", 140, y, { align: "right" });
  doc.text(`${cs}${Number(invoice.subtotal).toFixed(2)}`, 180, y, { align: "right" });
  y += 5;

  if (Number(invoice.tax_amount) > 0) {
    doc.text(settings?.tax_label || "Tax", 140, y, { align: "right" });
    doc.text(`${cs}${Number(invoice.tax_amount).toFixed(2)}`, 180, y, { align: "right" });
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", 140, y, { align: "right" });
  doc.text(`${cs}${Number(invoice.total).toFixed(2)}`, 180, y, { align: "right" });
  y += 6;

  const amountPaid = Number(invoice.amount_paid || 0);
  if (amountPaid > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Amount Paid", 140, y, { align: "right" });
    doc.text(`${cs}${amountPaid.toFixed(2)}`, 180, y, { align: "right" });
    y += 5;
    const balance = Number(invoice.total) - amountPaid;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Balance Due", 140, y, { align: "right" });
    doc.text(`${cs}${balance.toFixed(2)}`, 180, y, { align: "right" });
    y += 6;
  }

  // Payment Instructions
  if (settings?.payment_instructions) {
    if (y > 245) { doc.addPage(); y = 20; }
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Payment Instructions", m, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const piLines = doc.splitTextToSize(settings.payment_instructions, 170);
    doc.text(piLines, m, y);
    y += piLines.length * 4 + 4;
  }

  // Notes
  if (invoice.notes) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Notes:", m, y); y += 4;
    const noteLines = doc.splitTextToSize(invoice.notes, 170);
    doc.text(noteLines, m, y);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
};
