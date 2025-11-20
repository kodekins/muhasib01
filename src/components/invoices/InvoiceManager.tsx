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
import { Plus, FileText, Send, Trash2, DollarSign, Calendar, AlertCircle, Edit, Download, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceService, PaymentService, InventoryService } from '@/services';
import { InvoicePdfService } from '@/services/invoicePdfService';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  balance_due: number;
  customer?: { name: string; company_name?: string };
}

interface InvoiceLine {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate?: number;
  discount_percent?: number;
  account_id?: string;
}

export function InvoiceManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const [documentType, setDocumentType] = useState<'invoice' | 'quotation'>('invoice');
  const [newInvoice, setNewInvoice] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_rate: 0,
    discount_amount: 0,
    notes: ''
  });

  const [payment, setPayment] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: ''
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    type: 'product',
    description: '',
    unit_price: 0,
    cost: 0,
    income_account_id: '',
    taxable: true,
    tax_rate: 0,
    track_inventory: false,
    quantity_on_hand: 0,
    reorder_point: 10,
    unit_of_measure: 'unit'
  });

  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0, tax_rate: 0, discount_percent: 0 }
  ]);

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchAccounts();
    fetchProducts();

    // Real-time subscriptions
    const invoiceChannel = supabase
      .channel('invoice-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchInvoices();
      })
      .subscribe();

    const productChannel = supabase
      .channel('product-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(invoiceChannel);
      supabase.removeChannel(productChannel);
    };
  }, [filter]);

  const fetchInvoices = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await InvoiceService.getInvoices(userData.user.id, {
        status: filter === 'all' ? undefined : filter,
        overdue: filter === 'overdue' ? true : undefined
      });

      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
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

  const fetchAccounts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('accounts')
        .select('id, name, code, account_type')
        .eq('user_id', userData.user.id)
        .eq('account_type', 'revenue')
        .eq('is_active', true)
        .order('code');
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('products')
        .select('id, name, type, description, unit_price, income_account_id, taxable, tax_rate')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const selectProduct = (lineIndex: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newLines = [...lines];
    newLines[lineIndex] = {
      ...newLines[lineIndex],
      product_id: productId, // Store product_id for inventory tracking
      description: product.name,
      unit_price: product.unit_price,
      account_id: product.income_account_id || '',
      tax_rate: product.taxable ? product.tax_rate : 0
    };

    // Recalculate amount
    const lineAmount = newLines[lineIndex].quantity * newLines[lineIndex].unit_price;
    const discountAmount = lineAmount * ((newLines[lineIndex].discount_percent || 0) / 100);
    newLines[lineIndex].amount = lineAmount - discountAmount;

    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit_price: 0, amount: 0, tax_rate: 0, discount_percent: 0 }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Recalculate amount (includes line discount)
    if (field === 'quantity' || field === 'unit_price' || field === 'discount_percent') {
      const lineAmount = newLines[index].quantity * newLines[index].unit_price;
      const discountAmount = lineAmount * ((newLines[index].discount_percent || 0) / 100);
      newLines[index].amount = lineAmount - discountAmount;
    }
    
    setLines(newLines);
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => sum + line.amount, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return subtotal * (newInvoice.tax_rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - newInvoice.discount_amount;
  };

  const createInvoice = async () => {
    try {
      setIsLoading(true);

      if (!newInvoice.customer_id) {
        toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
        return;
      }

      if (lines.every(l => !l.description)) {
        toast({ title: 'Error', description: 'Please add at least one line item', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const validLines = lines.filter(l => l.description && l.amount > 0);
      
      if (editingInvoice) {
        // Update existing invoice
        const result = await InvoiceService.updateInvoice(editingInvoice.id, {
          customer_id: newInvoice.customer_id,
          invoice_date: newInvoice.invoice_date,
          due_date: newInvoice.due_date,
          notes: newInvoice.notes,
          lines: validLines,
          subtotal: calculateSubtotal(),
          tax_amount: calculateTax(),
          discount_amount: newInvoice.discount_amount,
          total_amount: calculateTotal(),
          balance_due: calculateTotal()
        });

        if (result.success) {
          toast({ title: 'Success', description: 'Invoice updated successfully!' });
          setIsCreateDialogOpen(false);
          resetForm();
          fetchInvoices();
        } else {
          toast({ 
            title: 'Error', 
            description: result.errors?.join(', ') || result.error, 
            variant: 'destructive' 
          });
        }
      } else {
        // Create new invoice or quotation
        const result = await InvoiceService.createInvoice({
          user_id: userData.user.id,
          customer_id: newInvoice.customer_id,
          document_type: documentType,
          invoice_date: newInvoice.invoice_date,
          due_date: newInvoice.due_date,
          notes: newInvoice.notes,
          lines: validLines,
          subtotal: calculateSubtotal(),
          tax_amount: calculateTax(),
          discount_amount: newInvoice.discount_amount,
          total_amount: calculateTotal(),
          balance_due: documentType === 'quotation' ? 0 : calculateTotal()
        }, { postJournalEntry: false });

        if (result.success) {
          const docType = documentType === 'quotation' ? 'Quotation' : 'Invoice';
          toast({ title: 'Success', description: `${docType} created successfully!` });
          setIsCreateDialogOpen(false);
          resetForm();
          fetchInvoices();
        } else {
          toast({ 
            title: 'Error', 
            description: result.errors?.join(', ') || result.error, 
            variant: 'destructive' 
          });
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const sendInvoice = async (invoiceId: string) => {
    try {
      const result = await InvoiceService.sendInvoice(invoiceId);
      if (result.success) {
        toast({ title: 'Success', description: 'Invoice sent and journal entry created!' });
        fetchInvoices();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const recordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPayment({
      amount: invoice.balance_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      reference_number: '',
      notes: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const submitPayment = async () => {
    if (!selectedInvoice) return;

    try {
      setIsLoading(true);
      const result = await PaymentService.recordInvoicePayment(
        selectedInvoice.id,
        {
          amount: payment.amount,
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          reference_number: payment.reference_number,
          notes: payment.notes
        }
      );

      if (result.success) {
        toast({ title: 'Success', description: 'Payment recorded and journal entry created!' });
        setIsPaymentDialogOpen(false);
        fetchInvoices();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openProductDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setNewProduct({
        name: product.name,
        sku: product.sku || '',
        type: product.type,
        description: product.description || '',
        unit_price: product.unit_price,
        cost: product.cost || 0,
        income_account_id: product.income_account_id || '',
        taxable: product.taxable,
        tax_rate: product.tax_rate || 0,
        track_inventory: product.track_inventory || false,
        quantity_on_hand: product.quantity_on_hand || 0,
        reorder_point: product.reorder_point || 10,
        unit_of_measure: product.unit_of_measure || 'unit'
      });
    } else {
      setEditingProduct(null);
      setNewProduct({
        name: '',
        sku: '',
        type: 'product',
        description: '',
        unit_price: 0,
        cost: 0,
        income_account_id: '',
        taxable: true,
        tax_rate: 0,
        track_inventory: false,
        quantity_on_hand: 0,
        reorder_point: 10,
        unit_of_measure: 'unit'
      });
    }
    setIsProductDialogOpen(true);
  };

  const saveProduct = async () => {
    try {
      setIsLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const productData = {
        ...newProduct,
        user_id: userData.user.id,
        is_active: true
      };

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Product updated!' });
      } else {
        // Create new product
        const { data: newProductData, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        // If tracking inventory and has starting quantity, record initial purchase
        if (newProductData && newProduct.track_inventory && newProduct.quantity_on_hand > 0) {
          const totalCost = newProduct.quantity_on_hand * newProduct.cost;
          
          await InventoryService.recordInventoryPurchase(
            userData.user.id,
            {
              product_id: newProductData.id,
              quantity: newProduct.quantity_on_hand,
              unit_cost: newProduct.cost,
              total_cost: totalCost,
              purchase_date: new Date().toISOString().split('T')[0],
              reference: `INITIAL-STOCK-${newProductData.id}`,
              notes: `Initial inventory for ${newProduct.name}`
            }
          );

          toast({ 
            title: 'Success', 
            description: `Product created with ${newProduct.quantity_on_hand} units in stock. Journal entry recorded.` 
          });
        } else {
          toast({ title: 'Success', description: 'Product created!' });
        }
      }

      setIsProductDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingInvoice(null);
    setDocumentType('invoice');
    setNewInvoice({
      customer_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tax_rate: 0,
      discount_amount: 0,
      notes: ''
    });
    setLines([{ description: '', quantity: 1, unit_price: 0, amount: 0, tax_rate: 0, discount_percent: 0 }]);
  };

  const convertToInvoice = async (quotationId: string) => {
    try {
      setIsLoading(true);
      const result = await InvoiceService.convertQuotationToInvoice(quotationId);
      
      if (result.success) {
        toast({ title: 'Success', description: 'Quotation converted to invoice successfully!' });
        fetchInvoices();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditInvoice = async (invoice: Invoice) => {
    try {
      // Fetch full invoice with lines
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lines:invoice_lines(*)')
        .eq('id', invoice.id)
        .single();

      if (error) throw error;

      setEditingInvoice(data);
      setDocumentType(data.document_type || 'invoice');
      setNewInvoice({
        customer_id: data.customer_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        tax_rate: data.tax_amount && data.subtotal ? (data.tax_amount / data.subtotal) * 100 : 0,
        discount_amount: data.discount_amount || 0,
        notes: data.notes || ''
      });

      if (data.lines && data.lines.length > 0) {
        setLines(data.lines.map((line: any) => ({
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
          tax_rate: line.tax_rate || 0,
          discount_percent: line.discount_percent || 0,
          account_id: line.account_id
        })));
      }

      setIsCreateDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      // Fetch full invoice with lines and customer info
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lines:invoice_lines(*), customer:customers(*)')
        .eq('id', invoice.id)
        .single();

      if (error) throw error;

      await InvoicePdfService.generateInvoicePDF(data);
      toast({ title: 'Success', description: 'Invoice downloaded successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const viewInvoice = async (invoice: Invoice) => {
    try {
      // Fetch full invoice with lines and customer info
      const { data, error } = await supabase
        .from('invoices')
        .select('*, lines:invoice_lines(*), customer:customers(*)')
        .eq('id', invoice.id)
        .single();

      if (error) throw error;

      setViewingInvoice(data);
      setIsViewDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'secondary',
      sent: 'default',
      viewed: 'default',
      partial: 'warning',
      paid: 'success',
      overdue: 'destructive',
      void: 'outline',
      accepted: 'success',
      declined: 'destructive'
    };
    return colors[status] || 'default';
  };

  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'void')
    .reduce((sum, i) => sum + i.balance_due, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Invoices & Quotations</h2>
          <p className="text-sm text-muted-foreground">
            {invoices.length} document(s) • ${totalOutstanding.toFixed(2)} outstanding
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setDocumentType('invoice'); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInvoice 
                  ? `Edit ${documentType === 'quotation' ? 'Quotation' : 'Invoice'}` 
                  : `Create New ${documentType === 'quotation' ? 'Quotation' : 'Invoice'}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Document Type Selection (only for new documents) */}
              {!editingInvoice && (
                <div>
                  <Label>Document Type</Label>
                  <Select value={documentType} onValueChange={(value: 'invoice' | 'quotation') => setDocumentType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice (affects accounts & balances)</SelectItem>
                      <SelectItem value="quotation">Quotation (no accounting impact)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Customer Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer *</Label>
                  <Select value={newInvoice.customer_id} onValueChange={(value) => 
                    setNewInvoice(prev => ({ ...prev, customer_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.company_name && `(${c.company_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{documentType === 'quotation' ? 'Quotation Date' : 'Invoice Date'}</Label>
                    <Input
                      type="date"
                      value={newInvoice.invoice_date}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{documentType === 'quotation' ? 'Valid Until' : 'Due Date'}</Label>
                    <Input
                      type="date"
                      value={newInvoice.due_date}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Line Items</Label>
                  <Button onClick={() => openProductDialog()} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Product/Service
                  </Button>
                </div>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Product/Service</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-32">Revenue Account</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-24">Price</TableHead>
                        <TableHead className="w-20">Disc%</TableHead>
                        <TableHead className="w-24">Amount</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select value="" onValueChange={(value) => selectProduct(index, value)}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">PRODUCTS</div>
                                {products.filter(p => p.type === 'product').map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} - ${p.unit_price.toFixed(2)}
                                  </SelectItem>
                                ))}
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1">SERVICES</div>
                                {products.filter(p => p.type === 'service').map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} - ${p.unit_price.toFixed(2)}
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
                              className="min-w-[180px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={line.account_id || ''} onValueChange={(value) => updateLine(index, 'account_id', value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map(a => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.unit_price}
                              onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              value={line.discount_percent || 0}
                              onChange={(e) => updateLine(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                              className="w-20"
                              placeholder="0"
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
                </div>
                <Button onClick={addLine} variant="outline" size="sm" className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              {/* Totals Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label>Tax Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newInvoice.tax_rate}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <Label>Invoice Discount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newInvoice.discount_amount}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {newInvoice.tax_rate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({newInvoice.tax_rate}%):</span>
                      <span className="font-medium">${calculateTax().toFixed(2)}</span>
                    </div>
                  )}
                  {newInvoice.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount:</span>
                      <span>-${newInvoice.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={createInvoice} disabled={isLoading} className="flex-1">
                  {isLoading 
                    ? (editingInvoice ? 'Updating...' : 'Creating...') 
                    : (editingInvoice 
                        ? `Update ${documentType === 'quotation' ? 'Quotation' : 'Invoice'}` 
                        : `Create ${documentType === 'quotation' ? 'Quotation' : 'Invoice'}`)}
                </Button>
                <Button onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        <Button onClick={() => { resetForm(); setDocumentType('quotation'); setIsCreateDialogOpen(true); }} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          New Quotation
        </Button>
        </div>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoice:</span>
                    <span className="font-medium">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium">${selectedInvoice.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Balance Due:</span>
                    <span className="font-bold text-lg">${selectedInvoice.balance_due.toFixed(2)}</span>
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
                    max={selectedInvoice.balance_due}
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
                  <Select value={payment.payment_method} onValueChange={(value) => setPayment(prev => ({ ...prev, payment_method: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="wire">Wire Transfer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reference Number</Label>
                  <Input
                    value={payment.reference_number}
                    onChange={(e) => setPayment(prev => ({ ...prev, reference_number: e.target.value }))}
                    placeholder="Check #, Transaction ID, etc."
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={payment.notes}
                    onChange={(e) => setPayment(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={submitPayment} disabled={isLoading || payment.amount <= 0} className="flex-1">
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

        {/* Product/Service Dialog */}
        <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Product/Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Product or service name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={newProduct.type} onValueChange={(value) => setNewProduct(prev => ({ ...prev, type: value, track_inventory: value === 'product' }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product (Inventory)</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>SKU</Label>
                  <Input
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="SKU-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newProduct.unit_price}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Cost Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {newProduct.type === 'product' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Initial Quantity</Label>
                    <Input
                      type="number"
                      value={newProduct.quantity_on_hand}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, quantity_on_hand: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Reorder Point</Label>
                    <Input
                      type="number"
                      value={newProduct.reorder_point}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, reorder_point: parseFloat(e.target.value) || 0 }))}
                      placeholder="10"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>Unit of Measure</Label>
                <Select value={newProduct.unit_of_measure} onValueChange={(value) => setNewProduct(prev => ({ ...prev, unit_of_measure: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="lb">Pound (lb)</SelectItem>
                    <SelectItem value="liter">Liter</SelectItem>
                    <SelectItem value="gallon">Gallon</SelectItem>
                    <SelectItem value="meter">Meter</SelectItem>
                    <SelectItem value="hour">Hour</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveProduct} disabled={isLoading || !newProduct.name || !newProduct.unit_price} className="flex-1">
                  {isLoading ? 'Creating...' : 'Create Product'}
                </Button>
                <Button onClick={() => setIsProductDialogOpen(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Invoice/Quotation Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {viewingInvoice?.document_type === 'quotation' ? 'Quotation Details' : 'Invoice Details'}
              </DialogTitle>
            </DialogHeader>
            {viewingInvoice && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">
                      {viewingInvoice.document_type === 'quotation' ? 'Quotation' : 'Invoice'} Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Number:</span>
                        <span className="font-medium">
                          {viewingInvoice.document_type === 'quotation' 
                            ? viewingInvoice.quotation_number 
                            : viewingInvoice.invoice_number}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={getStatusColor(viewingInvoice.status) as any}>
                          {viewingInvoice.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">
                          {new Date(viewingInvoice.invoice_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {viewingInvoice.document_type === 'quotation' ? 'Valid Until:' : 'Due Date:'}
                        </span>
                        <span className="font-medium">
                          {new Date(viewingInvoice.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">Customer Information</h3>
                    <div className="space-y-2 text-sm">
                      {viewingInvoice.customer?.company_name && (
                        <div>
                          <span className="text-muted-foreground">Company:</span>
                          <div className="font-medium">{viewingInvoice.customer.company_name}</div>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <div className="font-medium">{viewingInvoice.customer?.name}</div>
                      </div>
                      {viewingInvoice.customer?.email && (
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <div className="font-medium">{viewingInvoice.customer.email}</div>
                        </div>
                      )}
                      {viewingInvoice.customer?.phone && (
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <div className="font-medium">{viewingInvoice.customer.phone}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Line Items</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-center">Discount</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingInvoice.lines?.map((line: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{line.description}</TableCell>
                            <TableCell className="text-center">{line.quantity}</TableCell>
                            <TableCell className="text-right">${line.unit_price.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {line.discount_percent ? `${line.discount_percent}%` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${line.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">${viewingInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    {viewingInvoice.tax_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax:</span>
                        <span className="font-medium">${viewingInvoice.tax_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {viewingInvoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Discount:</span>
                        <span>-${viewingInvoice.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span>${viewingInvoice.total_amount.toFixed(2)}</span>
                    </div>
                    {viewingInvoice.document_type !== 'quotation' && (
                      <>
                        {viewingInvoice.amount_paid > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Amount Paid:</span>
                            <span className="font-medium">${viewingInvoice.amount_paid.toFixed(2)}</span>
                          </div>
                        )}
                        {viewingInvoice.balance_due > 0 && (
                          <div className="flex justify-between text-lg font-bold text-red-600 pt-2 border-t">
                            <span>Balance Due:</span>
                            <span>${viewingInvoice.balance_due.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {viewingInvoice.notes && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {viewingInvoice.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button 
                    onClick={() => downloadInvoice(viewingInvoice)} 
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button onClick={() => setIsViewDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'partial', 'paid', 'overdue'].map((status) => (
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

      {/* Invoice List */}
      <div className="space-y-3">
        {invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">
                        {(invoice as any).document_type === 'quotation' 
                          ? (invoice as any).quotation_number 
                          : invoice.invoice_number}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {invoice.customer?.name || invoice.customer?.company_name}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-semibold">${invoice.total_amount.toFixed(2)}</div>
                    {invoice.balance_due > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ${invoice.balance_due.toFixed(2)} due
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{new Date(invoice.due_date).toLocaleDateString()}</span>
                  </div>

                  <Badge variant={getStatusColor(invoice.status) as any}>
                    {invoice.status}
                  </Badge>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => viewInvoice(invoice)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => downloadInvoice(invoice)}
                      title={`Download ${(invoice as any).document_type === 'quotation' ? 'Quotation' : 'Invoice'} PDF`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    {/* Quotation actions */}
                    {(invoice as any).document_type === 'quotation' && (
                      <>
                        {invoice.status === 'draft' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEditInvoice(invoice)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => sendInvoice(invoice.id)}>
                              <Send className="h-4 w-4 mr-1" />
                              Send
                            </Button>
                          </>
                        )}
                        {!(invoice as any).converted_to_invoice_id && invoice.status !== 'declined' && (
                          <Button 
                            size="sm" 
                            variant="default" 
                            onClick={() => convertToInvoice(invoice.id)}
                            title="Convert to Invoice"
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Convert
                          </Button>
                        )}
                      </>
                    )}
                    
                    {/* Invoice actions */}
                    {(invoice as any).document_type !== 'quotation' && (
                      <>
                        {invoice.status === 'draft' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEditInvoice(invoice)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => sendInvoice(invoice.id)}>
                              <Send className="h-4 w-4 mr-1" />
                              Send
                            </Button>
                          </>
                        )}
                        {invoice.balance_due > 0 && invoice.status !== 'draft' && (
                          <Button size="sm" variant="outline" onClick={() => recordPayment(invoice)}>
                            <DollarSign className="h-4 w-4 mr-1" />
                            Record Payment
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {invoices.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invoices Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first invoice to start tracking receivables.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Invoice
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

