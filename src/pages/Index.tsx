import { useState, useEffect } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { AccountingDashboard } from '@/components/dashboard/AccountingDashboard';
import { BudgetManager } from '@/components/budget/BudgetManager';
import { CustomerManager } from '@/components/customers/CustomerManager';
import { VendorManager } from '@/components/vendors/VendorManager';
import { InvoiceManager } from '@/components/invoices/InvoiceManager';
import { BillManager } from '@/components/bills/BillManager';
import { ProductManager } from '@/components/products/ProductManager';
import { JournalEntriesView } from '@/components/accounting/JournalEntriesView';
import { AccountsManager } from '@/components/accounting/AccountsManager';
import { ReportsView } from '@/components/reports/ReportsView';
import { SalesOrderManager } from '@/components/orders/SalesOrderManager';
import { PurchaseOrderManager } from '@/components/orders/PurchaseOrderManager';
import { CreditMemoManager } from '@/components/credit-memos/CreditMemoManager';
import { useChat } from '@/hooks/useChat';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, BarChart3, PiggyBank, Users, Truck, FileText, Receipt, Package, BookOpen, TrendingUp, Wallet, ClipboardList, ShoppingCart, ChevronDown, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const {
    conversations,
    currentConversationId,
    messages,
    isLoading: chatLoading,
    sendMessage,
    selectConversation,
    newConversation
  } = useChat();

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Sign in failed:', error);
      toast({
        title: "Sign In Failed",
        description: "Please try again or contact support if the problem persists.",
        variant: "destructive"
      });
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out."
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <div className="max-w-xl">
          <div className="mb-8">
              <img 
                src="/muhasib logo.png" 
                alt="Muhasib Logo" 
                className="h-16 w-auto object-contain mb-8"
              />
            </div>
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Professional Accounting Made Simple
            </h1>
            <p className="text-xl text-muted-foreground mb-12">
              Streamline your financial operations with AI-powered insights, automated bookkeeping, and comprehensive reporting.
            </p>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Natural language interface for all your accounting needs
                  </p>
                </div>
          </div>
          
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Real-time Analytics</h3>
                <p className="text-sm text-muted-foreground">
                    Track performance with live dashboards and reports
                </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Complete Bookkeeping</h3>
                <p className="text-sm text-muted-foreground">
                    Full double-entry accounting with automated journal entries
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign In */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="bg-card border rounded-xl shadow-lg p-8">
              <div className="lg:hidden flex justify-center mb-6">
                <img 
                  src="/muhasib logo.png" 
                  alt="Muhasib Logo" 
                  className="h-16 w-auto object-contain"
                />
              </div>
              
              <div className="mb-8 text-center lg:text-left">
                <h2 className="text-2xl font-bold mb-2">Welcome to Muhasib</h2>
                <p className="text-muted-foreground">
                  Sign in to access your accounting dashboard
                </p>
            </div>
            
            <button
              onClick={signInWithGoogle}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 px-6 rounded-lg font-medium transition-all hover:shadow-lg flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
            </button>

              <p className="mt-6 text-xs text-center text-muted-foreground">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
              <div>
                <div className="font-semibold text-foreground">Invoicing</div>
                <div className="text-xs">& Billing</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">Inventory</div>
                <div className="text-xs">Management</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">Financial</div>
                <div className="text-xs">Reports</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
    setActiveTab('chat');
  };

  const handleNewConversation = () => {
    newConversation();
    setActiveTab('chat');
  };

  const handleShowDashboard = () => {
    setActiveTab('dashboard');
  };

  const handleShowBudgets = () => {
    setActiveTab('budgets');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <ChatSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onShowDashboard={handleShowDashboard}
          showDashboard={activeTab === 'dashboard'}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* Header Navigation */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center px-6">
              <nav className="flex items-center space-x-1 flex-1">
                <TabsList className="h-10 bg-muted/50">
                  <TabsTrigger value="chat" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">AI Assistant</span>
                </TabsTrigger>
                  <TabsTrigger value="dashboard" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                </TabsList>

                <div className="h-10 px-1" />

                <TabsList className="h-10 bg-muted/50">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
                        <FileText className="h-4 w-4" />
                        Sales
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => setActiveTab('invoices')} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  Invoices
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('credit-memos')} className="gap-2 cursor-pointer">
                        <RotateCcw className="h-4 w-4" />
                        Credit Memos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('sales-orders')} className="gap-2 cursor-pointer">
                        <ClipboardList className="h-4 w-4" />
                        Sales Orders
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('customers')} className="gap-2 cursor-pointer">
                        <Users className="h-4 w-4" />
                        Customers
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
                        <Receipt className="h-4 w-4" />
                        Purchases
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => setActiveTab('bills')} className="gap-2 cursor-pointer">
                  <Receipt className="h-4 w-4" />
                  Bills
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('purchase-orders')} className="gap-2 cursor-pointer">
                        <ShoppingCart className="h-4 w-4" />
                        Purchase Orders
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('vendors')} className="gap-2 cursor-pointer">
                  <Truck className="h-4 w-4" />
                  Vendors
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <TabsTrigger value="products" className="gap-2">
                  <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Products</span>
                </TabsTrigger>
                </TabsList>

                <div className="h-10 px-1" />

                <TabsList className="h-10 bg-muted/50">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
                        <BookOpen className="h-4 w-4" />
                        Accounting
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => setActiveTab('accounts')} className="gap-2 cursor-pointer">
                  <Wallet className="h-4 w-4" />
                        Chart of Accounts
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('journal')} className="gap-2 cursor-pointer">
                  <BookOpen className="h-4 w-4" />
                        Journal Entries
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setActiveTab('budgets')} className="gap-2 cursor-pointer">
                  <PiggyBank className="h-4 w-4" />
                  Budgets
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <TabsTrigger value="reports" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="hidden sm:inline">Reports</span>
                </TabsTrigger>
              </TabsList>
              </nav>

              <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={signOut}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign Out
            </button>
              </div>
            </div>
          </div>
          
          {/* Tab Content */}
          <TabsContent value="chat" className="flex-1 m-0 p-0">
            <ChatInterface
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={chatLoading}
            />
          </TabsContent>
          
          <TabsContent value="dashboard" className="flex-1 m-0 p-6 overflow-auto">
            <AccountingDashboard />
          </TabsContent>
          
          <TabsContent value="invoices" className="flex-1 m-0 p-6 overflow-auto">
            <InvoiceManager />
          </TabsContent>
          
          <TabsContent value="credit-memos" className="flex-1 m-0 p-6 overflow-auto">
            <CreditMemoManager />
          </TabsContent>
          
          <TabsContent value="bills" className="flex-1 m-0 p-6 overflow-auto">
            <BillManager />
          </TabsContent>
          
          <TabsContent value="sales-orders" className="flex-1 m-0 p-6 overflow-auto">
            <SalesOrderManager />
          </TabsContent>
          
          <TabsContent value="purchase-orders" className="flex-1 m-0 p-6 overflow-auto">
            <PurchaseOrderManager />
          </TabsContent>
          
          <TabsContent value="customers" className="flex-1 m-0 p-6 overflow-auto">
            <CustomerManager />
          </TabsContent>
          
          <TabsContent value="vendors" className="flex-1 m-0 p-6 overflow-auto">
            <VendorManager />
          </TabsContent>
          
          <TabsContent value="products" className="flex-1 m-0 p-6 overflow-auto">
            <ProductManager />
          </TabsContent>
          
          <TabsContent value="accounts" className="flex-1 m-0 p-6 overflow-auto">
            <AccountsManager />
          </TabsContent>
          
          <TabsContent value="journal" className="flex-1 m-0 p-6 overflow-auto">
            <JournalEntriesView />
          </TabsContent>
          
          <TabsContent value="reports" className="flex-1 m-0 p-6 overflow-auto">
            <ReportsView />
          </TabsContent>
          
          <TabsContent value="budgets" className="flex-1 m-0 p-6 overflow-auto">
            <BudgetManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;