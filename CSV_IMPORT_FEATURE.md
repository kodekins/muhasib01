# CSV Import Feature

## Overview
The CSV Import feature allows users to import their existing data from CSV files without requiring them to follow a specific template format. The system provides an intelligent column mapping interface that auto-detects field matches and guides users through the import process.

## Key Features

### ✨ Smart Column Mapping
- **Auto-Detection**: Automatically matches CSV columns to database fields based on similar names
- **Visual Mapping Interface**: Intuitive drag-and-drop style interface to map columns
- **Preview**: See how your data will be imported before committing
- **Required Field Validation**: Clear indication of which fields are mandatory

### 📊 Supported Entities
1. **Customers** - Import customer/client records
2. **Vendors** - Import vendor/supplier records
3. **Products & Services** - Import product catalog
4. **Chart of Accounts** - Import account structure
5. **Categories** - Import transaction categories

### 🎯 Import Process (3 Steps)

#### Step 1: Select Entity Type
- Choose what type of data you want to import
- Upload your CSV file (any format)

#### Step 2: Map Columns
- System auto-detects and suggests column mappings
- Review and adjust mappings as needed
- Preview how first row will be imported
- Validation for required fields

#### Step 3: Import & Review
- Import process with real-time feedback
- Detailed success/failure statistics
- Error reporting with row-by-row details

## How to Use

### For Users

1. **Navigate to Import Tab**
   - Click on "Import" in the top navigation bar

2. **Select Entity Type**
   - Choose what you want to import (Customers, Products, etc.)

3. **Upload Your CSV**
   - Click "Upload Your CSV File"
   - Select your existing CSV file (any format)

4. **Map Your Columns**
   - System will auto-detect matching columns
   - Review suggested mappings
   - Adjust any incorrect mappings using dropdowns
   - Required fields are clearly marked

5. **Import**
   - Click "Import Data"
   - Review results
   - Check any errors if present

### CSV Format Examples

#### Customers CSV (any column names work!)
```csv
Customer Name,Email Address,Phone,Street Address,Company,Tax ID,Terms,Limit,Special Notes
John Doe,john@example.com,555-1234,123 Main St,Acme Corp,TAX123,30,10000,VIP customer
Jane Smith,jane@smith.com,555-5678,456 Oak Ave,Smith Inc,TAX456,45,25000,Regular customer
```

#### Products CSV
```csv
Product Name,Item Type,Item Code,Details,Price,Cost Price,Track Stock,Stock Qty,Reorder At,Tax?,Tax %,Unit
Consulting,service,CONS-001,Hourly consultation,150.00,0,No,0,0,Yes,0,hour
Widget A,product,WID-001,Standard widget,25.00,10.00,Yes,100,20,Yes,10,piece
```

## Field Mappings

### Customers/Vendors Fields
- **Name** (required) - Customer/Vendor name
- **Email** - Email address
- **Phone** - Contact phone number
- **Address** - Physical address
- **Company Name** - Company/business name
- **Tax Number** - Tax ID or VAT number
- **Payment Terms** - Payment terms in days (default: 30)
- **Credit Limit** - Maximum credit limit
- **Notes** - Additional notes

### Products Fields
- **Name** (required) - Product/service name
- **Type** - service/product/inventory (default: service)
- **SKU** - Stock keeping unit / item code
- **Description** - Product description
- **Unit Price** (required) - Selling price
- **Cost** - Cost price
- **Track Inventory** - yes/no (default: no)
- **Quantity on Hand** - Current stock quantity
- **Reorder Point** - Minimum stock level
- **Taxable** - yes/no (default: yes)
- **Tax Rate** - Tax percentage
- **Unit of Measure** - Unit (e.g., hour, piece, kg)

### Accounts Fields
- **Name** (required) - Account name
- **Code** - Account code/number
- **Type** (required) - asset/liability/equity/revenue/expense
- **Description** - Account description

### Categories Fields
- **Name** (required) - Category name
- **Description** - Category description
- **Color** - Hex color code (e.g., #4CAF50)

## Technical Implementation

### Architecture

#### Components
1. **ImportManager** (`src/components/import/ImportManager.tsx`)
   - Main import wizard component
   - 3-step wizard flow
   - State management for import process

2. **ColumnMapper** (`src/components/import/ColumnMapper.tsx`)
   - Column mapping interface
   - Auto-detection logic
   - Preview display

#### Services
1. **ImportService** (`src/services/importService.ts`)
   - CSV parsing using PapaParse
   - Column mapping logic
   - Data transformation
   - Import execution

### Key Functions

#### `parseCSVWithPreview(file: File)`
Parses CSV and returns preview of first 5 rows with headers

#### `getAvailableFields(entityType)`
Returns list of available database fields for mapping

#### `transformRowWithMapping(row, mappings, entityType, userId)`
Transforms CSV row data using user's column mappings with proper type conversions

#### `importWithMapping(file, entityType, mappings, userId)`
Executes import with user-defined column mappings

### Data Transformations

The system automatically handles:
- **Number conversions** - Parses prices, costs, quantities
- **Boolean conversions** - yes/no/true/false → boolean
- **Type validation** - Validates enum values (account_type, product type)
- **Default values** - Applies sensible defaults for optional fields
- **Empty value handling** - Skips empty/null values appropriately

## Benefits

### For Users
- ✅ No need to reformat existing data
- ✅ Visual feedback at every step
- ✅ Clear error messages
- ✅ Preview before importing
- ✅ Can correct mistakes before import

### For System
- ✅ Flexible input format
- ✅ Data validation at import time
- ✅ Proper type conversions
- ✅ Row-by-row error tracking
- ✅ User-specific data isolation

## Future Enhancements

### Planned Features
1. **Duplicate Detection** - Warn about existing records before import
2. **Batch Processing** - Handle very large CSV files (10,000+ rows)
3. **Import History** - Track all imports with rollback capability
4. **Field Transformation Rules** - Custom transformations (e.g., date formats)
5. **Multi-file Import** - Import related data (invoices + line items)
6. **Background Jobs** - Async imports for large datasets
7. **Import Templates** - Save column mappings for repeated use
8. **Data Validation Rules** - Custom validation before import

### Invoice/Bill Import
More complex import for invoices and bills with line items:
- Two-step import (header + line items)
- Relationship validation
- Account linking
- Payment tracking

## Error Handling

### Common Errors & Solutions

**"Missing required fields"**
- Solution: Map all required fields (marked with red badge)

**"Invalid type value"**
- Solution: Ensure type fields contain valid values (e.g., 'asset', 'product')

**"Duplicate entry"**
- Solution: Check for duplicate codes/SKUs in database

**"Failed to import X records"**
- Solution: Review error details for each failed row

## Testing

### Test Import Flow
1. Create sample CSV with your data
2. Navigate to Import tab
3. Select entity type
4. Upload CSV
5. Verify auto-detected mappings
6. Adjust any incorrect mappings
7. Review preview
8. Import
9. Verify imported data in respective manager

### Sample Test Data
Sample CSV files are provided in the "Download Templates" tab, but any CSV format will work with the column mapper.

## Support

For issues or questions:
1. Check column mappings are correct
2. Verify required fields are mapped
3. Check CSV file format (UTF-8 encoding recommended)
4. Review error messages for specific issues

---

**Last Updated**: November 21, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅



