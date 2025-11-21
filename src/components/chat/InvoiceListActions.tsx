/**
 * Invoice List Actions Component
 * Shows interactive actions for invoices in chat lists
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Send, Edit, Eye, FileText } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  customer?: { name: string };
  total_amount: number;
  status: string;
  invoice_date: string;
  due_date: string;
}

interface InvoiceListActionsProps {
  invoices: Invoice[];
  onSend: (invoiceNumber: string) => void;
  onEdit: (invoiceNumber: string) => void;
  onView: (invoiceNumber: string) => void;
}

export function InvoiceListActions({ invoices, onSend, onEdit, onView }: InvoiceListActionsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'sent': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'paid': return 'text-green-600 bg-green-50 border-green-200';
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200';
      case 'partial': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-3 my-4">
      {invoices.map((invoice) => (
        <Card key={invoice.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-4">
            {/* Invoice Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold text-sm">{invoice.invoice_number}</span>
                <span 
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(invoice.status)}`}
                >
                  {invoice.status}
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground truncate">
                {invoice.customer?.name || 'Unknown Customer'}
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>Due: {formatDate(invoice.due_date)}</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(invoice.invoice_number)}
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              {invoice.status === 'draft' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(invoice.invoice_number)}
                    title="Edit Invoice"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onSend(invoice.invoice_number)}
                    title="Send Invoice"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              {invoice.status === 'sent' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(invoice.invoice_number)}
                  title="Edit Invoice"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}


