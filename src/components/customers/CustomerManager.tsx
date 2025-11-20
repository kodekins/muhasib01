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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, Mail, Phone, Building, FileText, DollarSign, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExportService } from '@/services';
import { ExportButton } from '@/components/ui/export-button';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  customer_type: string;
  balance: number;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  balance_due: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  reference?: string;
}

export function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [customerJournalEntries, setCustomerJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    tax_number: '',
    customer_type: 'customer',
    payment_terms: '30',
    credit_limit: '',
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
    
    // Set up real-time subscription for customer updates
    const channel = supabase
      .channel('customer-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          console.log('Customer change detected, refreshing customers...');
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive"
      });
    }
  };

  const createCustomer = async () => {
    try {
      setIsLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('customers')
        .insert([{
          user_id: userData.user.id,
          name: newCustomer.name,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          company_name: newCustomer.company_name || null,
          address: newCustomer.address || null,
          tax_number: newCustomer.tax_number || null,
          customer_type: newCustomer.customer_type,
          payment_terms: parseInt(newCustomer.payment_terms),
          credit_limit: newCustomer.credit_limit ? parseFloat(newCustomer.credit_limit) : 0,
          notes: newCustomer.notes || null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer created successfully"
      });

      setIsCreateDialogOpen(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        address: '',
        tax_number: '',
        customer_type: 'customer',
        payment_terms: '30',
        credit_limit: '',
        notes: ''
      });
      
      fetchCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsDialogOpen(true);
    await Promise.all([
      fetchCustomerInvoices(customer.id),
      fetchCustomerPayments(customer.id),
      fetchCustomerJournalEntries(customer.id)
    ]);
  };

  const fetchCustomerInvoices = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, status, total_amount, balance_due')
        .eq('customer_id', customerId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setCustomerInvoices(data || []);
    } catch (error: any) {
      console.error('Error fetching customer invoices:', error);
    }
  };

  const fetchCustomerPayments = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, reference_number')
        .eq('customer_id', customerId)
        .eq('payment_type', 'invoice_payment')
        .order('payment_date', { ascending: false});

      if (error) throw error;
      setCustomerPayments(data || []);
    } catch (error: any) {
      console.error('Error fetching customer payments:', error);
    }
  };

  const fetchCustomerJournalEntries = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          debit,
          credit,
          description,
          created_at,
          journal_entry_id
        `)
        .eq('entity_type', 'customer')
        .eq('entity_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique journal entry IDs
      const journalEntryIds = [...new Set(data?.map(line => line.journal_entry_id))];

      // Fetch journal entries separately
      const { data: journalEntriesData } = await supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, description, reference')
        .in('id', journalEntryIds);

      // Create a map of journal entries
      const jeMap = new Map(journalEntriesData?.map(je => [je.id, je]));

      // Transform data
      const entries = data?.map((line: any) => {
        const je = jeMap.get(line.journal_entry_id);
        return {
          id: line.id,
          entry_number: je?.entry_number || 'N/A',
          entry_date: je?.entry_date || line.created_at,
          description: line.description || je?.description || 'No description',
          reference: je?.reference || '',
          debit: line.debit || 0,
          credit: line.credit || 0
        };
      }) || [];

      setCustomerJournalEntries(entries);
    } catch (error: any) {
      console.error('Error fetching customer journal entries:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Customer Management</h2>
        <div className="flex gap-2">
          <ExportButton
            data={customers}
            onExport={(data, format) => {
              ExportService.exportCustomers(data, format);
            }}
          />
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div>
                <Label htmlFor="customer-name">Customer Name *</Label>
                <Input
                  id="customer-name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="ACME Corp"
                />
              </div>

              <div>
                <Label>Customer Type</Label>
                <Select value={newCustomer.customer_type} onValueChange={(value) => 
                  setNewCustomer(prev => ({ ...prev, customer_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment-terms">Payment Terms (Days)</Label>
                <Input
                  id="payment-terms"
                  type="number"
                  value={newCustomer.payment_terms}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, payment_terms: e.target.value }))}
                  placeholder="30"
                />
              </div>

              <div>
                <Label htmlFor="tax-number">Tax Number</Label>
                <Input
                  id="tax-number"
                  value={newCustomer.tax_number}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, tax_number: e.target.value }))}
                  placeholder="123-45-6789"
                />
              </div>

              <div>
                <Label htmlFor="credit-limit">Credit Limit</Label>
                <Input
                  id="credit-limit"
                  type="number"
                  value={newCustomer.credit_limit}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, credit_limit: e.target.value }))}
                  placeholder="5000.00"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main St, City, State 12345"
                  rows={2}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this customer..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Button onClick={createCustomer} disabled={isLoading || !newCustomer.name} className="w-full">
                  {isLoading ? 'Creating...' : 'Create Customer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <Card key={customer.id} className={`${!customer.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{customer.name}</CardTitle>
                <Badge variant={customer.customer_type === 'client' ? 'default' : 'secondary'}>
                  {customer.customer_type}
                </Badge>
              </div>
              {customer.company_name && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building className="h-3 w-3" />
                  {customer.company_name}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{customer.phone}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance:</span>
                <span className={customer.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Math.abs(customer.balance).toFixed(2)} {customer.balance < 0 ? 'owed' : 'credit'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Terms:</span>
                <span>{customer.payment_terms} days</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Added: {new Date(customer.created_at).toLocaleDateString()}
              </div>

              <Button variant="outline" size="sm" onClick={() => openCustomerDetails(customer)} className="w-full mt-3">
                <FileText className="h-3 w-3 mr-1" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {customers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Customers Added</h3>
            <p className="text-muted-foreground mb-4">
              Add your first customer to start managing client relationships.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Customer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
            <div className="flex items-center gap-4 pt-2">
              <Badge variant="default">{selectedCustomer?.customer_type}</Badge>
              {selectedCustomer?.company_name && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {selectedCustomer.company_name}
                </span>
              )}
              <span className="text-sm font-semibold">
                Balance: <span className={selectedCustomer && selectedCustomer.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Math.abs(selectedCustomer?.balance || 0).toFixed(2)}
                </span>
              </span>
            </div>
          </DialogHeader>

          <Tabs defaultValue="invoices" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="journal">Journal Entries</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="space-y-4">
              {customerInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No invoices for this customer yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">${invoice.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${invoice.balance_due.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              {customerPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payments received yet</p>
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
                    {customerPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{payment.payment_method}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.reference_number || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          ${payment.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="journal" className="space-y-4">
              {customerJournalEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entries yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerJournalEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{entry.entry_number}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.reference || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.debit > 0 ? `$${entry.debit.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.credit > 0 ? `$${entry.credit.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}