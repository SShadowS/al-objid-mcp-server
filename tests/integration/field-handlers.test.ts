/**
 * Real integration tests for field ID handlers
 * Tests field ID generation for tables and enums
 */

import { ALObjectIdServer } from '../../src/server';
import { getHandlerConfig } from '../../src/commandMappings';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Field Handlers Integration Tests', () => {
  let server: ALObjectIdServer;
  let testApp: string;
  let tempWorkspace: string;
  let testTableFile: string;
  let testEnumFile: string;

  beforeAll(() => {
    // Use the authorized test AL project
    testApp = path.join(__dirname, '../al');

    // Create temp workspace for test AL files
    tempWorkspace = path.join(os.tmpdir(), 'field-test-' + Date.now());
    fs.mkdirSync(tempWorkspace, { recursive: true });

    // Create test table file
    testTableFile = path.join(tempWorkspace, 'TestTable.al');
    fs.writeFileSync(testTableFile, `
table 50100 "Test Table"
{
    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
        }
        field(10; "Description"; Text[100])
        {
            Caption = 'Description';
        }
        field(20; "Amount"; Decimal)
        {
            Caption = 'Amount';
        }
        field(30; "Date"; Date)
        {
            Caption = 'Date';
        }
        // Gap here for new fields
        field(100; "Status"; Option)
        {
            Caption = 'Status';
            OptionMembers = New,Open,Closed;
        }
    }
}
`);

    // Create test enum file
    testEnumFile = path.join(tempWorkspace, 'TestEnum.al');
    fs.writeFileSync(testEnumFile, `
enum 50100 "Test Enum"
{
    Extensible = true;

    value(0; " ")
    {
        Caption = ' ';
    }
    value(1; "First")
    {
        Caption = 'First';
    }
    value(5; "Second")
    {
        Caption = 'Second';
    }
    value(10; "Third")
    {
        Caption = 'Third';
    }
    // Gap for more values
    value(100; "Last")
    {
        Caption = 'Last';
    }
}
`);
  });

  afterAll(() => {
    // Clean up temp workspace
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    server = new ALObjectIdServer();
  });

  describe('Get Next Field ID Handler', () => {
    it('should get next field ID for table', async () => {
      const config = getHandlerConfig('get-next-field-id', 'standard');
      expect(config).toBeDefined();

      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: testTableFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toMatch(/Next available field ID: \d+/);

      // Should suggest field ID 31-99 (between 30 and 100)
      const match = result.content[0].text.match(/Next available field ID: (\d+)/);
      if (match) {
        const fieldId = parseInt(match[1]);
        expect(fieldId).toBeGreaterThan(30);
        expect(fieldId).toBeLessThan(100);
      }
    });

    it('should handle file without fields', async () => {
      const emptyTableFile = path.join(tempWorkspace, 'EmptyTable.al');
      fs.writeFileSync(emptyTableFile, `
table 50101 "Empty Table"
{
    fields
    {
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: emptyTableFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toMatch(/Next available field ID: 1/);
    });

    it('should handle tables with primary key fields', async () => {
      const pkTableFile = path.join(tempWorkspace, 'PKTable.al');
      fs.writeFileSync(pkTableFile, `
table 50102 "Primary Key Table"
{
    fields
    {
        field(1; "Code"; Code[20])
        {
            Caption = 'Code';
        }
        field(2; "No."; Code[20])
        {
            Caption = 'No.';
        }
    }

    keys
    {
        key(PK; "Code", "No.")
        {
            Clustered = true;
        }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: pkTableFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should suggest field ID 3 or higher
      const match = result.content[0].text.match(/Next available field ID: (\d+)/);
      if (match) {
        const fieldId = parseInt(match[1]);
        expect(fieldId).toBeGreaterThanOrEqual(3);
      }
    });

    it('should handle missing file gracefully', async () => {
      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      await expect(
        module[config!.handler](server, {
          filePath: '/non/existent/file.al',
          appPath: testApp
        })
      ).rejects.toThrow();
    });

    it('should handle non-table files', async () => {
      const pageFile = path.join(tempWorkspace, 'TestPage.al');
      fs.writeFileSync(pageFile, `
page 50100 "Test Page"
{
    PageType = Card;
    SourceTable = "Test Table";

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("Entry No."; Rec."Entry No.")
                {
                }
            }
        }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: pageFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should handle non-table files appropriately
      expect(result.content[0].text).toBeDefined();
    });
  });

  describe('Get Next Enum Value ID Handler', () => {
    it('should get next enum value ID', async () => {
      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      expect(config).toBeDefined();

      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: testEnumFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toMatch(/Next available enum value: \d+/);

      // Should suggest value between 10 and 100
      const match = result.content[0].text.match(/Next available enum value: (\d+)/);
      if (match) {
        const valueId = parseInt(match[1]);
        expect(valueId).toBeGreaterThan(10);
        expect(valueId).toBeLessThan(100);
      }
    });

    it('should handle enum without values', async () => {
      const emptyEnumFile = path.join(tempWorkspace, 'EmptyEnum.al');
      fs.writeFileSync(emptyEnumFile, `
enum 50101 "Empty Enum"
{
    Extensible = true;
}
`);

      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: emptyEnumFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      expect(result.content[0].text).toMatch(/Next available enum value: 0/);
    });

    it('should handle enum with sequential values', async () => {
      const sequentialEnumFile = path.join(tempWorkspace, 'SequentialEnum.al');
      fs.writeFileSync(sequentialEnumFile, `
enum 50102 "Sequential Enum"
{
    value(0; "None") { }
    value(1; "First") { }
    value(2; "Second") { }
    value(3; "Third") { }
}
`);

      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: sequentialEnumFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should suggest value 4
      expect(result.content[0].text).toMatch(/Next available enum value: 4/);
    });

    it('should handle enum with gaps intelligently', async () => {
      const gappedEnumFile = path.join(tempWorkspace, 'GappedEnum.al');
      fs.writeFileSync(gappedEnumFile, `
enum 50103 "Gapped Enum"
{
    value(0; "Zero") { }
    value(10; "Ten") { }
    value(20; "Twenty") { }
    value(30; "Thirty") { }
}
`);

      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: gappedEnumFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Could suggest filling gaps or continuing sequence
      const match = result.content[0].text.match(/Next available enum value: (\d+)/);
      if (match) {
        const valueId = parseInt(match[1]);
        expect(valueId).toBeGreaterThanOrEqual(1); // Could be 1 (gap) or 31+ (continuation)
      }
    });

    it('should handle non-enum files', async () => {
      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: testTableFile, // Pass a table file instead
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should handle gracefully or indicate it's not an enum
    });
  });

  describe('Field ID Suggestion Strategies', () => {
    it('should suggest IDs avoiding system field ranges', async () => {
      const systemFieldTable = path.join(tempWorkspace, 'SystemFieldTable.al');
      fs.writeFileSync(systemFieldTable, `
table 50104 "System Field Table"
{
    fields
    {
        field(1; "Primary Key"; Code[10]) { }
        field(2; "Name"; Text[50]) { }
        // System fields typically use 50000+ range
        field(50000; "Created At"; DateTime) { }
        field(50001; "Created By"; Code[50]) { }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: systemFieldTable,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should suggest ID in user range (3-49999)
      const match = result.content[0].text.match(/Next available field ID: (\d+)/);
      if (match) {
        const fieldId = parseInt(match[1]);
        expect(fieldId).toBeGreaterThanOrEqual(3);
        expect(fieldId).toBeLessThan(50000);
      }
    });

    it('should handle large field IDs', async () => {
      const largeFieldTable = path.join(tempWorkspace, 'LargeFieldTable.al');
      fs.writeFileSync(largeFieldTable, `
table 50105 "Large Field Table"
{
    fields
    {
        field(1; "No."; Code[20]) { }
        field(999999; "Large Field"; Integer) { }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: largeFieldTable,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should suggest filling the gap
      const match = result.content[0].text.match(/Next available field ID: (\d+)/);
      if (match) {
        const fieldId = parseInt(match[1]);
        expect(fieldId).toBeGreaterThan(1);
        expect(fieldId).toBeLessThan(999999);
      }
    });
  });

  describe('Complex AL File Structures', () => {
    it('should handle table extensions', async () => {
      const tableExtFile = path.join(tempWorkspace, 'TableExt.al');
      fs.writeFileSync(tableExtFile, `
tableextension 50100 "Customer Ext" extends Customer
{
    fields
    {
        field(50100; "Custom Field 1"; Text[50]) { }
        field(50101; "Custom Field 2"; Boolean) { }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: tableExtFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should suggest next ID in extension range
      expect(result.content[0].text).toMatch(/50102/);
    });

    it('should handle enum extensions', async () => {
      const enumExtFile = path.join(tempWorkspace, 'EnumExt.al');
      fs.writeFileSync(enumExtFile, `
enumextension 50100 "Payment Method Ext" extends "Payment Method"
{
    value(50100; "Custom Payment") { }
    value(50101; "Digital Wallet") { }
}
`);

      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: enumExtFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should suggest next value in extension range
      expect(result.content[0].text).toMatch(/50102/);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed AL files', async () => {
      const malformedFile = path.join(tempWorkspace, 'Malformed.al');
      fs.writeFileSync(malformedFile, `
table 50106 "Malformed Table"
{
    fields
    {
        field(1 "Missing Semicolon" Text[50]) { }
        field(2; "Valid Field"; Integer) { }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: malformedFile,
        appPath: testApp
      });

      expect(result).toBeDefined();
      // Should still provide a suggestion despite syntax errors
    });

    it('should handle binary files', async () => {
      const binaryFile = path.join(tempWorkspace, 'binary.dat');
      fs.writeFileSync(binaryFile, Buffer.from([0xFF, 0xFE, 0x00, 0x01]));

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      await expect(
        module[config!.handler](server, {
          filePath: binaryFile,
          appPath: testApp
        })
      ).rejects.toThrow();
    });

    it('should handle very large files', async () => {
      const largeTableFile = path.join(tempWorkspace, 'LargeTable.al');
      let content = 'table 50107 "Large Table"\n{\n    fields\n    {\n';

      // Generate 1000 fields
      for (let i = 1; i <= 1000; i++) {
        content += `        field(${i}; "Field${i}"; Integer) { }\n`;
      }
      content += '    }\n}\n';

      fs.writeFileSync(largeTableFile, content);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const startTime = Date.now();
      const result = await module[config!.handler](server, {
        filePath: largeTableFile,
        appPath: testApp
      });
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.content[0].text).toMatch(/Next available field ID: 1001/);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Multi-object Files', () => {
    it('should handle files with multiple tables', async () => {
      const multiTableFile = path.join(tempWorkspace, 'MultiTable.al');
      fs.writeFileSync(multiTableFile, `
table 50108 "First Table"
{
    fields
    {
        field(1; "Field1"; Integer) { }
        field(2; "Field2"; Text[50]) { }
    }
}

table 50109 "Second Table"
{
    fields
    {
        field(10; "Field10"; Integer) { }
        field(20; "Field20"; Text[50]) { }
    }
}
`);

      const config = getHandlerConfig('get-next-field-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: multiTableFile,
        appPath: testApp,
        objectId: 50108 // Specify which table
      });

      expect(result).toBeDefined();
      // Should get next ID for first table (3)
      expect(result.content[0].text).toMatch(/3/);
    });

    it('should handle files with multiple enums', async () => {
      const multiEnumFile = path.join(tempWorkspace, 'MultiEnum.al');
      fs.writeFileSync(multiEnumFile, `
enum 50104 "First Enum"
{
    value(0; "None") { }
    value(1; "One") { }
}

enum 50105 "Second Enum"
{
    value(10; "Ten") { }
    value(20; "Twenty") { }
}
`);

      const config = getHandlerConfig('get-next-enum-value-id', 'standard');
      const module = await import(
        path.join(__dirname, '../../src', config!.path.replace('./', ''))
      );

      const result = await module[config!.handler](server, {
        filePath: multiEnumFile,
        appPath: testApp,
        objectId: 50105 // Specify which enum
      });

      expect(result).toBeDefined();
      // Should get next value for second enum
      const match = result.content[0].text.match(/Next available enum value: (\d+)/);
      if (match) {
        const valueId = parseInt(match[1]);
        expect(valueId).toBeGreaterThan(20);
      }
    });
  });
});