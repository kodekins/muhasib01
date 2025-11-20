import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Trash2, CheckCircle, Eye, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditMemoService } from '@/services';

interface CreditMemo {
  id: string;
  credit_memo_number: string;
  customer_id: string;
  invoice_id?: string;
  credit_memo_date: string;
  reason: string;
  total_amount: number;
  status: string;
  customer?: { name: string; company_name?: string };
  invoice?: { invoice_number: string };
}

interface CreditMemoLine {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id?: string;
}

export function CreditMemoManager() {
  const [creditMemos, setCreditMemos] = useState<CreditMemo[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCreditMemo, setSelectedCreditMemo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const [newCreditMemo, setNewCreditMemo] = useState({
    customer_id: '',
    invoice_id: '',
    credit_memo_date: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
    tax_rate: 0
  });

  const [lines, setLines] = useState<CreditMemoLine[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 }
  ]);

  useEffect(() => {
    fetchCreditMemos();
    fetchCustomers();
    fetchProducts();
    fetchAccounts();

    const channel = supabase
      .channel('credit-memo-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_memos' }, () => {
        fetchCreditMemos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const fetchCreditMemos = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await CreditMemoService.getCreditMemos(userData.user.id, {
        status: filter === 'all' ? undefined : filter
      });

      if (result.success) {
        setCreditMemos(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching credit memos:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('id, name, company_name')
        .eq('is_active', true)
        .order('name');
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchInvoicesForCustomer = async (customerId: string) => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, balance_due')
        .eq('customer_id', customerId)
        .in('status', ['sent', 'partial', 'overdue'])
        .order('created_at', { ascending: false });
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('products')
        .select('id, name, type, unit_price, income_account_id')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('user_id', userData.user.id)
        .eq('account_type', 'revenue')
        .eq('is_active', true)
        .order('code');
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    setNewCreditMemo(prev => ({ ...prev, customer_id: customerId, invoice_id: '' }));
    setInvoices([]);
    if (customerId) {
      fetchInvoicesForCustomer(customerId);
    }
  };

  const handleProductSelect = (lineIndex: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newLines = [...lines];
    newLines[lineIndex] = {
      ...newLines[lineIndex],
      product_id: productId,
      description: product.name,
      unit_price: product.unit_price || 0,
      account_id: product.income_account_id || undefined
    };

    const lineAmount = newLines[lineIndex].quantity * newLines[lineIndex].unit_price;
    newLines[lineIndex].amount = lineAmount;

    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      const lineAmount = newLines[index].quantity * newLines[index].unit_price;
      newLines[index].amount = lineAmount;
    }
    
    setLines(newLines);
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => sum + line.amount, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return subtotal * (newCreditMemo.tax_rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const submitCreditMemo = async () => {
    try {
      if (!newCreditMemo.customer_id) {
        toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
        return;
      }

      if (!newCreditMemo.reason.trim()) {
        toast({ title: 'Error', description: 'Please provide a reason for the credit memo', variant: 'destructive' });
        return;
      }

      if (lines.every(l => !l.description)) {
        toast({ title: 'Error', description: 'Please add at least one line item', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      setIsLoading(true);

      const validLines = lines.filter(l => l.description && l.amount > 0);

      const result = await CreditMemoService.createCreditMemo({
        user_id: userData.user.id,
        customer_id: newCreditMemo.customer_id,
        invoice_id: newCreditMemo.invoice_id || undefined,
        credit_memo_date: newCreditMemo.credit_memo_date,
        reason: newCreditMemo.reason,
        notes: newCreditMemo.notes,
        lines: validLines,
        subtotal: calculateSubtotal(),
        tax_amount: calculateTax(),
        total_amount: calculateTotal()
      });

      if (result.success) {
        toast({ title: 'Success', description: 'Credit memo created successfully!' });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchCreditMemos();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const issueCreditMemo = async (creditMemoId: string) => {
    try {
      setIsLoading(true);
      const result = await CreditMemoService.issueCreditMemo(creditMemoId);
      
      if (result.success) {
        toast({ title: 'Success', description: 'Credit memo issued and journal entry created!' });
        fetchCreditMemos();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const voidCreditMemo = async (creditMemoId: string) => {
    if (!confirm('Are you sure you want to void this credit memo? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const result = await CreditMemoService.voidCreditMemo(creditMemoId);
      
      if (result.success) {
        toast({ title: 'Success', description: 'Credit memo voided' });
        fetchCreditMemos();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCreditMemo = async (creditMemoId: string) => {
    if (!confirm('Are you sure you want to delete this credit memo?')) {
      return;
    }

    try {
      const result = await CreditMemoService.deleteCreditMemo(creditMemoId);
      
      if (result.success) {
        toast({ title: 'Success', description: 'Credit memo deleted' });
        fetchCreditMemos();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const viewCreditMemo = async (creditMemoId: string) => {
    try {
      const result = await CreditMemoService.getCreditMemoById(creditMemoId);
      
      if (result.success) {
        setSelectedCreditMemo(result.data);
        setIsViewDialogOpen(true);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setNewCreditMemo({
      customer_id: '',
      invoice_id: '',
      credit_memo_date: new Date().toISOString().split('T')[0],
      reason: '',
      notes: '',
      tax_rate: 0
    });
    setLines([{ description: '', quantity: 1, unit_price: 0, amount: 0 }]);
    setInvoices([]);
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'secondary',
      issued: 'default',
      void: 'destructive'
    };
    return colors[status] || 'default';
  };

  const filteredCreditMemos = filter === 'all' 
    ? creditMemos 
    : creditMemos.filter(cm => cm.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Credit Memos</h2>
          <p className="text-sm text-muted-foreground">
            {creditMemos.length} credit memos • Manage customer refunds and returns
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Credit Memo
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'draft', 'issued', 'void'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {creditMemos.filter(cm => cm.status === status).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Credit Memos List */}
      <div className="grid gap-4">
        {filteredCreditMemos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No credit memos found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first credit memo to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Credit Memo
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredCreditMemos.map((creditMemo) => (
            <Card key={creditMemo.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{creditMemo.credit_memo_number}</h3>
                      <Badge variant={getStatusColor(creditMemo.status)}>
                        {creditMemo.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <span className="ml-2 font-medium">
                          {creditMemo.customer?.name || creditMemo.customer?.company_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-2 font-medium">
                          {new Date(creditMemo.credit_memo_date).toLocaleDateString()}
                        </span>
                      </div>
                      {creditMemo.invoice && (
                        <div>
                          <span className="text-muted-foreground">Invoice:</span>
                          <span className="ml-2 font-medium">{creditMemo.invoice.invoice_number}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Reason:</span>
                        <span className="ml-2 font-medium">{creditMemo.reason}</span>
                      </div>
                    </div>

                    <div className="text-2xl font-bold">
                      ${creditMemo.total_amount.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => viewCreditMemo(creditMemo.id)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    {creditMemo.status === 'draft' && (
                      <>
                        <Button size="sm" onClick={() => issueCreditMemo(creditMemo.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Issue
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteCreditMemo(creditMemo.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {creditMemo.status === 'issued' && (
                      <Button size="sm" variant="outline" onClick={() => voidCreditMemo(creditMemo.id)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Void
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Credit Memo Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Credit Memo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select value={newCreditMemo.customer_id} onValueChange={handleCustomerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name || customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Related Invoice (Optional)</Label>
                <Select 
                  value={newCreditMemo.invoice_id} 
                  onValueChange={(value) => setNewCreditMemo(prev => ({ ...prev, invoice_id: value }))}
                  disabled={!newCreditMemo.customer_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {invoices.map(invoice => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - ${invoice.balance_due.toFixed(2)} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Credit Memo Date *</Label>
                <Input
                  type="date"
                  value={newCreditMemo.credit_memo_date}
                  onChange={(e) => setNewCreditMemo(prev => ({ ...prev, credit_memo_date: e.target.value }))}
                />
              </div>

              <div>
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newCreditMemo.tax_rate}
                  onChange={(e) => setNewCreditMemo(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div>
              <Label>Reason *</Label>
              <Select value={newCreditMemo.reason} onValueChange={(value) => setNewCreditMemo(prev => ({ ...prev, reason: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Product Return">Product Return</SelectItem>
                  <SelectItem value="Damaged Goods">Damaged Goods</SelectItem>
                  <SelectItem value="Billing Error">Billing Error</SelectItem>
                  <SelectItem value="Pricing Adjustment">Pricing Adjustment</SelectItem>
                  <SelectItem value="Customer Goodwill">Customer Goodwill</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Line Items</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Price</TableHead>
                    <TableHead className="w-40">Account</TableHead>
                    <TableHead className="w-28">Amount</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select 
                          value={line.product_id || 'none'} 
                          onValueChange={(value) => value !== 'none' && handleProductSelect(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Manual)</SelectItem>
                            {products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
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
                        <Select 
                          value={line.account_id || 'none'} 
                          onValueChange={(value) => updateLine(index, 'account_id', value === 'none' ? undefined : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Default</SelectItem>
                            {accounts.map(account => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">${line.amount.toFixed(2)}</div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={addLine} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>

            <div className="flex justify-end">
              <div className="text-right space-y-1">
                <div className="text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="ml-2 font-medium">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tax ({newCreditMemo.tax_rate}%):</span>
                  <span className="ml-2 font-medium">${calculateTax().toFixed(2)}</span>
                </div>
                <div className="text-2xl font-bold">${calculateTotal().toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={newCreditMemo.notes}
                onChange={(e) => setNewCreditMemo(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={submitCreditMemo} disabled={isLoading} className="flex-1">
                {isLoading ? 'Creating...' : 'Create Credit Memo'}
              </Button>
              <Button onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Credit Memo Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Credit Memo Details</DialogTitle>
          </DialogHeader>

          {selectedCreditMemo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Credit Memo Number</Label>
                  <div className="font-medium">{selectedCreditMemo.credit_memo_number}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={getStatusColor(selectedCreditMemo.status)}>
                    {selectedCreditMemo.status}
                  </Badge>
                </div>
                <div>
                  <Label>Customer</Label>
                  <div className="font-medium">
                    {selectedCreditMemo.customer?.name || selectedCreditMemo.customer?.company_name}
                  </div>
                </div>
                <div>
                  <Label>Date</Label>
                  <div className="font-medium">
                    {new Date(selectedCreditMemo.credit_memo_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <Label>Reason</Label>
                  <div className="font-medium">{selectedCreditMemo.reason}</div>
                </div>
                {selectedCreditMemo.invoice && (
                  <div>
                    <Label>Related Invoice</Label>
                    <div className="font-medium">{selectedCreditMemo.invoice.invoice_number}</div>
                  </div>
                )}
              </div>

              <div>
                <Label>Line Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCreditMemo.lines?.map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.description}</TableCell>
                        <TableCell>{line.quantity}</TableCell>
                        <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                        <TableCell>${line.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="text-right space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="ml-2 font-medium">${selectedCreditMemo.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tax:</span>
                    <span className="ml-2 font-medium">${selectedCreditMemo.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="text-2xl font-bold">${selectedCreditMemo.total_amount.toFixed(2)}</div>
                </div>
              </div>

              {selectedCreditMemo.notes && (
                <div>
                  <Label>Notes</Label>
                  <div className="p-3 bg-muted rounded-md">{selectedCreditMemo.notes}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

