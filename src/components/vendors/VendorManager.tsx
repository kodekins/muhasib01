import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Truck, Mail, Phone, Building, FileText, DollarSign, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExportService } from '@/services';
import { ExportButton } from '@/components/ui/export-button';

interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  vendor_type: string;
  balance: number;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  balance_due: number;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  total_debits: number;
  total_credits: number;
  status: string;
}

export function VendorManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorBills, setVendorBills] = useState<Bill[]>([]);
  const [vendorPayments, setVendorPayments] = useState<Payment[]>([]);
  const [vendorJournalEntries, setVendorJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    tax_number: '',
    vendor_type: 'vendor',
    payment_terms: '30',
    credit_limit: '',
    notes: ''
  });

  useEffect(() => {
    fetchVendors();
    
    // Set up real-time subscription for vendor updates
    const channel = supabase
      .channel('vendor-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors' },
        () => {
          console.log('Vendor change detected, refreshing vendors...');
          fetchVendors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: "Error",
        description: "Failed to load vendors",
        variant: "destructive"
      });
    }
  };

  const openVendorDetails = async (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDetailsDialogOpen(true);

    // Fetch vendor bills
    const { data: bills } = await supabase
      .from('bills')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('bill_date', { ascending: false });
    setVendorBills(bills || []);

    // Fetch vendor payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('payment_type', 'bill_payment')
      .order('payment_date', { ascending: false });
    setVendorPayments(payments || []);

    // Fetch vendor journal entries
    const { data: journalLines } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id')
      .eq('entity_type', 'vendor')
      .eq('entity_id', vendor.id);

    if (journalLines && journalLines.length > 0) {
      const entryIds = [...new Set(journalLines.map(line => line.journal_entry_id))];
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('*')
        .in('id', entryIds)
        .order('entry_date', { ascending: false });
      setVendorJournalEntries(entries || []);
    } else {
      setVendorJournalEntries([]);
    }
  };

  const createVendor = async () => {
    try {
      setIsLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('vendors')
        .insert([{
          user_id: userData.user.id,
          name: newVendor.name,
          email: newVendor.email || null,
          phone: newVendor.phone || null,
          company_name: newVendor.company_name || null,
          address: newVendor.address || null,
          tax_number: newVendor.tax_number || null,
          vendor_type: newVendor.vendor_type,
          payment_terms: parseInt(newVendor.payment_terms),
          credit_limit: newVendor.credit_limit ? parseFloat(newVendor.credit_limit) : 0,
          notes: newVendor.notes || null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor created successfully"
      });

      setIsCreateDialogOpen(false);
      setNewVendor({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        address: '',
        tax_number: '',
        vendor_type: 'vendor',
        payment_terms: '30',
        credit_limit: '',
        notes: ''
      });
      
      fetchVendors();
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to create vendor",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Vendor Management</h2>
        <div className="flex gap-2">
          <ExportButton
            data={vendors}
            onExport={(data, format) => {
              ExportService.exportVendors(data, format);
            }}
          />
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div>
                <Label htmlFor="vendor-name">Vendor Name *</Label>
                <Input
                  id="vendor-name"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ABC Supply Co."
                />
              </div>
              
              <div>
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="orders@supplier.com"
                />
              </div>

              <div>
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 987-6543"
                />
              </div>

              <div>
                <Label htmlFor="vendor-company-name">Company Name</Label>
                <Input
                  id="vendor-company-name"
                  value={newVendor.company_name}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="ABC Supply Corporation"
                />
              </div>

              <div>
                <Label>Vendor Type</Label>
                <Select value={newVendor.vendor_type} onValueChange={(value) => 
                  setNewVendor(prev => ({ ...prev, vendor_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vendor-payment-terms">Payment Terms (Days)</Label>
                <Input
                  id="vendor-payment-terms"
                  type="number"
                  value={newVendor.payment_terms}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, payment_terms: e.target.value }))}
                  placeholder="30"
                />
              </div>

              <div>
                <Label htmlFor="vendor-tax-number">Tax Number</Label>
                <Input
                  id="vendor-tax-number"
                  value={newVendor.tax_number}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, tax_number: e.target.value }))}
                  placeholder="98-7654321"
                />
              </div>

              <div>
                <Label htmlFor="vendor-credit-limit">Credit Limit</Label>
                <Input
                  id="vendor-credit-limit"
                  type="number"
                  value={newVendor.credit_limit}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, credit_limit: e.target.value }))}
                  placeholder="10000.00"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="vendor-address">Address</Label>
                <Textarea
                  id="vendor-address"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="456 Industrial Ave, Business City, State 54321"
                  rows={2}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="vendor-notes">Notes</Label>
                <Textarea
                  id="vendor-notes"
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this vendor..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Button onClick={createVendor} disabled={isLoading || !newVendor.name} className="w-full">
                  {isLoading ? 'Creating...' : 'Create Vendor'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map((vendor) => (
          <Card key={vendor.id} className={`${!vendor.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{vendor.name}</CardTitle>
                <Badge variant={vendor.vendor_type === 'supplier' ? 'default' : 'secondary'}>
                  {vendor.vendor_type}
                </Badge>
              </div>
              {vendor.company_name && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building className="h-3 w-3" />
                  {vendor.company_name}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{vendor.email}</span>
                </div>
              )}
              
              {vendor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{vendor.phone}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance:</span>
                <span className={vendor.balance <= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Math.abs(vendor.balance).toFixed(2)} {vendor.balance > 0 ? 'owed' : 'credit'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Terms:</span>
                <span>{vendor.payment_terms} days</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Added: {new Date(vendor.created_at).toLocaleDateString()}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => openVendorDetails(vendor)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVendor?.name}</DialogTitle>
            <div className="flex items-center gap-4 pt-2">
              <Badge variant="default">{selectedVendor?.vendor_type}</Badge>
              {selectedVendor?.company_name && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {selectedVendor.company_name}
                </span>
              )}
              <span className="text-sm font-semibold">
                Balance: <span className={selectedVendor && selectedVendor.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                  ${Math.abs(selectedVendor?.balance || 0).toFixed(2)} {selectedVendor && selectedVendor.balance > 0 ? 'owed' : 'credit'}
                </span>
              </span>
            </div>
          </DialogHeader>

          <Tabs defaultValue="bills" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bills">Bills</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="journal">Journal Entries</TabsTrigger>
            </TabsList>

            <TabsContent value="bills" className="space-y-4">
              {vendorBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bills for this vendor yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">{bill.bill_number}</TableCell>
                        <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(bill.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            bill.status === 'paid' ? 'default' :
                            bill.status === 'overdue' ? 'destructive' :
                            'secondary'
                          }>
                            {bill.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">${bill.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${bill.balance_due.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              {vendorPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payments to this vendor yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{payment.payment_method.replace('_', ' ')}</TableCell>
                        <TableCell>{payment.reference_number || '-'}</TableCell>
                        <TableCell className="text-right font-medium">${payment.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="journal" className="space-y-4">
              {vendorJournalEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entries for this vendor yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorJournalEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.entry_number}</TableCell>
                        <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>
                          <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">${(entry.total_debits || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${(entry.total_credits || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {vendors.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Vendors Added</h3>
            <p className="text-muted-foreground mb-4">
              Add your first vendor to start managing supplier relationships.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Vendor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}