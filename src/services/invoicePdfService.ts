/**
 * Invoice PDF Service
 * Handles PDF generation for invoices
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class InvoicePdfService {
  /**
   * Generate PDF for an invoice
   */
  static async generateInvoicePDF(invoice: any): Promise<void> {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header - Company Name
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pageWidth / 2, 20, { align: 'center' });

      // Invoice Details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Left side - Bill To
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', 20, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.customer?.name || 'Customer', 20, 46);
      if (invoice.customer?.company_name) {
        doc.text(invoice.customer.company_name, 20, 52);
      }
      if (invoice.customer?.email) {
        doc.text(invoice.customer.email, 20, 58);
      }

      // Right side - Invoice Info
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice #:', pageWidth - 70, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.invoice_number || 'N/A', pageWidth - 20, 40, { align: 'right' });
      
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', pageWidth - 70, 46);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(invoice.invoice_date).toLocaleDateString(), pageWidth - 20, 46, { align: 'right' });
      
      doc.setFont('helvetica', 'bold');
      doc.text('Due Date:', pageWidth - 70, 52);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(invoice.due_date).toLocaleDateString(), pageWidth - 20, 52, { align: 'right' });
      
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', pageWidth - 70, 58);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.status.toUpperCase(), pageWidth - 20, 58, { align: 'right' });

      // Line Items Table
      const tableData = invoice.lines?.map((line: any) => [
        line.description || '',
        line.quantity?.toString() || '0',
        `$${(line.unit_price || 0).toFixed(2)}`,
        `$${(line.amount || 0).toFixed(2)}`
      ]) || [];

      autoTable(doc, {
        startY: 70,
        head: [['Description', 'Quantity', 'Unit Price', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [99, 102, 241],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 10,
          cellPadding: 4
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' }
        }
      });

      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Totals section
      const totalsX = pageWidth - 70;
      let currentY = finalY;

      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, currentY);
      doc.text(`$${(invoice.subtotal || 0).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
      
      currentY += 6;
      if (invoice.discount_amount && invoice.discount_amount > 0) {
        doc.text('Discount:', totalsX, currentY);
        doc.text(`-$${(invoice.discount_amount || 0).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
        currentY += 6;
      }

      if (invoice.tax_amount && invoice.tax_amount > 0) {
        doc.text('Tax:', totalsX, currentY);
        doc.text(`$${(invoice.tax_amount || 0).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
        currentY += 6;
      }

      // Total line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Total:', totalsX, currentY);
      doc.text(`$${(invoice.total_amount || 0).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });

      // Amount Paid (if any)
      if (invoice.amount_paid && invoice.amount_paid > 0) {
        currentY += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Amount Paid:', totalsX, currentY);
        doc.text(`-$${(invoice.amount_paid || 0).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
        
        currentY += 6;
        doc.setFont('helvetica', 'bold');
        doc.text('Balance Due:', totalsX, currentY);
        doc.text(`$${(invoice.balance_due || 0).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
      }

      // Notes (if any)
      if (invoice.notes) {
        currentY += 15;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Notes:', 20, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(invoice.notes, 20, currentY + 6, { maxWidth: pageWidth - 40 });
      }

      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 20, { align: 'center' });

      // Save PDF
      doc.save(`${invoice.invoice_number || 'invoice'}.pdf`);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw new Error('Failed to generate invoice PDF');
    }
  }
}
