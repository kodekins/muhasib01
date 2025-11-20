import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, BookOpen, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { JournalEntryService } from '@/services';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debits: number;
  total_credits: number;
  status: string;
  lines?: JournalEntryLine[];
}

interface JournalEntryLine {
  account_id: string;
  debit: number;
  credit: number;
  memo: string;
}

export function JournalEntriesView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newEntry, setNewEntry] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [lines, setLines] = useState<JournalEntryLine[]>([
    { account_id: '', debit: 0, credit: 0, memo: '' },
    { account_id: '', debit: 0, credit: 0, memo: '' }
  ]);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();

    const channel = supabase
      .channel('journal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => {
        fetchEntries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEntries = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await JournalEntryService.getJournalEntries(userData.user.id, {
        startDate: undefined,
        endDate: undefined
      });

      if (result.success) {
        setEntries(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data } = await supabase
        .from('accounts')
        .select('id, name, code, account_type')
        .order('code');
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const addLine = () => {
    setLines([...lines, { account_id: '', debit: 0, credit: 0, memo: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast({ title: 'Error', description: 'Need at least 2 lines', variant: 'destructive' });
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // If entering debit, clear credit and vice versa
    if (field === 'debit' && value > 0) {
      newLines[index].credit = 0;
    } else if (field === 'credit' && value > 0) {
      newLines[index].debit = 0;
    }
    
    setLines(newLines);
  };

  const calculateTotals = () => {
    const debits = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const credits = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return { debits, credits, difference: Math.abs(debits - credits) };
  };

  const isBalanced = () => {
    const { debits, credits } = calculateTotals();
    return Math.abs(debits - credits) < 0.01 && debits > 0;
  };

  const createEntry = async () => {
    try {
      setIsLoading(true);

      if (!newEntry.description) {
        toast({ title: 'Error', description: 'Description is required', variant: 'destructive' });
        return;
      }

      if (!isBalanced()) {
        toast({ 
          title: 'Error', 
          description: 'Debits and credits must be equal and greater than zero', 
          variant: 'destructive' 
        });
        return;
      }

      const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
      
      if (validLines.length < 2) {
        toast({ title: 'Error', description: 'Need at least 2 valid lines', variant: 'destructive' });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const result = await JournalEntryService.createJournalEntry({
        user_id: userData.user.id,
        entry_date: newEntry.entry_date,
        description: newEntry.description,
        lines: validLines
      });

      if (result.success) {
        toast({ title: 'Success', description: 'Journal entry created successfully!' });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchEntries();
      } else {
        toast({ 
          title: 'Error', 
          description: result.errors?.join(', ') || result.error, 
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewEntry({
      entry_date: new Date().toISOString().split('T')[0],
      description: ''
    });
    setLines([
      { account_id: '', debit: 0, credit: 0, memo: '' },
      { account_id: '', debit: 0, credit: 0, memo: '' }
    ]);
  };

  const { debits, credits, difference } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Journal Entries</h2>
          <p className="text-sm text-muted-foreground">
            {entries.length} entries recorded
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Journal Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={newEntry.entry_date}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, entry_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Input
                    value={newEntry.description}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Monthly rent payment"
                  />
                </div>
              </div>

              {/* Lines */}
              <div>
                <Label>Journal Entry Lines</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Account</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="w-32 text-right">Debit</TableHead>
                      <TableHead className="w-32 text-right">Credit</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select 
                            value={line.account_id} 
                            onValueChange={(value) => updateLine(index, 'account_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.memo}
                            onChange={(e) => updateLine(index, 'memo', e.target.value)}
                            placeholder="Optional memo"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right"
                            value={line.debit || ''}
                            onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right"
                            value={line.credit || ''}
                            onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          {lines.length > 2 && (
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
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2} className="text-right">Totals:</TableCell>
                      <TableCell className="text-right">${debits.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${credits.toFixed(2)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between mt-2">
                  <Button onClick={addLine} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line
                  </Button>
                  
                  {difference > 0 && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">Out of balance by ${difference.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {isBalanced() && (
                    <div className="flex items-center gap-2 text-green-600">
                      <span className="text-sm font-semibold">✓ Balanced</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={createEntry} 
                  disabled={isLoading || !isBalanced()} 
                  className="flex-1"
                >
                  {isLoading ? 'Creating...' : 'Create Entry'}
                </Button>
                <Button onClick={() => setIsCreateDialogOpen(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entry List */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{entry.entry_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {new Date(entry.entry_date).toLocaleDateString()}
                  </div>
                  <div className="font-semibold">
                    ${(entry.total_debits || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {entries.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Journal Entries</h3>
              <p className="text-muted-foreground mb-4">
                Manual journal entries let you record complex transactions.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Entry
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

