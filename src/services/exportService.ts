/**
 * Export Service
 * Handles CSV and PDF export functionality for all data tables
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class ExportService {
  /**
   * Export data to CSV
   */
  static exportToCSV(
    data: any[],
    filename: string,
    columns: { key: string; label: string }[]
  ): void {
    try {
      // Create CSV header
      const headers = columns.map(col => col.label).join(',');
      
      // Create CSV rows
      const rows = data.map(item => {
        return columns.map(col => {
          const value = this.getNestedValue(item, col.key);
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value ?? '');
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',');
      }).join('\n');
      
      // Combine header and rows
      const csv = `${headers}\n${rows}`;
      
      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export CSV');
    }
  }

  /**
   * Export data to PDF
   */
  static exportToPDF(
    data: any[],
    filename: string,
    columns: { key: string; label: string }[],
    options: {
      title?: string;
      orientation?: 'portrait' | 'landscape';
      pageSize?: 'a4' | 'letter';
      showHeader?: boolean;
      showFooter?: boolean;
      companyName?: string;
    } = {}
  ): void {
    try {
      const {
        title = 'Export',
        orientation = 'landscape',
        pageSize = 'a4',
        showHeader = true,
        showFooter = true,
        companyName = 'Muhasib'
      } = options;

      // Create PDF document
      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: pageSize
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Add header
      if (showHeader) {
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(companyName, pageWidth / 2, 22, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });
        doc.setTextColor(0);
      }

      // Prepare table data
      const headers = [columns.map(col => col.label)];
      const body = data.map(item => 
        columns.map(col => {
          const value = this.getNestedValue(item, col.key);
          return this.formatValue(value);
        })
      );

      // Add table using autoTable
      autoTable(doc, {
        head: headers,
        body: body,
        startY: showHeader ? 32 : 10,
        theme: 'striped',
        headStyles: {
          fillColor: [99, 102, 241], // Primary color
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (data) => {
          // Add footer
          if (showFooter) {
            doc.setFontSize(8);
            doc.setTextColor(100);
            const pageNumber = doc.getCurrentPageInfo().pageNumber;
            const totalPages = (doc as any).internal.getNumberOfPages();
            doc.text(
              `Page ${pageNumber} of ${totalPages}`,
              pageWidth / 2,
              pageHeight - 10,
              { align: 'center' }
            );
            doc.setTextColor(0);
          }
        }
      });

      // Save PDF
      doc.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Failed to export PDF');
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Format value for display
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      if (value.name) return value.name;
      if (value.title) return value.title;
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
      // Format numbers with 2 decimal places if they have decimals
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }
    return String(value);
  }

  /**
   * Export invoices
   */
  static exportInvoices(invoices: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'customer.name', label: 'Customer' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'status', label: 'Status' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'tax_amount', label: 'Tax' },
      { key: 'total_amount', label: 'Total' },
      { key: 'balance_due', label: 'Balance Due' }
    ];

    const filename = `invoices_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(invoices, filename, columns);
    } else {
      this.exportToPDF(invoices, filename, columns, {
        title: 'Invoices Report',
        orientation: 'landscape'
      });
    }
  }

  /**
   * Export bills
   */
  static exportBills(bills: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'bill_number', label: 'Bill #' },
      { key: 'vendor.name', label: 'Vendor' },
      { key: 'bill_date', label: 'Date' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'status', label: 'Status' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'tax_amount', label: 'Tax' },
      { key: 'total_amount', label: 'Total' },
      { key: 'balance_due', label: 'Balance Due' }
    ];

    const filename = `bills_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(bills, filename, columns);
    } else {
      this.exportToPDF(bills, filename, columns, {
        title: 'Bills Report',
        orientation: 'landscape'
      });
    }
  }

  /**
   * Export customers
   */
  static exportCustomers(customers: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'company_name', label: 'Company' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'customer_type', label: 'Type' },
      { key: 'balance', label: 'Balance' },
      { key: 'credit_limit', label: 'Credit Limit' },
      { key: 'payment_terms', label: 'Payment Terms' }
    ];

    const filename = `customers_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(customers, filename, columns);
    } else {
      this.exportToPDF(customers, filename, columns, {
        title: 'Customers Report',
        orientation: 'portrait'
      });
    }
  }

  /**
   * Export vendors
   */
  static exportVendors(vendors: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'company_name', label: 'Company' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'vendor_type', label: 'Type' },
      { key: 'balance', label: 'Balance' },
      { key: 'payment_terms', label: 'Payment Terms' }
    ];

    const filename = `vendors_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(vendors, filename, columns);
    } else {
      this.exportToPDF(vendors, filename, columns, {
        title: 'Vendors Report',
        orientation: 'portrait'
      });
    }
  }

  /**
   * Export products
   */
  static exportProducts(products: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'type', label: 'Type' },
      { key: 'unit_price', label: 'Price' },
      { key: 'cost', label: 'Cost' },
      { key: 'quantity_on_hand', label: 'Qty On Hand' },
      { key: 'reorder_point', label: 'Reorder Point' },
      { key: 'track_inventory', label: 'Track Inventory' }
    ];

    const filename = `products_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(products, filename, columns);
    } else {
      this.exportToPDF(products, filename, columns, {
        title: 'Products Report',
        orientation: 'landscape'
      });
    }
  }

  /**
   * Export sales orders
   */
  static exportSalesOrders(orders: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'order_number', label: 'Order #' },
      { key: 'customer.name', label: 'Customer' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'expected_delivery_date', label: 'Expected Delivery' },
      { key: 'status', label: 'Status' },
      { key: 'total_amount', label: 'Total Amount' }
    ];

    const filename = `sales_orders_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(orders, filename, columns);
    } else {
      this.exportToPDF(orders, filename, columns, {
        title: 'Sales Orders Report',
        orientation: 'landscape'
      });
    }
  }

  /**
   * Export purchase orders
   */
  static exportPurchaseOrders(orders: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'order_number', label: 'Order #' },
      { key: 'vendor.name', label: 'Vendor' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'expected_delivery_date', label: 'Expected Delivery' },
      { key: 'status', label: 'Status' },
      { key: 'total_amount', label: 'Total Amount' }
    ];

    const filename = `purchase_orders_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(orders, filename, columns);
    } else {
      this.exportToPDF(orders, filename, columns, {
        title: 'Purchase Orders Report',
        orientation: 'landscape'
      });
    }
  }

  /**
   * Export transactions
   */
  static exportTransactions(transactions: any[], format: 'csv' | 'pdf'): void {
    const columns = [
      { key: 'transaction_date', label: 'Date' },
      { key: 'transaction_type', label: 'Type' },
      { key: 'description', label: 'Description' },
      { key: 'account.name', label: 'Account' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
      { key: 'reference_number', label: 'Reference' }
    ];

    const filename = `transactions_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      this.exportToCSV(transactions, filename, columns);
    } else {
      this.exportToPDF(transactions, filename, columns, {
        title: 'Transactions Report',
        orientation: 'landscape'
      });
    }
  }
}

