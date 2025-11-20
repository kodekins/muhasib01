import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Receipt, CheckCircle, Trash2, DollarSign, Calendar, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BillService, PaymentService, ExportService } from '@/services';
import { ExportButton } from '@/components/ui/export-button';

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  bill_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  balance_due: number;
  vendor?: { name: string; company_name?: string };
}

interface BillLine {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id?: string;
}

export function BillManager() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const [newBill, setNewBill] = useState({
    vendor_id: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ''
  });

  const [lines, setLines] = useState<BillLine[]>([
    { product_id: undefined, description: '', quantity: 1, unit_price: 0, amount: 0, account_id: undefined }
  ]);

  const [payment, setPayment] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    bank_account_id: '',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchBills();
    fetchVendors();
    fetchProducts();
    fetchBankAccounts();

    // Real-time subscription
    const channel = supabase
      .channel('bill-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
        fetchBills();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const fetchBills = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await BillService.getBills(userData.user.id, {
        status: filter === 'all' ? undefined : filter,
        overdue: filter === 'overdue' ? true : undefined
      });

      if (result.success) {
        setBills(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const { data } = await supabase
        .from('vendors')
        .select('id, name, company_name')
        .eq('is_active', true)
        .order('name');
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('products')
        .select('id, name, sku, type, cost, unit_of_measure')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('accounts')
        .select('id, code, name, account_type')
        .eq('user_id', userData.user.id)
        .eq('account_type', 'asset')
        .in('code', ['1010', '1011', '1020', '1021']) // Common cash/bank account codes
        .eq('is_active', true)
        .order('code');
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (productId === 'none') {
      // Manual entry - clear product selection
      const updatedLines = [...lines];
      updatedLines[index] = {
        ...updatedLines[index],
        product_id: undefined,
        description: '',
        unit_price: 0,
        amount: 0
      };
      setLines(updatedLines);
    } else {
      const product = products.find(p => p.id === productId);
      if (product) {
        const updatedLines = [...lines];
        updatedLines[index] = {
          ...updatedLines[index],
          product_id: productId,
          description: product.name,
          unit_price: product.cost || 0,
          amount: updatedLines[index].quantity * (product.cost || 0)
        };
        setLines(updatedLines);
      }
    }
  };

  const addLine = () => {
    setLines([...lines, { product_id: undefined, description: '', quantity: 1, unit_price: 0, amount: 0, account_id: undefined }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      newLines[index].amount = newLines[index].quantity * newLines[index].unit_price;
    }
    
    setLines(newLines);
  };

  const calculateTotal = () => {
    return lines.reduce((sum, line) => sum + line.amount, 0);
  };

  const openEditBill = async (bill: Bill) => {
    try {
      // Fetch bill lines
      const { data: billLines, error } = await supabase
        .from('bill_lines')
        .select('*')
        .eq('bill_id', bill.id);

      if (error) throw error;

      setEditingBill(bill);
      setNewBill({
        vendor_id: bill.vendor_id,
        bill_date: bill.bill_date,
        due_date: bill.due_date,
        notes: ''
      });
      setLines(billLines?.map(line => ({
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        account_id: line.account_id
      })) || []);
      setIsCreateDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load bill details', variant: 'destructive' });
    }
  };

  const createBill = async () => {
    try {
      setIsLoading(true);

      if (!newBill.vendor_id) {
        toast({ title: 'Error', description: 'Please select a vendor', variant: 'destructive' });
        return;
      }

      if (lines.every(l => !l.description)) {
        toast({ title: 'Error', description: 'Please add at least one line item', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const validLines = lines.filter(l => l.description && l.amount > 0);
      
      if (editingBill) {
        // Update existing bill
        const { error: billError } = await supabase
          .from('bills')
          .update({
            vendor_id: newBill.vendor_id,
            bill_date: newBill.bill_date,
            due_date: newBill.due_date,
            subtotal: calculateTotal(),
            total_amount: calculateTotal(),
            balance_due: calculateTotal(),
            notes: newBill.notes
          })
          .eq('id', editingBill.id);

        if (billError) throw billError;

        // Delete old lines
        await supabase
          .from('bill_lines')
          .delete()
          .eq('bill_id', editingBill.id);

        // Insert new lines
        const { error: linesError } = await supabase
          .from('bill_lines')
          .insert(validLines.map(line => ({
            bill_id: editingBill.id,
            product_id: line.product_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            amount: line.amount,
            account_id: line.account_id
          })));

        if (linesError) throw linesError;

        toast({ title: 'Success', description: 'Bill updated successfully!' });
      } else {
        // Create new bill
        const result = await BillService.createBill({
          user_id: userData.user.id,
          vendor_id: newBill.vendor_id,
          bill_date: newBill.bill_date,
          due_date: newBill.due_date,
          notes: newBill.notes,
          lines: validLines,
          subtotal: calculateTotal(),
          tax_amount: 0,
          total_amount: calculateTotal(),
          balance_due: calculateTotal()
        }, { postJournalEntry: false });

        if (!result.success) {
          toast({ 
            title: 'Error', 
            description: result.errors?.join(', ') || result.error, 
            variant: 'destructive' 
          });
          return;
        }

        toast({ title: 'Success', description: 'Bill created successfully!' });
      }

      setIsCreateDialogOpen(false);
      resetForm();
      fetchBills();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const approveBill = async (billId: string) => {
    try {
      const result = await BillService.approveBill(billId);
      if (result.success) {
        toast({ title: 'Success', description: 'Bill approved and journal entry created!' });
        fetchBills();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openPaymentDialog = (bill: Bill) => {
    setSelectedBill(bill);
    setPayment({
      amount: bill.balance_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      bank_account_id: bankAccounts.length > 0 ? bankAccounts[0].id : '',
      reference_number: '',
      notes: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const recordPayment = async () => {
    if (!selectedBill) return;

    try {
      setIsLoading(true);

      const result = await PaymentService.recordBillPayment(selectedBill.id, {
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        bank_account_id: payment.bank_account_id,
        reference_number: payment.reference_number,
        notes: payment.notes
      });

      if (result.success) {
        toast({ title: 'Success', description: 'Payment recorded and journal entry created!' });
        setIsPaymentDialogOpen(false);
        setSelectedBill(null);
        fetchBills();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingBill(null);
    setNewBill({
      vendor_id: '',
      bill_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: ''
    });
    setLines([{ product_id: undefined, description: '', quantity: 1, unit_price: 0, amount: 0, account_id: undefined }]);
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'secondary',
      pending: 'default',
      approved: 'default',
      partial: 'warning',
      paid: 'success',
      overdue: 'destructive',
      void: 'outline'
    };
    return colors[status] || 'default';
  };

  const totalPayable = bills
    .filter(b => b.status !== 'paid' && b.status !== 'void')
    .reduce((sum, b) => sum + b.balance_due, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Bills</h2>
          <p className="text-sm text-muted-foreground">
            {bills.length} bills • ${totalPayable.toFixed(2)} payable
          </p>
        </div>
        <div className="flex gap-2">
          {/* Export Button */}
          <ExportButton
            data={bills}
            onExport={(data, format) => {
              ExportService.exportBills(data, format);
            }}
          />
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Bill
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBill ? 'Edit Bill' : 'Create New Bill'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Vendor Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor *</Label>
                  <Select value={newBill.vendor_id} onValueChange={(value) => 
                    setNewBill(prev => ({ ...prev, vendor_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} {v.company_name && `(${v.company_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Bill Date</Label>
                    <Input
                      type="date"
                      value={newBill.bill_date}
                      onChange={(e) => setNewBill(prev => ({ ...prev, bill_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newBill.due_date}
                      onChange={(e) => setNewBill(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <Label>Line Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Product</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Cost</TableHead>
                      <TableHead className="w-32">Amount</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select 
                            value={line.product_id || 'none'} 
                            onValueChange={(value) => handleProductSelect(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Manual)</SelectItem>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} {product.sku ? `(${product.sku})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="Description"
                            disabled={!!line.product_id}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">${line.amount.toFixed(2)}</div>
                        </TableCell>
                        <TableCell>
                          {lines.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLine(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button onClick={addLine} variant="outline" size="sm" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-2xl font-bold">${calculateTotal().toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={newBill.notes}
                  onChange={(e) => setNewBill(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={createBill} disabled={isLoading} className="flex-1">
                  {isLoading ? (editingBill ? 'Updating...' : 'Creating...') : (editingBill ? 'Update Bill' : 'Create Bill')}
                </Button>
                <Button onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {selectedBill && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bill:</span>
                    <span className="font-medium">{selectedBill.bill_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="font-medium">{selectedBill.vendor?.name || selectedBill.vendor?.company_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium">${selectedBill.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Balance Due:</span>
                    <span className="font-bold text-lg">${selectedBill.balance_due.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <Label>Payment Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={payment.amount}
                    onChange={(e) => setPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    max={selectedBill.balance_due}
                  />
                </div>

                <div>
                  <Label>Payment Date *</Label>
                  <Input
                    type="date"
                    value={payment.payment_date}
                    onChange={(e) => setPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Payment Method *</Label>
                  <Select 
                    value={payment.payment_method}
                    onValueChange={(value) => setPayment(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Pay From Account *</Label>
                  <Select 
                    value={payment.bank_account_id} 
                    onValueChange={(value) => setPayment(prev => ({ ...prev, bank_account_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Which account is this payment coming from?
                  </p>
                </div>

                <div>
                  <Label>Reference Number</Label>
                  <Input
                    value={payment.reference_number}
                    onChange={(e) => setPayment(prev => ({ ...prev, reference_number: e.target.value }))}
                    placeholder="Check number, transaction ID, etc."
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={payment.notes}
                    onChange={(e) => setPayment(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional payment notes..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={recordPayment} disabled={isLoading || payment.amount <= 0 || !payment.bank_account_id} className="flex-1">
                    {isLoading ? 'Recording...' : 'Record Payment'}
                  </Button>
                  <Button onClick={() => setIsPaymentDialogOpen(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'draft', 'pending', 'approved', 'partial', 'paid', 'overdue'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Bill List */}
      <div className="space-y-3">
        {bills.map((bill) => (
          <Card key={bill.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">{bill.bill_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {bill.vendor?.name || bill.vendor?.company_name}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-semibold">${bill.total_amount.toFixed(2)}</div>
                    {bill.balance_due > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ${bill.balance_due.toFixed(2)} due
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{new Date(bill.due_date).toLocaleDateString()}</span>
                  </div>

                  <Badge variant={getStatusColor(bill.status) as any}>
                    {bill.status}
                  </Badge>

                  <div className="flex gap-2">
                    {bill.status === 'draft' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEditBill(bill)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => approveBill(bill.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </>
                    )}
                    {bill.status === 'pending' && (
                      <Button size="sm" onClick={() => approveBill(bill.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    {bill.balance_due > 0 && (bill.status === 'open' || bill.status === 'overdue') && (
                      <Button size="sm" variant="outline" onClick={() => openPaymentDialog(bill)}>
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pay Bill
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {bills.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Bills Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first bill to start tracking payables.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Bill
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

