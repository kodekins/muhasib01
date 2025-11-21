/**
 * Import Manager Component
 * UI for importing data from CSV files with column mapping
 */

import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportService, ImportEntityType, ImportResult, CSVPreview, ColumnMapping } from '@/services/importService';
import { ColumnMapper } from './ColumnMapper';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const entityOptions: { value: ImportEntityType; label: string; description: string }[] = [
  { value: 'customers', label: 'Customers', description: 'Import customer records' },
  { value: 'vendors', label: 'Vendors', description: 'Import vendor/supplier records' },
  { value: 'products', label: 'Products & Services', description: 'Import product catalog' },
  { value: 'accounts', label: 'Chart of Accounts', description: 'Import account structure' },
  { value: 'categories', label: 'Categories', description: 'Import transaction categories' }
];

type ImportStep = 'select' | 'upload' | 'map' | 'import' | 'complete';

export const ImportManager: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState<ImportEntityType>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<ImportStep>('select');
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'templates'>('import');

  // Get current user
  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a valid CSV file');
      return;
    }

    setFile(selectedFile);
    setResult(null);

    // Parse CSV and get preview
    const preview = await ImportService.parseCSVWithPreview(selectedFile);
    if (preview.success && preview.data) {
      setCsvPreview(preview.data);
      setCurrentStep('map');
      toast.success(`CSV loaded: ${preview.data.rowCount} rows found`);
    } else {
      toast.error(preview.error || 'Failed to parse CSV');
    }
  };

  const handleDownloadTemplate = () => {
    ImportService.downloadTemplate(selectedEntity);
    toast.success('Template downloaded');
  };

  const handleMappingChange = (mappings: ColumnMapping[]) => {
    setColumnMappings(mappings);
  };

  const handleImport = async () => {
    if (!file || !userId || columnMappings.length === 0) {
      toast.error('Please complete the column mapping');
      return;
    }

    // Validate required fields are mapped
    const availableFields = ImportService.getAvailableFields(selectedEntity);
    const requiredFields = availableFields.filter(f => f.required);
    const mappedFields = new Set(columnMappings.map(m => m.dbField).filter(f => f !== '' && f !== 'skip'));
    const missingRequiredFields = requiredFields.filter(f => !mappedFields.has(f.value));

    if (missingRequiredFields.length > 0) {
      toast.error(`Missing required fields: ${missingRequiredFields.map(f => f.label).join(', ')}`);
      return;
    }

    setImporting(true);
    setCurrentStep('import');
    setResult(null);

    try {
      const response = await ImportService.importWithMapping(
        file,
        selectedEntity,
        columnMappings,
        userId
      );

      if (response.success && response.data) {
        setResult(response.data);
        setCurrentStep('complete');
        if (response.data.successful > 0) {
          toast.success(`Successfully imported ${response.data.successful} records`);
        }
        if (response.data.failed > 0) {
          toast.error(`Failed to import ${response.data.failed} records`);
        }
      } else {
        toast.error(response.error || 'Import failed');
        setCurrentStep('map');
      }
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
      setCurrentStep('map');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvPreview(null);
    setColumnMappings([]);
    setResult(null);
    setCurrentStep('select');
    setActiveTab('import');
  };

  const handleBack = () => {
    if (currentStep === 'map') {
      setFile(null);
      setCsvPreview(null);
      setCurrentStep('select');
    } else if (currentStep === 'complete') {
      handleReset();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Import Data</h1>
          <p className="text-muted-foreground">
            Import your data from CSV files - just upload and map your columns
          </p>
        </div>
        {currentStep !== 'select' && (
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep === 'complete' ? 'New Import' : 'Back'}
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className={`flex items-center gap-2 ${currentStep === 'select' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'select' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            1
          </div>
          <span className="text-sm font-medium">Select Type</span>
        </div>
        
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        
        <div className={`flex items-center gap-2 ${currentStep === 'map' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'map' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            2
          </div>
          <span className="text-sm font-medium">Upload & Map</span>
        </div>
        
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        
        <div className={`flex items-center gap-2 ${currentStep === 'import' || currentStep === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'import' || currentStep === 'complete' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            3
          </div>
          <span className="text-sm font-medium">Import</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'templates')} className="w-full">
        <TabsList>
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="templates">Download Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* Step 1: Select Entity Type */}
          {currentStep === 'select' && (
            <Card>
              <CardHeader>
                <CardTitle>Select What to Import</CardTitle>
                <CardDescription>
                  Choose the type of data you want to import
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entityOptions.map((option) => (
                    <Card
                      key={option.value}
                      className={`cursor-pointer transition-all ${
                        selectedEntity === option.value
                          ? 'ring-2 ring-primary'
                          : 'hover:border-primary'
                      }`}
                      onClick={() => setSelectedEntity(option.value)}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg">{option.label}</CardTitle>
                        <CardDescription className="text-sm">
                          {option.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-4 mt-6">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload">
                      <Button className="w-full" size="lg" asChild>
                        <span>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Your CSV File
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    Don't have a CSV? Download a template or use your existing data file - 
                    we'll help you map the columns in the next step!
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Map Columns */}
          {currentStep === 'map' && csvPreview && (
            <>
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  File: {file?.name} - {csvPreview.rowCount} rows detected
                </AlertDescription>
              </Alert>

              <ColumnMapper
                csvHeaders={csvPreview.headers}
                entityType={selectedEntity}
                previewData={csvPreview.data}
                onMappingChange={handleMappingChange}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button onClick={handleImport} size="lg" disabled={importing}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Import Progress & Results */}
          {(currentStep === 'import' || currentStep === 'complete') && (
            <>
              {importing && (
                <Card>
                  <CardHeader>
                    <CardTitle>Importing...</CardTitle>
                    <CardDescription>
                      Please wait while we import your data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Progress value={undefined} className="w-full" />
                  </CardContent>
                </Card>
              )}

              {result && currentStep === 'complete' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="text-2xl font-bold">{result.total}</div>
                          <div className="text-sm text-muted-foreground">Total</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <div className="text-2xl font-bold">{result.successful}</div>
                          <div className="text-sm text-muted-foreground">Success</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <div>
                          <div className="text-2xl font-bold">{result.failed}</div>
                          <div className="text-sm text-muted-foreground">Failed</div>
                        </div>
                      </div>
                    </div>

                    <Progress
                      value={(result.successful / result.total) * 100}
                      className="w-full"
                    />

                    {result.errors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">Errors:</h4>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {result.errors.slice(0, 10).map((err, idx) => (
                            <Alert key={idx} variant="destructive">
                              <AlertDescription>
                                Row {err.row}: {err.error}
                              </AlertDescription>
                            </Alert>
                          ))}
                          {result.errors.length > 10 && (
                            <Alert>
                              <AlertDescription>
                                ... and {result.errors.length - 10} more errors
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-4 mt-6">
                      <Button onClick={handleReset}>
                        Import More Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CSV Templates</CardTitle>
              <CardDescription>
                Download template files for each import type (optional - you can use your own CSV files!)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entityOptions.map((option) => (
                  <Card key={option.value}>
                    <CardHeader>
                      <CardTitle className="text-lg">{option.label}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          ImportService.downloadTemplate(option.value);
                          toast.success(`${option.label} template downloaded`);
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

