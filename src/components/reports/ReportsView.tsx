import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, FileText, Download, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ReportService, JournalEntryService } from '@/services';

export function ReportsView() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Report data
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [generalLedger, setGeneralLedger] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any[]>([]);

  const generateReports = async () => {
    try {
      setIsLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Profit & Loss
      const plResult = await ReportService.generateProfitLoss(userData.user.id, startDate, endDate);
      if (plResult.success) setProfitLoss(plResult.data);

      // Balance Sheet
      const bsResult = await ReportService.generateBalanceSheet(userData.user.id, endDate);
      if (bsResult.success) setBalanceSheet(bsResult.data);

      // Cash Flow
      const cfResult = await ReportService.generateCashFlow(userData.user.id, startDate, endDate);
      if (cfResult.success) setCashFlow(cfResult.data);

      // General Ledger
      const glResult = await JournalEntryService.getGeneralLedger(userData.user.id, {
        startDate,
        endDate
      });
      if (glResult.success) setGeneralLedger(glResult.data || []);

      // Trial Balance
      const tbResult = await JournalEntryService.getTrialBalance(userData.user.id, endDate);
      if (tbResult.success) setTrialBalance(tbResult.data || []);

      toast({ title: 'Success', description: 'Reports generated successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateReports();
  }, []);

  const formatCurrency = (value: number) => {
    return `$${Math.abs(value).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Financial Reports</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive accounting reports and statements
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={generateReports} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Reports'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="profit-loss" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profit-loss">P&L</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="general-ledger">General Ledger</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
        </TabsList>

        {/* Profit & Loss */}
        <TabsContent value="profit-loss">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              {profitLoss ? (
                <div className="space-y-6">
                  {/* Revenue */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Revenue</h3>
                    {Array.isArray(profitLoss.revenue) && profitLoss.revenue.length > 0 ? (
                      profitLoss.revenue.map((item: any) => (
                        <div key={item.account_id} className="flex justify-between py-2">
                          <span className="text-muted-foreground">{item.account_name}</span>
                          <span className="font-medium">{formatCurrency(item.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No revenue recorded for this period</p>
                    )}
                    <div className="flex justify-between py-2 font-semibold border-t mt-2">
                      <span>Total Revenue</span>
                      <span>{formatCurrency(profitLoss.total_revenue || 0)}</span>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Expenses</h3>
                    {Array.isArray(profitLoss.expenses) && profitLoss.expenses.length > 0 ? (
                      profitLoss.expenses.map((item: any) => (
                        <div key={item.account_id} className="flex justify-between py-2">
                          <span className="text-muted-foreground">{item.account_name}</span>
                          <span className="font-medium">{formatCurrency(item.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No expenses recorded for this period</p>
                    )}
                    <div className="flex justify-between py-2 font-semibold border-t mt-2">
                      <span>Total Expenses</span>
                      <span>{formatCurrency(profitLoss.total_expenses || 0)}</span>
                    </div>
                  </div>

                  {/* Net Income */}
                  <div className="border-t-2 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">Net Income</span>
                      <div className="flex items-center gap-2">
                        {(profitLoss.net_income || 0) >= 0 ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                        <span className={`text-xl font-bold ${
                          (profitLoss.net_income || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(profitLoss.net_income || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Generate reports to see profit & loss statement
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
              <p className="text-sm text-muted-foreground">
                As of {new Date(endDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              {balanceSheet ? (
                <div className="space-y-6">
                  {/* Assets */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Assets</h3>
                    {Array.isArray(balanceSheet.assets) && balanceSheet.assets.length > 0 ? (
                      balanceSheet.assets.map((item: any) => (
                        <div key={item.account_id} className="flex justify-between py-2">
                          <span className="text-muted-foreground">{item.account_name}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No assets recorded</p>
                    )}
                    <div className="flex justify-between py-2 font-semibold border-t mt-2">
                      <span>Total Assets</span>
                      <span>{formatCurrency(balanceSheet.total_assets || 0)}</span>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Liabilities</h3>
                    {Array.isArray(balanceSheet.liabilities) && balanceSheet.liabilities.length > 0 ? (
                      balanceSheet.liabilities.map((item: any) => (
                        <div key={item.account_id} className="flex justify-between py-2">
                          <span className="text-muted-foreground">{item.account_name}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No liabilities recorded</p>
                    )}
                    <div className="flex justify-between py-2 font-semibold border-t mt-2">
                      <span>Total Liabilities</span>
                      <span>{formatCurrency(balanceSheet.total_liabilities || 0)}</span>
                    </div>
                  </div>

                  {/* Equity */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Equity</h3>
                    {Array.isArray(balanceSheet.equity) && balanceSheet.equity.length > 0 ? (
                      balanceSheet.equity.map((item: any) => (
                        <div key={item.account_id} className="flex justify-between py-2">
                          <span className="text-muted-foreground">{item.account_name}</span>
                          <span className="font-medium">{formatCurrency(item.balance)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No equity recorded</p>
                    )}
                    <div className="flex justify-between py-2 font-semibold border-t mt-2">
                      <span>Total Equity</span>
                      <span>{formatCurrency(balanceSheet.total_equity || 0)}</span>
                    </div>
                  </div>

                  {/* Total Liabilities + Equity */}
                  <div className="border-t-2 pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total Liabilities & Equity</span>
                      <span>{formatCurrency((balanceSheet.total_liabilities || 0) + (balanceSheet.total_equity || 0))}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Generate reports to see balance sheet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Statement</CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              {cashFlow ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Operating Activities</h3>
                    <div className="flex justify-between py-2 font-semibold">
                      <span>Net Cash from Operations</span>
                      <span>{formatCurrency(cashFlow.operating || 0)}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">Investing Activities</h3>
                    <div className="flex justify-between py-2 font-semibold">
                      <span>Net Cash from Investing</span>
                      <span>{formatCurrency(cashFlow.investing || 0)}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">Financing Activities</h3>
                    <div className="flex justify-between py-2 font-semibold">
                      <span>Net Cash from Financing</span>
                      <span>{formatCurrency(cashFlow.financing || 0)}</span>
                    </div>
                  </div>

                  <div className="border-t-2 pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Net Change in Cash</span>
                      <span className={(cashFlow.net_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(cashFlow.net_change || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Generate reports to see cash flow statement
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Ledger */}
        <TabsContent value="general-ledger">
          <Card>
            <CardHeader>
              <CardTitle>General Ledger</CardTitle>
            </CardHeader>
            <CardContent>
              {generalLedger.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generalLedger.map((entry: any, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.account_name}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</TableCell>
                        <TableCell className="text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No entries found for the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
              <p className="text-sm text-muted-foreground">
                As of {new Date(endDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              {trialBalance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.map((account: any) => (
                      <TableRow key={account.account_id}>
                        <TableCell>{account.account_code}</TableCell>
                        <TableCell>{account.account_name}</TableCell>
                        <TableCell className="text-right">
                          {account.debit_balance > 0 ? formatCurrency(account.debit_balance) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.credit_balance > 0 ? formatCurrency(account.credit_balance) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2}>Totals</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trialBalance.reduce((sum, a) => sum + a.debit_balance, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trialBalance.reduce((sum, a) => sum + a.credit_balance, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No accounts found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

