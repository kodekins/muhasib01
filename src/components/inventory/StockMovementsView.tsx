import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { History, TrendingDown, TrendingUp, Package, FileText, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StockMovement {
  id: string;
  date: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  type: 'sale' | 'purchase' | 'adjustment';
  quantity: number;
  reference?: string;
  description: string;
  unit_of_measure?: string;
  cost_per_unit?: number;
  total_value?: number;
}

export function StockMovementsView() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchStockMovements();

    // Real-time subscription
    const channel = supabase
      .channel('stock-movements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_lines' }, () => {
        fetchStockMovements();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    filterMovements();
  }, [movements, searchTerm, typeFilter, dateFilter]);

  const fetchStockMovements = async () => {
    try {
      setIsLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Fetch sales from invoice_lines
      const { data: salesData } = await supabase
        .from('invoice_lines')
        .select(`
          id,
          quantity,
          unit_price,
          created_at,
          product_id,
          invoice:invoices(
            id,
            invoice_number,
            invoice_date,
            status,
            customer:customers(name)
          ),
          product:products(
            id,
            name,
            sku,
            unit_of_measure,
            cost
          )
        `)
        .order('created_at', { ascending: false });

      // Build movements array
      const allMovements: StockMovement[] = [];

      // Add sales
      salesData?.forEach((sale: any) => {
        if (sale.invoice && sale.invoice.status !== 'draft' && sale.product) {
          const customerName = sale.invoice.customer?.name || 'Unknown';
          const totalValue = (sale.product.cost || 0) * Math.abs(sale.quantity);
          
          allMovements.push({
            id: sale.id,
            date: sale.invoice.invoice_date || sale.created_at,
            product_id: sale.product_id,
            product_name: sale.product.name,
            product_sku: sale.product.sku,
            type: 'sale',
            quantity: -Math.abs(sale.quantity),
            reference: sale.invoice.invoice_number,
            description: `Sold to ${customerName}`,
            unit_of_measure: sale.product.unit_of_measure,
            cost_per_unit: sale.product.cost,
            total_value: totalValue
          });
        }
      });

      // Sort by date (most recent first)
      allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setMovements(allMovements);
    } catch (error: any) {
      console.error('Error fetching stock movements:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to fetch stock movements', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterMovements = () => {
    let filtered = [...movements];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.product_name.toLowerCase().includes(search) ||
        m.product_sku?.toLowerCase().includes(search) ||
        m.reference?.toLowerCase().includes(search) ||
        m.description.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === typeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3);
          break;
      }

      if (dateFilter !== 'all') {
        filtered = filtered.filter(m => new Date(m.date) >= filterDate);
      }
    }

    setFilteredMovements(filtered);
  };

  const getMovementStats = () => {
    const sales = filteredMovements.filter(m => m.type === 'sale');
    const purchases = filteredMovements.filter(m => m.type === 'purchase');
    const adjustments = filteredMovements.filter(m => m.type === 'adjustment');

    const totalSalesQty = sales.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const totalPurchasesQty = purchases.reduce((sum, m) => sum + m.quantity, 0);
    const totalSalesValue = sales.reduce((sum, m) => sum + (m.total_value || 0), 0);

    return {
      totalMovements: filteredMovements.length,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      adjustmentsCount: adjustments.length,
      totalSalesQty,
      totalPurchasesQty,
      totalSalesValue
    };
  };

  const stats = getMovementStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-6 w-6" />
            Stock Movements
          </h2>
          <p className="text-sm text-muted-foreground">
            Track all inventory movements across products
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMovements}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.salesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              -{stats.totalSalesQty.toFixed(0)} units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.purchasesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.totalPurchasesQty.toFixed(0)} units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">COGS Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalSalesValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cost of goods sold
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product, SKU, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sale">Sales</SelectItem>
                <SelectItem value="purchase">Purchases</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading movements...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Stock Movements</h3>
              <p className="text-muted-foreground">
                {searchTerm || typeFilter !== 'all' || dateFilter !== 'all'
                  ? 'No movements match your filters. Try adjusting your search criteria.'
                  : 'Stock movements will appear here when products are used in invoices or bills.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Cost/Unit</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {new Date(movement.date).toLocaleDateString()}
                        <div className="text-xs text-muted-foreground">
                          {new Date(movement.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{movement.product_name}</div>
                        {movement.product_sku && (
                          <div className="text-xs text-muted-foreground">SKU: {movement.product_sku}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            movement.type === 'sale' ? 'destructive' : 
                            movement.type === 'purchase' ? 'default' : 
                            'secondary'
                          }
                        >
                          {movement.type === 'sale' && <TrendingDown className="h-3 w-3 mr-1 inline" />}
                          {movement.type === 'purchase' && <TrendingUp className="h-3 w-3 mr-1 inline" />}
                          {movement.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {movement.reference ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold text-blue-600 hover:underline cursor-pointer">
                              {movement.reference}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{movement.description}</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${movement.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        {movement.unit_of_measure && (
                          <span className="text-xs text-muted-foreground ml-1">{movement.unit_of_measure}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.cost_per_unit ? (
                          <span>${movement.cost_per_unit.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {movement.total_value ? (
                          <span>${movement.total_value.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

