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
import { Wallet, TrendingUp, TrendingDown, DollarSign, FileText, Plus, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  name: string;
  code: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_active: boolean;
  balance?: number;
  opening_balance?: number;
  opening_balance_date?: string | null;
  opening_balance_recorded?: boolean;
  opening_balance_entry_id?: string | null;
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newAccount, setNewAccount] = useState({
    name: '',
    code: '',
    account_type: 'asset' as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
    parent_account_id: '',
    description: '',
    opening_balance: '',
    opening_balance_date: new Date().toISOString().split('T')[0]
  });

  const [editAccount, setEditAccount] = useState({
    name: '',
    code: '',
    account_type: 'asset' as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
    parent_account_id: '',
    description: '',
    opening_balance: '',
    opening_balance_date: new Date().toISOString().split('T')[0]
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

      // Parse opening balance
      const openingBalance = parseFloat(newAccount.opening_balance) || 0;
      const hasOpeningBalance = openingBalance !== 0;

      // Create account
      const { data: createdAccount, error } = await supabase
        .from('accounts')
        .insert([{
          user_id: userData.user.id,
          name: newAccount.name.trim(),
          code: newAccount.code.trim(),
          account_type: newAccount.account_type,
          parent_account_id: newAccount.parent_account_id || null,
          is_active: true,
          opening_balance: hasOpeningBalance ? openingBalance : 0,
          opening_balance_date: hasOpeningBalance ? newAccount.opening_balance_date : null,
          opening_balance_recorded: false
        }])
        .select()
        .single();

      if (error) throw error;

      // If there's an opening balance, create a journal entry
      if (hasOpeningBalance && createdAccount) {
        await createOpeningBalanceEntry(createdAccount.id, openingBalance, newAccount.opening_balance_date, userData.user.id);
      }

      toast({ 
        title: 'Success', 
        description: `Account "${newAccount.name}" created successfully!${hasOpeningBalance ? ` with opening balance of $${Math.abs(openingBalance).toFixed(2)}` : ''}` 
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
      description: '',
      opening_balance: '',
      opening_balance_date: new Date().toISOString().split('T')[0]
    });
  };

  const createOpeningBalanceEntry = async (
    accountId: string, 
    openingBalance: number, 
    balanceDate: string,
    userId: string
  ) => {
    try {
      // Get or create "Opening Balance Equity" account
      let { data: equityAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('code', '3900')
        .single();

      // If opening balance equity account doesn't exist, create it
      if (!equityAccount) {
        const { data: newEquityAccount, error: equityError } = await supabase
          .from('accounts')
          .insert([{
            user_id: userId,
            name: 'Opening Balance Equity',
            code: '3900',
            account_type: 'equity',
            is_active: true
          }])
          .select()
          .single();

        if (equityError) throw equityError;
        equityAccount = newEquityAccount;
      }

      // Generate entry number
      const { data: lastEntry } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastNumber = lastEntry?.entry_number 
        ? parseInt(lastEntry.entry_number.replace(/\D/g, '')) 
        : 0;
      const entryNumber = `JE-${String(lastNumber + 1).padStart(6, '0')}`;

      // Determine debit and credit based on account type and balance
      const account = accounts.find(a => a.id === accountId) || 
        { account_type: newAccount.account_type };
      
      const isDebitAccount = ['asset', 'expense'].includes(account.account_type);
      const absBalance = Math.abs(openingBalance);

      let debitAccountId, creditAccountId, amount;
      
      if (isDebitAccount) {
        // For assets/expenses: positive opening balance is debit
        if (openingBalance >= 0) {
          debitAccountId = accountId;
          creditAccountId = equityAccount.id;
          amount = absBalance;
        } else {
          // Negative opening balance is credit
          debitAccountId = equityAccount.id;
          creditAccountId = accountId;
          amount = absBalance;
        }
      } else {
        // For liabilities/equity/revenue: positive opening balance is credit
        if (openingBalance >= 0) {
          debitAccountId = equityAccount.id;
          creditAccountId = accountId;
          amount = absBalance;
        } else {
          // Negative opening balance is debit
          debitAccountId = accountId;
          creditAccountId = equityAccount.id;
          amount = absBalance;
        }
      }

      // Create journal entry
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert([{
          user_id: userId,
          entry_number: entryNumber,
          entry_date: balanceDate,
          description: `Opening Balance - ${newAccount.name}`,
          reference: 'Opening Balance',
          status: 'posted',
          total_debits: amount,
          total_credits: amount
        }])
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal entry lines
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert([
          {
            journal_entry_id: journalEntry.id,
            account_id: debitAccountId,
            description: `Opening Balance - ${newAccount.name}`,
            debit: amount,
            credit: 0
          },
          {
            journal_entry_id: journalEntry.id,
            account_id: creditAccountId,
            description: `Opening Balance - ${newAccount.name}`,
            debit: 0,
            credit: amount
          }
        ]);

      if (linesError) throw linesError;

      // Update account to mark opening balance as recorded
      await supabase
        .from('accounts')
        .update({
          opening_balance_recorded: true,
          opening_balance_entry_id: journalEntry.id
        })
        .eq('id', accountId);

    } catch (error: any) {
      console.error('Error creating opening balance entry:', error);
      // Don't throw - account was created successfully, just log the error
      toast({
        title: 'Warning',
        description: 'Account created but opening balance entry failed. You can manually create a journal entry.',
        variant: 'destructive'
      });
    }
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

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setEditAccount({
      name: account.name,
      code: account.code,
      account_type: account.account_type,
      parent_account_id: account.parent_account_id || '',
      description: '',
      opening_balance: account.opening_balance?.toString() || '',
      opening_balance_date: account.opening_balance_date || new Date().toISOString().split('T')[0]
    });
    setIsEditDialogOpen(true);
  };

  const updateAccount = async () => {
    if (!editingAccount) return;

    try {
      // Validation
      if (!editAccount.name.trim()) {
        toast({ title: 'Error', description: 'Account name is required', variant: 'destructive' });
        return;
      }

      if (!editAccount.code.trim()) {
        toast({ title: 'Error', description: 'Account code is required', variant: 'destructive' });
        return;
      }

      // Validate account code format (should be numeric)
      if (!/^\d+$/.test(editAccount.code)) {
        toast({ title: 'Error', description: 'Account code must contain only numbers', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({ title: 'Error', description: 'User not authenticated', variant: 'destructive' });
        return;
      }

      setIsLoading(true);

      // Check if account code already exists (excluding current account)
      if (editAccount.code !== editingAccount.code) {
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userData.user.id)
          .eq('code', editAccount.code)
          .neq('id', editingAccount.id)
          .single();

        if (existingAccount) {
          toast({ 
            title: 'Error', 
            description: `Account code ${editAccount.code} already exists. Please use a unique code.`, 
            variant: 'destructive' 
          });
          return;
        }
      }

      // Parse opening balance
      const newOpeningBalance = parseFloat(editAccount.opening_balance) || 0;
      const oldOpeningBalance = editingAccount.opening_balance || 0;
      const hasNewOpeningBalance = newOpeningBalance !== oldOpeningBalance && newOpeningBalance !== 0;
      const needsOpeningBalanceEntry = hasNewOpeningBalance && !editingAccount.opening_balance_recorded;

      // Update account
      const { error } = await supabase
        .from('accounts')
        .update({
          name: editAccount.name.trim(),
          code: editAccount.code.trim(),
          account_type: editAccount.account_type,
          parent_account_id: editAccount.parent_account_id || null,
          opening_balance: newOpeningBalance,
          opening_balance_date: newOpeningBalance !== 0 ? editAccount.opening_balance_date : null
        })
        .eq('id', editingAccount.id);

      if (error) throw error;

      // If there's a new opening balance and no previous entry, create one
      if (needsOpeningBalanceEntry) {
        await createOpeningBalanceEntry(
          editingAccount.id, 
          newOpeningBalance, 
          editAccount.opening_balance_date, 
          userData.user.id
        );
      }

      // If opening balance changed and there was an existing entry, update it
      if (hasNewOpeningBalance && editingAccount.opening_balance_recorded && editingAccount.opening_balance_entry_id) {
        await updateOpeningBalanceEntry(
          editingAccount.opening_balance_entry_id,
          editingAccount.id,
          newOpeningBalance,
          oldOpeningBalance,
          editAccount.opening_balance_date,
          userData.user.id
        );
      }

      toast({ 
        title: 'Success', 
        description: `Account "${editAccount.name}" updated successfully!` 
      });

      setIsEditDialogOpen(false);
      setEditingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update account', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateOpeningBalanceEntry = async (
    entryId: string,
    accountId: string,
    newBalance: number,
    oldBalance: number,
    balanceDate: string,
    userId: string
  ) => {
    try {
      // Get or create "Opening Balance Equity" account
      let { data: equityAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('code', '3900')
        .single();

      if (!equityAccount) {
        const { data: newEquityAccount, error: equityError } = await supabase
          .from('accounts')
          .insert([{
            user_id: userId,
            name: 'Opening Balance Equity',
            code: '3900',
            account_type: 'equity',
            is_active: true
          }])
          .select()
          .single();

        if (equityError) throw equityError;
        equityAccount = newEquityAccount;
      }

      // Determine debit and credit based on account type and balance
      const account = accounts.find(a => a.id === accountId) || editingAccount!;
      const isDebitAccount = ['asset', 'expense'].includes(account.account_type);
      const absBalance = Math.abs(newBalance);

      let debitAccountId, creditAccountId, amount;
      
      if (isDebitAccount) {
        if (newBalance >= 0) {
          debitAccountId = accountId;
          creditAccountId = equityAccount.id;
          amount = absBalance;
        } else {
          debitAccountId = equityAccount.id;
          creditAccountId = accountId;
          amount = absBalance;
        }
      } else {
        if (newBalance >= 0) {
          debitAccountId = equityAccount.id;
          creditAccountId = accountId;
          amount = absBalance;
        } else {
          debitAccountId = accountId;
          creditAccountId = equityAccount.id;
          amount = absBalance;
        }
      }

      // Update journal entry
      await supabase
        .from('journal_entries')
        .update({
          entry_date: balanceDate,
          description: `Opening Balance - ${editAccount.name}`,
          total_debits: amount,
          total_credits: amount
        })
        .eq('id', entryId);

      // Update journal entry lines
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('id, account_id')
        .eq('journal_entry_id', entryId);

      if (lines && lines.length === 2) {
        // Update debit line
        const debitLine = lines.find(l => l.account_id === debitAccountId || l.account_id === accountId);
        if (debitLine) {
          await supabase
            .from('journal_entry_lines')
            .update({
              account_id: debitAccountId,
              description: `Opening Balance - ${editAccount.name}`,
              debit: amount,
              credit: 0
            })
            .eq('id', debitLine.id);
        }

        // Update credit line
        const creditLine = lines.find(l => l.id !== debitLine?.id);
        if (creditLine) {
          await supabase
            .from('journal_entry_lines')
            .update({
              account_id: creditAccountId,
              description: `Opening Balance - ${editAccount.name}`,
              debit: 0,
              credit: amount
            })
            .eq('id', creditLine.id);
        }
      }

    } catch (error: any) {
      console.error('Error updating opening balance entry:', error);
      toast({
        title: 'Warning',
        description: 'Account updated but opening balance entry update failed. You may need to manually adjust the journal entry.',
        variant: 'destructive'
      });
    }
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
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(account)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openJournalEntries(account)}
                              >
                                View Entries
                              </Button>
                            </div>
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
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(account)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openJournalEntries(account)}
                            >
                              View Entries
                            </Button>
                          </div>
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

            {/* Opening Balance Section */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Opening Balance (Optional)
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  If this account has an existing balance (from before you started using this system), enter it here. 
                  A journal entry will be automatically created.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Opening Balance Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newAccount.opening_balance}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, opening_balance: e.target.value }))}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter positive number (e.g., 5000.00)
                    </p>
                  </div>
                  <div>
                    <Label>As of Date</Label>
                    <Input
                      type="date"
                      value={newAccount.opening_balance_date}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, opening_balance_date: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Date of the opening balance
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground bg-white dark:bg-gray-900 p-3 rounded border">
                  <p className="font-medium mb-1">How opening balances work:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Assets & Expenses:</strong> Enter the balance as a positive number</li>
                    <li><strong>Liabilities, Equity & Revenue:</strong> Enter the balance as a positive number</li>
                    <li>A journal entry will be created automatically using "Opening Balance Equity" account</li>
                    <li>Example: Bank account with $10,000 → enter 10000</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

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

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Account Type *</Label>
              <Select 
                value={editAccount.account_type} 
                onValueChange={(value: any) => setEditAccount(prev => ({ ...prev, account_type: value }))}
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
                {getAccountTypeDescription(editAccount.account_type)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Code *</Label>
                <Input
                  type="text"
                  value={editAccount.code}
                  onChange={(e) => setEditAccount(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., 1010"
                  maxLength={10}
                />
              </div>

              <div>
                <Label>Account Name *</Label>
                <Input
                  type="text"
                  value={editAccount.name}
                  onChange={(e) => setEditAccount(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Checking Account"
                />
              </div>
            </div>

            <div>
              <Label>Parent Account (Optional)</Label>
              <Select 
                value={editAccount.parent_account_id || 'none'} 
                onValueChange={(value) => setEditAccount(prev => ({ ...prev, parent_account_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (Top-level account)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top-level account)</SelectItem>
                  {accounts
                    .filter(acc => acc.account_type === editAccount.account_type && acc.id !== editingAccount?.id)
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
                value={editAccount.description}
                onChange={(e) => setEditAccount(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this account's purpose..."
                rows={3}
              />
            </div>

            {/* Opening Balance Section */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Opening Balance
                </h4>
                {editingAccount?.opening_balance_recorded ? (
                  <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      ⚠️ This account already has an opening balance journal entry. 
                      Changing the amount will update the existing entry.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">
                    Set or update the opening balance for this account. 
                    A journal entry will be created or updated automatically.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Opening Balance Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editAccount.opening_balance}
                      onChange={(e) => setEditAccount(prev => ({ ...prev, opening_balance: e.target.value }))}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Current: ${editingAccount?.opening_balance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <Label>As of Date</Label>
                    <Input
                      type="date"
                      value={editAccount.opening_balance_date}
                      onChange={(e) => setEditAccount(prev => ({ ...prev, opening_balance_date: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={updateAccount} 
                disabled={isLoading || !editAccount.name.trim() || !editAccount.code.trim()}
                className="flex-1"
              >
                {isLoading ? 'Updating...' : 'Update Account'}
              </Button>
              <Button 
                onClick={() => { setIsEditDialogOpen(false); setEditingAccount(null); }} 
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

