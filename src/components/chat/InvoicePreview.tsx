/**
 * InvoicePreview Component
 * Shows a preview of invoice before creation with edit and confirm options
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Edit, Check, X } from 'lucide-react';

interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoicePreviewData {
  customer_id: string;
  customer_name?: string;
  invoice_date: string;
  due_date: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax_amount?: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string;
}

interface InvoicePreviewProps {
  data: InvoicePreviewData;
  onConfirm: () => void;
  onCancel: () => void;
  message: string;
  isEdit?: boolean;
}

export function InvoicePreview({ data, onConfirm, onCancel, message, isEdit = false }: InvoicePreviewProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<InvoicePreviewData>(data);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleLineChange = (index: number, field: keyof InvoiceLine, value: any) => {
    const newLines = [...editedData.lines];
    newLines[index] = {
      ...newLines[index],
      [field]: value
    };

    // Recalculate amount if quantity or unit_price changes
    if (field === 'quantity' || field === 'unit_price') {
      newLines[index].amount = newLines[index].quantity * newLines[index].unit_price;
    }

    // Recalculate totals
    const subtotal = newLines.reduce((sum, line) => sum + line.amount, 0);
    const total_amount = subtotal + (editedData.tax_amount || 0) - (editedData.discount_amount || 0);

    setEditedData({
      ...editedData,
      lines: newLines,
      subtotal,
      total_amount
    });
  };

  const handleAddLine = () => {
    setEditedData({
      ...editedData,
      lines: [
        ...editedData.lines,
        { description: '', quantity: 1, unit_price: 0, amount: 0 }
      ]
    });
  };

  const handleRemoveLine = (index: number) => {
    const newLines = editedData.lines.filter((_, i) => i !== index);
    const subtotal = newLines.reduce((sum, line) => sum + line.amount, 0);
    const total_amount = subtotal + (editedData.tax_amount || 0) - (editedData.discount_amount || 0);

    setEditedData({
      ...editedData,
      lines: newLines,
      subtotal,
      total_amount
    });
  };

  return (
    <div className="my-4">
      {/* AI Message */}
      <div className="mb-4 p-3 bg-muted rounded-lg text-sm whitespace-pre-line">
        {message}
      </div>

      {/* Invoice Preview Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-primary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {isEdit ? 'Edit Invoice' : 'Invoice Preview'}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Done Editing
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {editMode ? (
            <div className="space-y-4">
              {/* Customer */}
              <div>
                <Label>Customer</Label>
                <Input
                  value={editedData.customer_name || 'Loading...'}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={editedData.invoice_date}
                    onChange={(e) => setEditedData({ ...editedData, invoice_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={editedData.due_date}
                    onChange={(e) => setEditedData({ ...editedData, due_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <Label className="mb-2 block">Line Items</Label>
                <div className="space-y-3">
                  {editedData.lines.map((line, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                          <Input
                            value={formatCurrency(line.amount)}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLine(index)}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="mt-2"
                >
                  + Add Line Item
                </Button>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={editedData.notes || ''}
                  onChange={(e) => setEditedData({ ...editedData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Display Mode */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{data.customer_name || 'Unknown Customer'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{formatDate(data.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(data.due_date)}</p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <div className="space-y-2">
                  {data.lines.map((line, index) => (
                    <div key={index} className="flex justify-between items-start p-3 bg-muted/50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{line.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {line.quantity} × {formatCurrency(line.unit_price)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(line.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(data.subtotal)}</span>
                </div>
                {(data.tax_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(data.tax_amount || 0)}</span>
                  </div>
                )}
                {(data.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">-{formatCurrency(data.discount_amount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(data.total_amount)}</span>
                </div>
              </div>

              {data.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{data.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t">
            <Button
              onClick={onConfirm}
              className="flex-1"
              size="lg"
            >
              <Check className="h-4 w-4 mr-2" />
              {isEdit ? 'Confirm & Update Invoice' : 'Confirm & Create Invoice'}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              size="lg"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

