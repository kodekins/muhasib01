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
import { Plus, Package, Edit, AlertTriangle, History, TrendingDown, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductService, ExportService } from '@/services';
import { StockMovementService } from '@/services/stockMovementService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportButton } from '@/components/ui/export-button';

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  type: string; // Changed from product_type
  unit_price: number;
  cost?: number; // Changed from cost_price
  quantity_on_hand?: number; // Changed from quantity_in_stock
  reorder_point?: number;
  is_active: boolean;
  unit_of_measure?: string;
}

interface StockMovement {
  id: string;
  date: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'return';
  quantity: number;
  reference?: string;
  description: string;
  running_balance: number;
  unit_cost?: number;
  total_value?: number;
}

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isStockMovementsOpen, setIsStockMovementsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [vendors, setVendors] = useState<any[]>([]);
  const { toast } = useToast();

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    description: '',
    type: 'product',
    unit_price: '',
    cost: '',
    quantity_on_hand: '',
    reorder_point: '',
    unit_of_measure: 'unit',
    vendor_id: '',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProducts();
    fetchVendors();

    const channel = supabase
      .channel('product-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const fetchVendors = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, company_name')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await ProductService.getProducts(userData.user.id, {
        type: filter === 'all' ? undefined : filter,
        lowStock: filter === 'low-stock' ? true : undefined
      });

      if (result.success) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const createProduct = async () => {
    try {
      setIsLoading(true);

      if (!newProduct.name || !newProduct.unit_price) {
        toast({ title: 'Error', description: 'Name and price are required', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: newProduct.name,
            sku: newProduct.sku || null,
            description: newProduct.description || null,
            type: newProduct.type,
            unit_price: parseFloat(newProduct.unit_price),
            cost: newProduct.cost ? parseFloat(newProduct.cost) : null,
            reorder_point: newProduct.reorder_point ? parseFloat(newProduct.reorder_point) : null,
            unit_of_measure: newProduct.unit_of_measure
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Product updated successfully!' });
      } else {
        // Create new product with initial purchase
        const initialQty = parseFloat(newProduct.quantity_on_hand || '0');
        const cost = parseFloat(newProduct.cost || '0');
        
        // Validation for initial purchase
        if (initialQty > 0 && !newProduct.vendor_id) {
          toast({ 
            title: 'Error', 
            description: 'Please select a vendor for initial purchase', 
            variant: 'destructive' 
          });
          return;
        }

        if (initialQty > 0 && cost <= 0) {
          toast({ 
            title: 'Error', 
            description: 'Cost price is required for initial purchase', 
            variant: 'destructive' 
          });
          return;
        }

        // Step 1: Create the product (without quantity first)
        const { data: product, error: productError } = await supabase
          .from('products')
          .insert([{
            user_id: userData.user.id,
            name: newProduct.name,
            sku: newProduct.sku || null,
            description: newProduct.description || null,
            type: newProduct.type,
            unit_price: parseFloat(newProduct.unit_price),
            cost: cost || null,
            track_inventory: newProduct.type === 'product',
            quantity_on_hand: 0, // Will be updated by stock movement
            reorder_point: newProduct.reorder_point ? parseFloat(newProduct.reorder_point) : null,
            unit_of_measure: newProduct.unit_of_measure,
            taxable: true,
            tax_rate: 0
          }])
          .select()
          .single();

        if (productError) throw productError;

        // Step 2: If initial quantity, create a bill for the purchase
        if (initialQty > 0 && newProduct.vendor_id) {
          const totalValue = initialQty * cost;
          const billNumber = `BILL-INIT-${Date.now()}`;

          // Create a bill for this initial purchase
          const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert([{
              user_id: userData.user.id,
              vendor_id: newProduct.vendor_id,
              bill_number: billNumber,
              bill_date: newProduct.purchase_date,
              due_date: new Date(new Date(newProduct.purchase_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: 'draft', // User needs to approve it
              subtotal: totalValue,
              tax_amount: 0,
              total_amount: totalValue,
              amount_paid: 0,
              balance_due: totalValue,
              notes: `Initial inventory purchase for ${newProduct.name}`
            }])
            .select()
            .single();

          if (billError) {
            console.error('Bill creation failed:', billError);
            toast({ title: 'Warning', description: 'Product created but bill creation failed', variant: 'default' });
          } else {
            // Create bill line item
            await supabase
              .from('bill_lines')
              .insert([{
                bill_id: bill.id,
                product_id: product.id,
                description: `Initial purchase - ${newProduct.name}`,
                quantity: initialQty,
                unit_price: cost,
                amount: totalValue
              }]);

            toast({ 
              title: 'Success', 
              description: `Product created! Bill ${billNumber} created for ${initialQty} ${newProduct.unit_of_measure}. Go to Bills tab to approve.` 
            });
          }
        } else {
          // No initial purchase
          toast({ title: 'Success', description: 'Product created successfully!' });
        }
      }

      setIsCreateDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      sku: product.sku || '',
      description: product.description || '',
      type: product.type,
      unit_price: product.unit_price.toString(),
      cost: product.cost?.toString() || '',
      quantity_on_hand: product.quantity_on_hand?.toString() || '0',
      reorder_point: product.reorder_point?.toString() || '',
      unit_of_measure: product.unit_of_measure || 'unit'
    });
    setIsCreateDialogOpen(true);
  };

  const fetchStockMovements = async (productId: string) => {
    try {
      setIsLoading(true);

      // Fetch from stock_movements table
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('movement_date', { ascending: false });

      if (error) throw error;

      // Get current product quantity
      const { data: product } = await supabase
        .from('products')
        .select('quantity_on_hand')
        .eq('id', productId)
        .single();

      // Build movements array with running balance
      const movements: StockMovement[] = [];
      let runningBalance = product?.quantity_on_hand || 0;

      // Calculate running balance (going backwards in time)
      data?.forEach((movement: any) => {
        movements.push({
          id: movement.id,
          date: movement.movement_date,
          type: movement.movement_type,
          quantity: movement.quantity,
          reference: movement.reference_number,
          description: movement.description || '',
          running_balance: runningBalance,
          unit_cost: movement.unit_cost,
          total_value: movement.total_value
        });
        // Subtract this movement to get previous balance
        runningBalance -= movement.quantity;
      });

      setStockMovements(movements);
    } catch (error: any) {
      console.error('Error fetching stock movements:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openStockMovements = async (product: Product) => {
    setSelectedProduct(product);
    setIsStockMovementsOpen(true);
    setAdjustmentQuantity('');
    setAdjustmentNotes('');
    await fetchStockMovements(product.id);
  };

  const handleManualAdjustment = async () => {
    if (!selectedProduct || !adjustmentQuantity) {
      toast({ title: 'Error', description: 'Please enter a quantity', variant: 'destructive' });
      return;
    }

    try {
      setIsSubmittingAdjustment(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const qty = parseFloat(adjustmentQuantity);
      if (isNaN(qty) || qty === 0) {
        toast({ title: 'Error', description: 'Invalid quantity', variant: 'destructive' });
        return;
      }

      const result = await StockMovementService.recordStockMovement({
        user_id: userData.user.id,
        product_id: selectedProduct.id,
        movement_type: 'adjustment',
        quantity: qty,
        unit_cost: selectedProduct.cost || 0,
        reference_type: 'manual_adjustment',
        reference_number: `ADJ-${Date.now()}`,
        description: adjustmentNotes || `Manual adjustment: ${qty > 0 ? 'increase' : 'decrease'} stock`,
        movement_date: new Date().toISOString(),
        create_journal_entry: true
      });

      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ 
        title: 'Success', 
        description: `Stock adjusted by ${qty > 0 ? '+' : ''}${qty} ${selectedProduct.unit_of_measure || 'units'}` 
      });

      // Refresh data
      await fetchStockMovements(selectedProduct.id);
      await fetchProducts();
      setAdjustmentQuantity('');
      setAdjustmentNotes('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setNewProduct({
      name: '',
      sku: '',
      description: '',
      type: 'product',
      unit_price: '',
      cost: '',
      quantity_on_hand: '',
      reorder_point: '',
      unit_of_measure: 'unit',
      vendor_id: '',
      purchase_date: new Date().toISOString().split('T')[0]
    });
  };

  const isLowStock = (product: Product) => {
    if (product.type === 'service') return false;
    if (!product.reorder_point) return false;
    return (product.quantity_on_hand || 0) <= product.reorder_point;
  };

  const lowStockCount = products.filter(isLowStock).length;

  const getInventoryStats = () => {
    const totalProducts = products.length;
    const inventoryValue = products.reduce((sum, p) => {
      if (p.type === 'product') {
        return sum + ((p.quantity_on_hand || 0) * (p.cost || 0));
      }
      return sum;
    }, 0);
    const outOfStock = products.filter(p => p.type === 'product' && (p.quantity_on_hand || 0) === 0).length;
    
    return { totalProducts, inventoryValue, lowStockCount, outOfStock };
  };

  const stats = getInventoryStats();

  // Fetch all stock movements across products
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);

  const fetchAllStockMovements = async () => {
    try {
      setIsLoadingMovements(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name, sku, unit_of_measure)
        `)
        .eq('user_id', userData.user.id)
        .order('movement_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAllMovements(data || []);
    } catch (error: any) {
      console.error('Error fetching stock movements:', error);
    } finally {
      setIsLoadingMovements(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'movements') {
      fetchAllStockMovements();
    }
  }, [activeTab]);

  const StockMovementsListView = () => (
    <Card>
      <CardHeader>
        <CardTitle>Stock Movement History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingMovements ? (
          <div className="text-center py-8">Loading movements...</div>
        ) : allMovements.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stock movements recorded yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allMovements.map((movement: any) => (
                <TableRow key={movement.id}>
                  <TableCell>{new Date(movement.movement_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="font-medium">{movement.product?.name}</div>
                    {movement.product?.sku && (
                      <div className="text-xs text-muted-foreground">{movement.product.sku}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={movement.movement_type === 'sale' ? 'destructive' : 'default'}>
                      {movement.movement_type}
                    </Badge>
                  </TableCell>
                  <TableCell className={movement.quantity < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{movement.reference_number || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{movement.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const AlertsView = () => {
    const lowStockProducts = products.filter(isLowStock);
    const outOfStockProducts = products.filter(p => p.type === 'product' && (p.quantity_on_hand || 0) === 0);

    return (
      <div className="space-y-4">
        {lowStockProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Alerts ({lowStockProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Current: {product.quantity_on_hand} • Reorder at: {product.reorder_point}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => openStockMovements(product)}>
                      View Stock
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {outOfStockProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Out of Stock ({outOfStockProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {outOfStockProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-red-600">Out of stock - Reorder needed</div>
                    </div>
                    <Button size="sm" onClick={() => openStockMovements(product)}>
                      Adjust Stock
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-semibold mb-2">No Alerts</h3>
              <p className="text-muted-foreground">All products are adequately stocked</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Products & Services</h2>
          <p className="text-sm text-muted-foreground">{stats.totalProducts} items</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={products}
            onExport={(data, format) => {
              ExportService.exportProducts(data, format);
            }}
          />
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Product
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product/Service' : 'Create New Product/Service'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Product or service name"
                />
              </div>

              <div>
                <Label>Type</Label>
                <Select value={newProduct.type} onValueChange={(value) => 
                  setNewProduct(prev => ({ ...prev, type: value }))}>
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

              <div>
                <Label>Unit Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.unit_price}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, unit_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.cost}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              {newProduct.type === 'product' && !editingProduct && (
                <>
                  <div className="col-span-2 border-t pt-4">
                    <h3 className="font-semibold mb-3">Initial Purchase (Optional)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Record an initial purchase to set starting stock and create proper accounting entries
                    </p>
                  </div>

                  <div>
                    <Label>Initial Quantity</Label>
                    <Input
                      type="number"
                      value={newProduct.quantity_on_hand}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, quantity_on_hand: e.target.value }))}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Vendor {parseFloat(newProduct.quantity_on_hand || '0') > 0 && '*'}</Label>
                    <Select value={newProduct.vendor_id} onValueChange={(value) => 
                      setNewProduct(prev => ({ ...prev, vendor_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map(vendor => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parseFloat(newProduct.quantity_on_hand || '0') > 0 && !newProduct.vendor_id && (
                      <p className="text-xs text-red-600 mt-1">Vendor required for initial purchase</p>
                    )}
                  </div>

                  <div>
                    <Label>Purchase Date</Label>
                    <Input
                      type="date"
                      value={newProduct.purchase_date}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, purchase_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label>Reorder Point</Label>
                    <Input
                      type="number"
                      value={newProduct.reorder_point}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, reorder_point: e.target.value }))}
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <Label>Unit of Measure</Label>
                    <Select value={newProduct.unit_of_measure} onValueChange={(value) => 
                      setNewProduct(prev => ({ ...prev, unit_of_measure: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unit">Unit</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="dozen">Dozen</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="lb">Pound</SelectItem>
                        <SelectItem value="hour">Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {parseFloat(newProduct.quantity_on_hand || '0') > 0 && parseFloat(newProduct.cost || '0') > 0 && newProduct.vendor_id && (
                    <div className="col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-sm text-blue-900 mb-2">📋 Accounting Preview</h4>
                      <div className="text-xs text-blue-700 space-y-1">
                        <p>• Creates stock movement record</p>
                        <p>• Updates vendor balance (Accounts Payable): +${(parseFloat(newProduct.quantity_on_hand) * parseFloat(newProduct.cost)).toFixed(2)}</p>
                        <p>• Creates journal entry: Debit Inventory, Credit Accounts Payable</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {newProduct.type === 'product' && editingProduct && (
                <>
                  <div>
                    <Label>Reorder Point</Label>
                    <Input
                      type="number"
                      value={newProduct.reorder_point}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, reorder_point: e.target.value }))}
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <Label>Unit of Measure</Label>
                    <Select value={newProduct.unit_of_measure} onValueChange={(value) => 
                      setNewProduct(prev => ({ ...prev, unit_of_measure: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unit">Unit</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="dozen">Dozen</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="lb">Pound</SelectItem>
                        <SelectItem value="hour">Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              <div className="col-span-2 flex gap-2">
                <Button onClick={createProduct} disabled={isLoading} className="flex-1">
                  {isLoading ? (editingProduct ? 'Updating...' : 'Creating...') : (editingProduct ? 'Update Product' : 'Create Product')}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${stats.inventoryValue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.lowStockCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            {['all', 'product', 'service', 'low-stock'].map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === 'low-stock' ? 'Low Stock' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>

          {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} className={!product.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{product.name}</CardTitle>
                </div>
                <Badge variant={product.type === 'service' ? 'secondary' : 'default'}>
                  {product.type}
                </Badge>
              </div>
              {product.sku && (
                <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Unit Price:</span>
                <span className="font-semibold">${product.unit_price.toFixed(2)}</span>
              </div>

              {product.cost && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost:</span>
                  <span className="text-sm">${product.cost.toFixed(2)}</span>
                </div>
              )}

              {product.type === 'product' && (
                <>
                  <div className="flex justify-between items-center border-l-4 border-blue-500 pl-3 py-2 bg-blue-50/50 rounded">
                    <span className="text-sm font-medium text-blue-900">Stock on Hand:</span>
                    <span className={`font-bold text-lg ${isLowStock(product) ? 'text-destructive' : 'text-blue-700'}`}>
                      {product.quantity_on_hand || 0} {product.unit_of_measure || 'units'}
                      {isLowStock(product) && <AlertTriangle className="inline h-4 w-4 ml-1" />}
                    </span>
                  </div>

                  {product.reorder_point && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reorder at:</span>
                      <span className="text-sm">{product.reorder_point}</span>
                    </div>
                  )}
                </>
              )}

              {product.cost && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Margin:</span>
                    <span className="font-semibold text-green-600">
                      {(((product.unit_price - product.cost) / product.unit_price) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditProduct(product)} className="flex-1">
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {product.type === 'product' && (
                  <Button variant="outline" size="sm" onClick={() => openStockMovements(product)} className="flex-1">
                    <History className="h-3 w-3 mr-1" />
                    Stock
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {products.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add products and services to use on invoices and bills.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Product
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </TabsContent>

      {/* Stock Movements Tab */}
      <TabsContent value="movements" className="space-y-4">
        <StockMovementsListView />
      </TabsContent>

      {/* Alerts Tab */}
      <TabsContent value="alerts" className="space-y-4">
        <AlertsView />
      </TabsContent>
    </Tabs>

      {/* Stock Movements Dialog with Tabs */}
      <Dialog open={isStockMovementsOpen} onOpenChange={setIsStockMovementsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Inventory Management - {selectedProduct?.name}
            </DialogTitle>
            <div className="flex items-center gap-4 pt-3 pb-2 border-b">
              <Badge variant="default" className="text-xs">
                {selectedProduct?.type}
              </Badge>
              {selectedProduct?.sku && (
                <span className="text-sm text-muted-foreground">SKU: <span className="font-medium">{selectedProduct.sku}</span></span>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Current Stock:</span>
                <span className="text-lg font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded">
                  {selectedProduct?.quantity_on_hand || 0} {selectedProduct?.unit_of_measure || 'units'}
                </span>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="movements" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="movements">Movement History</TabsTrigger>
              <TabsTrigger value="adjustment">Manual Adjustment</TabsTrigger>
            </TabsList>

            {/* Movement History Tab */}
            <TabsContent value="movements" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading movements...</p>
                </div>
              ) : stockMovements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">No Stock Movements</h3>
                  <p className="text-sm">Movements will be recorded when:</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• Product is sold via invoice</li>
                    <li>• Product is purchased via bill</li>
                    <li>• Manual adjustment is made</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Complete movement history with double-entry bookkeeping.
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Balance After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovements.map((movement) => (
                        <TableRow key={movement.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div>{new Date(movement.date).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(movement.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              movement.type === 'sale' ? 'destructive' : 
                              movement.type === 'purchase' ? 'default' : 
                              movement.type === 'return' ? 'secondary' :
                              'outline'
                            }>
                              {movement.type === 'sale' && <TrendingDown className="h-3 w-3 mr-1 inline" />}
                              {movement.type === 'purchase' && <TrendingUp className="h-3 w-3 mr-1 inline" />}
                              {movement.type.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{movement.description}</TableCell>
                          <TableCell>
                            {movement.reference ? (
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4 text-blue-500" />
                                <span className="font-semibold text-blue-600 text-sm">{movement.reference}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${movement.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            <span className="text-xs text-muted-foreground ml-1">{selectedProduct?.unit_of_measure || 'units'}</span>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {movement.unit_cost ? `$${movement.unit_cost.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {movement.total_value ? `$${movement.total_value.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-bold text-blue-700">{movement.running_balance}</div>
                            <div className="text-xs text-muted-foreground">{selectedProduct?.unit_of_measure || 'units'}</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Manual Adjustment Tab */}
            <TabsContent value="adjustment" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">📝 Manual Stock Adjustment</h4>
                <p className="text-xs text-blue-700">
                  Record manual inventory adjustments with automatic journal entries for proper double-entry bookkeeping.
                  Enter positive numbers to increase stock, negative numbers to decrease stock.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">Current Stock Level</Label>
                    <div className="mt-1 p-3 border rounded-lg bg-gray-50">
                      <div className="text-2xl font-bold text-blue-700">
                        {selectedProduct?.quantity_on_hand || 0} {selectedProduct?.unit_of_measure || 'units'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cost per unit: ${selectedProduct?.cost?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="adjustment-qty">Adjustment Quantity *</Label>
                    <Input
                      id="adjustment-qty"
                      type="number"
                      step="0.01"
                      value={adjustmentQuantity}
                      onChange={(e) => setAdjustmentQuantity(e.target.value)}
                      placeholder="e.g. +10 or -5"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use + for increase, - for decrease
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="adjustment-notes">Notes / Reason</Label>
                  <Textarea
                    id="adjustment-notes"
                    value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    placeholder="Reason for adjustment (e.g., Physical count correction, Damaged goods, etc.)"
                    rows={3}
                    className="mt-1"
                  />
                </div>

                {adjustmentQuantity && !isNaN(parseFloat(adjustmentQuantity)) && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-semibold text-sm mb-3">Preview</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Stock:</span>
                        <span className="font-medium">{selectedProduct?.quantity_on_hand || 0} {selectedProduct?.unit_of_measure || 'units'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Adjustment:</span>
                        <span className={`font-bold ${parseFloat(adjustmentQuantity) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(adjustmentQuantity) > 0 ? '+' : ''}{parseFloat(adjustmentQuantity)} {selectedProduct?.unit_of_measure || 'units'}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">New Stock Level:</span>
                        <span className="font-bold text-blue-700">
                          {((selectedProduct?.quantity_on_hand || 0) + parseFloat(adjustmentQuantity)).toFixed(2)} {selectedProduct?.unit_of_measure || 'units'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Value Impact:</span>
                        <span className="font-medium">
                          ${(Math.abs(parseFloat(adjustmentQuantity)) * (selectedProduct?.cost || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-yellow-900 mb-1">⚠️ Accounting Impact:</h5>
                  <p className="text-xs text-yellow-700">
                    This adjustment will create a journal entry affecting Inventory (1300) and {parseFloat(adjustmentQuantity || '0') > 0 ? 'COGS (5000)' : 'COGS (5000)'} accounts.
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleManualAdjustment} 
                    disabled={!adjustmentQuantity || isSubmittingAdjustment}
                    className="flex-1"
                  >
                    {isSubmittingAdjustment ? 'Recording...' : 'Record Adjustment'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setAdjustmentQuantity('');
                      setAdjustmentNotes('');
                    }}
                    disabled={isSubmittingAdjustment}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

