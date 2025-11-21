/**
 * Column Mapper Component
 * Allows users to map CSV columns to database fields
 */

import React from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ImportEntityType, ImportService, ColumnMapping } from '@/services/importService';

interface ColumnMapperProps {
  csvHeaders: string[];
  entityType: ImportEntityType;
  previewData: any[];
  onMappingChange: (mappings: ColumnMapping[]) => void;
  initialMappings?: ColumnMapping[];
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  csvHeaders,
  entityType,
  previewData,
  onMappingChange,
  initialMappings
}) => {
  const [mappings, setMappings] = React.useState<ColumnMapping[]>(
    initialMappings || csvHeaders.map(header => ({
      csvColumn: header,
      dbField: ''
    }))
  );

  const availableFields = ImportService.getAvailableFields(entityType);
  const requiredFields = availableFields.filter(f => f.required);

  // Auto-detect mappings based on similar column names
  React.useEffect(() => {
    if (!initialMappings) {
      const autoMappings = csvHeaders.map(header => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Try to find matching field
        const matchedField = availableFields.find(field => {
          const normalizedField = field.value.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          return normalizedHeader === normalizedField || 
                 normalizedHeader === normalizedLabel ||
                 normalizedHeader.includes(normalizedField) ||
                 normalizedField.includes(normalizedHeader);
        });

        return {
          csvColumn: header,
          dbField: matchedField?.value || 'skip'
        };
      });

      setMappings(autoMappings);
      onMappingChange(autoMappings);
    }
  }, []);

  const handleMappingChange = (csvColumn: string, dbField: string) => {
    const newMappings = mappings.map(m => 
      m.csvColumn === csvColumn ? { ...m, dbField } : m
    );
    setMappings(newMappings);
    onMappingChange(newMappings);
  };

  // Check if all required fields are mapped
  const mappedFields = new Set(mappings.map(m => m.dbField).filter(f => f !== '' && f !== 'skip'));
  const missingRequiredFields = requiredFields.filter(f => !mappedFields.has(f.value));

  return (
    <div className="space-y-6">
      {missingRequiredFields.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Missing required fields: {missingRequiredFields.map(f => f.label).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Map Your Columns</CardTitle>
          <CardDescription>
            Match your CSV columns to our database fields. Required fields are marked with a badge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {csvHeaders.map((header, index) => {
            const mapping = mappings.find(m => m.csvColumn === header);
            const selectedField = availableFields.find(f => f.value === mapping?.dbField);
            
            return (
              <div key={header} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_2fr] gap-4 items-center p-4 border rounded-lg">
                {/* CSV Column */}
                <div>
                  <div className="font-medium text-sm">CSV Column</div>
                  <div className="text-muted-foreground">{header}</div>
                  {previewData[0] && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      Example: {previewData[0][header] || '(empty)'}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="hidden md:flex justify-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Database Field Selector */}
                <div>
                  <Select
                    value={mapping?.dbField || 'skip'}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">-- Skip this column --</SelectItem>
                      {availableFields.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label} {field.required && '(Required)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Field Info */}
                <div className="flex items-center gap-2">
                  {selectedField?.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {mapping?.dbField && mapping?.dbField !== 'skip' && !selectedField?.required && (
                    <Badge variant="secondary" className="text-xs">
                      Optional
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Preview mapped data */}
      <Card>
        <CardHeader>
          <CardTitle>Preview (First Row)</CardTitle>
          <CardDescription>
            This is how your data will be imported
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mappings
              .filter(m => m.dbField && m.dbField !== 'skip')
              .map(mapping => {
                const field = availableFields.find(f => f.value === mapping.dbField);
                const value = previewData[0]?.[mapping.csvColumn];
                
                return (
                  <div key={mapping.csvColumn} className="flex justify-between items-center p-2 border-b">
                    <span className="font-medium">{field?.label}:</span>
                    <span className="text-muted-foreground">
                      {value || '(empty)'}
                    </span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


