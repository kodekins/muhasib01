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
import { Plus, FileText, Trash2, Calendar, Eye, Edit, Download, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PurchaseOrderService, ExportService } from '@/services';
import { ExportButton } from '@/components/ui/export-button';

interface PurchaseOrder {
  id: string;
  order_number: string;
  vendor_id: string;
  order_date: string;
  expected_delivery_date?: string;
  status: string;
  total_amount: number;
  vendor?: { name: string; company_name?: string };
  converted_bill_id?: string;
}

interface PurchaseOrderLine {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id?: string;
}

export function PurchaseOrderManager() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const [newOrder, setNewOrder] = useState({
    vendor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    notes: '',
    terms: '',
    shipping_address: ''
  });

  const [lines, setLines] = useState<PurchaseOrderLine[]>([
    { product_id: undefined, description: '', quantity: 1, unit_price: 0, amount: 0, account_id: undefined }
  ]);

  useEffect(() => {
    fetchOrders();
    fetchVendors();
    fetchProducts();
    fetchAccounts();

    const channel = supabase
      .channel('purchase-order-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const fetchOrders = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await PurchaseOrderService.getPurchaseOrders(userData.user.id, {
        status: filter === 'all' ? undefined : filter
      });

      if (result.success) {
        setOrders(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
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
        .select('id, name, sku, cost, type, expense_account_id')
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
        .in('account_type', ['expense', 'asset'])
        .order('code');
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (productId === 'none') {
      const updatedLines = [...lines];
      updatedLines[index] = {
        ...updatedLines[index],
        product_id: undefined,
        description: '',
        unit_price: 0,
        amount: 0,
        account_id: undefined
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
          amount: updatedLines[index].quantity * (product.cost || 0),
          account_id: product.expense_account_id || undefined
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

  const openEditOrder = async (order: PurchaseOrder) => {
    try {
      const { data: orderLines, error } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', order.id)
        .order('line_order');

      if (error) throw error;

      setEditingOrder(order);
      setNewOrder({
        vendor_id: order.vendor_id,
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || '',
        notes: '',
        terms: '',
        shipping_address: ''
      });
      setLines(orderLines?.map(line => ({
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        account_id: line.account_id
      })) || []);
      setIsCreateDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load purchase order', variant: 'destructive' });
    }
  };

  const openViewOrder = async (order: PurchaseOrder) => {
    try {
      const { data: orderLines, error } = await supabase
        .from('purchase_order_lines')
        .select('*, product:products(name, sku)')
        .eq('purchase_order_id', order.id)
        .order('line_order');

      if (error) throw error;

      setSelectedOrder({ ...order, lines: orderLines });
      setIsViewDialogOpen(true);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load purchase order details', variant: 'destructive' });
    }
  };

  const createOrder = async () => {
    try {
      setIsLoading(true);

      if (!newOrder.vendor_id) {
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
      const subtotal = validLines.reduce((sum, line) => sum + line.amount, 0);

      if (editingOrder) {
        // Update existing order
        const { error: orderError } = await supabase
          .from('purchase_orders')
          .update({
            vendor_id: newOrder.vendor_id,
            order_date: newOrder.order_date,
            expected_delivery_date: newOrder.expected_delivery_date || null,
            subtotal: subtotal,
            total_amount: subtotal,
            notes: newOrder.notes,
            terms: newOrder.terms,
            shipping_address: newOrder.shipping_address
          })
          .eq('id', editingOrder.id);

        if (orderError) throw orderError;

        await supabase.from('purchase_order_lines').delete().eq('purchase_order_id', editingOrder.id);

        const { error: linesError } = await supabase
          .from('purchase_order_lines')
          .insert(validLines.map((line, idx) => ({
            purchase_order_id: editingOrder.id,
            product_id: line.product_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            amount: line.amount,
            account_id: line.account_id,
            line_order: idx
          })));

        if (linesError) throw linesError;

        toast({ title: 'Success', description: 'Purchase order updated successfully!' });
      } else {
        // Create new order
        const result = await PurchaseOrderService.createPurchaseOrder({
          user_id: userData.user.id,
          vendor_id: newOrder.vendor_id,
          order_date: newOrder.order_date,
          expected_delivery_date: newOrder.expected_delivery_date || undefined,
          subtotal: subtotal,
          tax_amount: 0,
          total_amount: subtotal,
          notes: newOrder.notes,
          terms: newOrder.terms,
          shipping_address: newOrder.shipping_address,
          lines: validLines
        });

        if (!result.success) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
          return;
        }

        toast({ title: 'Success', description: 'Purchase order created successfully!' });
      }

      setIsCreateDialogOpen(false);
      resetForm();
      fetchOrders();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const convertToBill = async (orderId: string) => {
    try {
      setIsLoading(true);
      
      const result = await PurchaseOrderService.convertToBill(orderId);
      
      if (result.success) {
        toast({ 
          title: 'Success!', 
          description: result.message || 'Purchase order converted to bill and approved!',
        });
        fetchOrders();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadOrder = (order: any) => {
    const content = `
PURCHASE ORDER: ${order.order_number}
Date: ${new Date(order.order_date).toLocaleDateString()}
Vendor: ${order.vendor?.name || 'N/A'}

LINE ITEMS:
${order.lines?.map((line: any, idx: number) => 
  `${idx + 1}. ${line.description} - Qty: ${line.quantity} @ $${line.unit_price} = $${line.amount.toFixed(2)}`
).join('\n')}

TOTAL: $${order.total_amount.toFixed(2)}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${order.order_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setNewOrder({
      vendor_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      notes: '',
      terms: '',
      shipping_address: ''
    });
    setLines([{ product_id: undefined, description: '', quantity: 1, unit_price: 0, amount: 0, account_id: undefined }]);
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'secondary',
      sent: 'default',
      converted: 'success',
      cancelled: 'destructive'
    };
    return colors[status] || 'default';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            {orders.length} orders • ${orders.reduce((sum, o) => sum + o.total_amount, 0).toFixed(2)} total
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={orders}
            onExport={(data, format) => {
              ExportService.exportPurchaseOrders(data, format);
            }}
          />
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Purchase Order
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOrder ? 'Edit Purchase Order' : 'Create Purchase Order'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor *</Label>
                  <Select value={newOrder.vendor_id} onValueChange={(value) => 
                    setNewOrder(prev => ({ ...prev, vendor_id: value }))}>
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
                    <Label>Order Date</Label>
                    <Input
                      type="date"
                      value={newOrder.order_date}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, order_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Expected Delivery</Label>
                    <Input
                      type="date"
                      value={newOrder.expected_delivery_date}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Line Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Product</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Cost</TableHead>
                      <TableHead className="w-40">Expense/Asset Account</TableHead>
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
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Manual)</SelectItem>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} {product.sku && `(${product.sku})`}
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
                          <Select 
                            value={line.account_id || 'none'} 
                            onValueChange={(value) => updateLine(index, 'account_id', value === 'none' ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Default Expense</SelectItem>
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
                  <div className="text-2xl font-bold">${calculateTotal().toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Shipping Address</Label>
                  <Textarea
                    value={newOrder.shipping_address}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, shipping_address: e.target.value }))}
                    placeholder="Delivery address..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={createOrder} disabled={isLoading} className="flex-1">
                  {isLoading ? (editingOrder ? 'Updating...' : 'Creating...') : (editingOrder ? 'Update Order' : 'Create Order')}
                </Button>
                <Button onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'converted', 'cancelled'].map((status) => (
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

      {/* Orders List */}
      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">{order.order_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.vendor?.name || order.vendor?.company_name}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-semibold">${order.total_amount.toFixed(2)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{new Date(order.order_date).toLocaleDateString()}</span>
                  </div>

                  <Badge variant={getStatusColor(order.status) as any}>
                    {order.status}
                  </Badge>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openViewOrder(order)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    {order.status !== 'converted' && order.status !== 'cancelled' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEditOrder(order)}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => convertToBill(order.id)}
                          disabled={isLoading}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Convert to Bill
                        </Button>
                      </>
                    )}
                    
                    {order.converted_bill_id && (
                      <Badge variant="outline" className="text-xs">
                        Converted ✓
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {orders.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Purchase Orders Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first purchase order to start tracking vendor orders.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Purchase Order
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Purchase Order: {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor</Label>
                  <div className="font-medium">{selectedOrder.vendor?.name}</div>
                </div>
                <div>
                  <Label>Order Date</Label>
                  <div>{new Date(selectedOrder.order_date).toLocaleDateString()}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={getStatusColor(selectedOrder.status) as any}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <div className="font-bold text-lg">${selectedOrder.total_amount.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <Label>Line Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.lines?.map((line: any) => (
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

              <div className="flex gap-2">
                <Button onClick={() => downloadOrder(selectedOrder)} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

