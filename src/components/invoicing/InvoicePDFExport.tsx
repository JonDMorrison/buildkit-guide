import jsPDF from "jspdf";
import type { Invoice, InvoiceLineItem, InvoiceSettings, Client } from "@/types/invoicing";
import { format } from "date-fns";

/**
 * Generate and download an invoice PDF.
 */
export const generateInvoicePDF = (
  invoice: Invoice,
  lineItems: InvoiceLineItem[],
  settings: InvoiceSettings | null,
  client: Client | null,
) => {
  const doc = new jsPDF();
  const m = 14;
  let y = 20;

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
    doc.text(`$${Number(li.unit_price).toFixed(2)}`, 140, y, { align: "right" });
    doc.text(`$${Number(li.amount).toFixed(2)}`, 180, y, { align: "right" });
    y += 5;
  }

  y += 3;
  // Totals
  doc.text("Subtotal", 140, y, { align: "right" });
  doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, 180, y, { align: "right" });
  y += 5;

  if (Number(invoice.tax_amount) > 0) {
    doc.text(settings?.tax_label || "Tax", 140, y, { align: "right" });
    doc.text(`$${Number(invoice.tax_amount).toFixed(2)}`, 180, y, { align: "right" });
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", 140, y, { align: "right" });
  doc.text(`$${Number(invoice.total).toFixed(2)}`, 180, y, { align: "right" });
  y += 6;

  // Payments / balance
  const amountPaid = Number(invoice.amount_paid || 0);
  if (amountPaid > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Amount Paid", 140, y, { align: "right" });
    doc.text(`$${amountPaid.toFixed(2)}`, 180, y, { align: "right" });
    y += 5;
    const balance = Number(invoice.total) - amountPaid;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Balance Due", 140, y, { align: "right" });
    doc.text(`$${balance.toFixed(2)}`, 180, y, { align: "right" });
    y += 6;
  }

  // Notes
  if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Notes:", m, y); y += 4;
    const noteLines = doc.splitTextToSize(invoice.notes, 170);
    doc.text(noteLines, m, y);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
};
