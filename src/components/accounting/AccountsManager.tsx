import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Wallet, TrendingUp, TrendingDown, DollarSign, FileText, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  name: string;
  code: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_active: boolean;
  balance?: number;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: string;
  total_debits: number;
  total_credits: number;
  debit?: number;
  credit?: number;
  reference?: string;
}

export function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isJournalDialogOpen, setIsJournalDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newAccount, setNewAccount] = useState({
    name: '',
    code: '',
    account_type: 'asset' as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
    parent_account_id: '',
    description: ''
  });

  useEffect(() => {
    fetchAccounts();
  }, [filter]);

  const fetchAccounts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      let query = supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .order('code');

      if (filter !== 'all') {
        query = query.eq('account_type', filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate balances for each account
      const accountsWithBalances = await Promise.all(
        (data || []).map(async (account) => {
          const balance = await calculateAccountBalance(account.id);
          return { ...account, balance };
        })
      );

      setAccounts(accountsWithBalances);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const calculateAccountBalance = async (accountId: string): Promise<number> => {
    try {
      // Get all journal entry lines for this account
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('account_id', accountId);

      if (error) throw error;

      const totalDebits = data?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
      const totalCredits = data?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;

      // Balance depends on account type
      // Assets & Expenses: Debit balance (debits - credits)
      // Liabilities, Equity, Revenue: Credit balance (credits - debits)
      return totalDebits - totalCredits;
    } catch (error) {
      console.error('Error calculating account balance:', error);
      return 0;
    }
  };

  const fetchJournalEntries = async (accountId: string) => {
    try {
      setIsLoading(true);

      // Get journal entry lines for this account
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
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique journal entry IDs
      const journalEntryIds = [...new Set(data?.map(line => line.journal_entry_id))];

      // Fetch journal entries separately
      const { data: journalEntriesData, error: jeError } = await supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, description, status, reference')
        .in('id', journalEntryIds);

      if (jeError) throw jeError;

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
          status: je?.status || 'unknown',
          reference: je?.reference || '',
          debit: line.debit || 0,
          credit: line.credit || 0
        };
      }) || [];

      setJournalEntries(entries);
    } catch (error: any) {
      console.error('Error fetching journal entries:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openJournalEntries = async (account: Account) => {
    setSelectedAccount(account);
    setIsJournalDialogOpen(true);
    await fetchJournalEntries(account.id);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'asset': return <Wallet className="h-5 w-5 text-green-500" />;
      case 'liability': return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'equity': return <DollarSign className="h-5 w-5 text-blue-500" />;
      case 'revenue': return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case 'expense': return <TrendingDown className="h-5 w-5 text-orange-500" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset': return 'default';
      case 'liability': return 'destructive';
      case 'equity': return 'secondary';
      case 'revenue': return 'default';
      case 'expense': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatBalance = (account: Account) => {
    const balance = account.balance || 0;
    const absBalance = Math.abs(balance);
    
    // For liability, equity, and revenue accounts, show credit balance as positive
    const displayBalance = ['liability', 'equity', 'revenue'].includes(account.account_type)
      ? -balance
      : balance;

    const color = displayBalance >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={`font-semibold ${color}`}>${absBalance.toFixed(2)}</span>;
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.account_type]) {
      acc[account.account_type] = [];
    }
    acc[account.account_type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const calculateTotal = (type: string) => {
    const accountsOfType = groupedAccounts[type] || [];
    return accountsOfType.reduce((sum, acc) => {
      const balance = acc.balance || 0;
      // For liability, equity, revenue: credit balance
      const displayBalance = ['liability', 'equity', 'revenue'].includes(type)
        ? -balance
        : balance;
      return sum + displayBalance;
    }, 0);
  };

  const runningBalance = (entries: JournalEntry[]): { balance: number; entries: (JournalEntry & { runningBalance: number })[] } => {
    let balance = 0;
    const entriesWithBalance = entries.map(entry => {
      balance += (entry.debit || 0) - (entry.credit || 0);
      return { ...entry, runningBalance: balance };
    });
    return { balance, entries: entriesWithBalance };
  };

  const { entries: entriesWithRunningBalance } = runningBalance(journalEntries);

  const createAccount = async () => {
    try {
      // Validation
      if (!newAccount.name.trim()) {
        toast({ title: 'Error', description: 'Account name is required', variant: 'destructive' });
        return;
      }

      if (!newAccount.code.trim()) {
        toast({ title: 'Error', description: 'Account code is required', variant: 'destructive' });
        return;
      }

      // Validate account code format (should be numeric)
      if (!/^\d+$/.test(newAccount.code)) {
        toast({ title: 'Error', description: 'Account code must contain only numbers (e.g., 1010, 2000)', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({ title: 'Error', description: 'User not authenticated', variant: 'destructive' });
        return;
      }

      setIsLoading(true);

      // Check if account code already exists
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('code', newAccount.code)
        .single();

      if (existingAccount) {
        toast({ 
          title: 'Error', 
          description: `Account code ${newAccount.code} already exists. Please use a unique code.`, 
          variant: 'destructive' 
        });
        return;
      }

      // Create account
      const { error } = await supabase
        .from('accounts')
        .insert([{
          user_id: userData.user.id,
          name: newAccount.name.trim(),
          code: newAccount.code.trim(),
          account_type: newAccount.account_type,
          parent_account_id: newAccount.parent_account_id || null,
          is_active: true
        }]);

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Account "${newAccount.name}" created successfully!` 
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create account', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewAccount({
      name: '',
      code: '',
      account_type: 'asset',
      parent_account_id: '',
      description: ''
    });
  };

  const getNextAvailableCode = (type: string): string => {
    const typeCodeRanges: Record<string, string> = {
      asset: '1',
      liability: '2',
      equity: '3',
      revenue: '4',
      expense: '5'
    };
    
    const baseCode = typeCodeRanges[type] || '1';
    const accountsOfType = accounts.filter(acc => acc.account_type === type);
    
    if (accountsOfType.length === 0) {
      return `${baseCode}000`;
    }

    // Find the highest code and suggest next
    const codes = accountsOfType
      .map(acc => parseInt(acc.code))
      .filter(code => !isNaN(code))
      .sort((a, b) => b - a);

    if (codes.length > 0) {
      const nextCode = codes[0] + 10;
      return nextCode.toString();
    }

    return `${baseCode}000`;
  };

  const handleAccountTypeChange = (type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense') => {
    setNewAccount(prev => ({
      ...prev,
      account_type: type,
      code: getNextAvailableCode(type)
    }));
  };

  const getAccountTypeDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      asset: 'Things the business owns (e.g., Cash, Accounts Receivable, Inventory)',
      liability: 'Things the business owes (e.g., Accounts Payable, Loans, Credit Cards)',
      equity: 'Owner\'s stake in the business (e.g., Owner\'s Capital, Retained Earnings)',
      revenue: 'Income from business activities (e.g., Sales, Service Revenue, Interest Income)',
      expense: 'Costs of doing business (e.g., Rent, Salaries, Utilities, COGS)'
    };
    return descriptions[type] || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground">
            {accounts.length} accounts • View balances and transactions
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All Accounts</TabsTrigger>
          <TabsTrigger value="asset">Assets</TabsTrigger>
          <TabsTrigger value="liability">Liabilities</TabsTrigger>
          <TabsTrigger value="equity">Equity</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="expense">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4">
          {filter === 'all' ? (
            // Grouped view
            Object.entries(groupedAccounts).map(([type, accountList]) => (
              <Card key={type}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize flex items-center gap-2">
                      {getAccountTypeIcon(type)}
                      {type}s
                    </CardTitle>
                    <div className="text-lg font-semibold">
                      Total: ${Math.abs(calculateTotal(type)).toFixed(2)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountList.map((account) => (
                        <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell className="text-right">{formatBalance(account)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openJournalEntries(account)}
                            >
                              View Entries
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          ) : (
            // Single type view
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize flex items-center gap-2">
                    {getAccountTypeIcon(filter)}
                    {filter} Accounts
                  </CardTitle>
                  <div className="text-lg font-semibold">
                    Total: ${Math.abs(calculateTotal(filter)).toFixed(2)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{account.code}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell className="text-right">{formatBalance(account)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openJournalEntries(account)}
                          >
                            View Entries
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Account Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Account Type *</Label>
              <Select 
                value={newAccount.account_type} 
                onValueChange={(value: any) => handleAccountTypeChange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-500" />
                      Asset
                    </div>
                  </SelectItem>
                  <SelectItem value="liability">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      Liability
                    </div>
                  </SelectItem>
                  <SelectItem value="equity">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      Equity
                    </div>
                  </SelectItem>
                  <SelectItem value="revenue">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Revenue
                    </div>
                  </SelectItem>
                  <SelectItem value="expense">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-500" />
                      Expense
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {getAccountTypeDescription(newAccount.account_type)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Code *</Label>
                <Input
                  type="text"
                  value={newAccount.code}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., 1010"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Numeric code (suggested: {getNextAvailableCode(newAccount.account_type)})
                </p>
              </div>

              <div>
                <Label>Account Name *</Label>
                <Input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Checking Account"
                />
              </div>
            </div>

            <div>
              <Label>Parent Account (Optional)</Label>
              <Select 
                value={newAccount.parent_account_id || 'none'} 
                onValueChange={(value) => setNewAccount(prev => ({ ...prev, parent_account_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (Top-level account)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top-level account)</SelectItem>
                  {accounts
                    .filter(acc => acc.account_type === newAccount.account_type)
                    .map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Create a sub-account under an existing account
              </p>
            </div>

            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={newAccount.description}
                onChange={(e) => setNewAccount(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this account's purpose..."
                rows={3}
              />
            </div>

            {/* Account Code Reference Guide */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-2 text-sm">Account Code Guide:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium">1000-1999:</span> Assets
                  </div>
                  <div>
                    <span className="font-medium">4000-4999:</span> Revenue
                  </div>
                  <div>
                    <span className="font-medium">2000-2999:</span> Liabilities
                  </div>
                  <div>
                    <span className="font-medium">5000-5999:</span> Expenses
                  </div>
                  <div>
                    <span className="font-medium">3000-3999:</span> Equity
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Example codes: 1010 (Bank), 1200 (AR), 2000 (AP), 4000 (Sales), 5000 (COGS)
                </p>
              </CardContent>
            </Card>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={createAccount} 
                disabled={isLoading || !newAccount.name.trim() || !newAccount.code.trim()}
                className="flex-1"
              >
                {isLoading ? 'Creating...' : 'Create Account'}
              </Button>
              <Button 
                onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} 
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Journal Entries Dialog */}
      <Dialog open={isJournalDialogOpen} onOpenChange={setIsJournalDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount?.code} - {selectedAccount?.name}
            </DialogTitle>
            <div className="flex items-center gap-4 pt-2">
              <Badge variant={getAccountTypeColor(selectedAccount?.account_type || '')}>
                {selectedAccount?.account_type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Current Balance: {selectedAccount && formatBalance(selectedAccount)}
              </span>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8">Loading entries...</div>
          ) : journalEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No journal entries found for this account
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesWithRunningBalance.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">{entry.description}</div>
                      {entry.reference && (
                        <div className="text-xs text-muted-foreground">Ref: {entry.reference}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.debit ? `$${entry.debit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.credit ? `$${entry.credit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${Math.abs(entry.runningBalance).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

