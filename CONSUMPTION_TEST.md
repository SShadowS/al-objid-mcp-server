# Consumption Report Test

This directory contains test scripts to fetch consumption reports for AL app folders.

## Prerequisites

1. The AL app must be authorized with Object ID Ninja
2. The app folder must contain:
   - `app.json` file with app metadata
   - `.bclicense` file with `authKey=your-auth-key` line OR `.objidconfig` with authKey

## Usage Options

### Option 1: Windows Batch Script (Easiest)
```cmd
test-consumption-report.bat "C:\Path\To\Your\ALApp"
```

### Option 2: Node.js (Cross-platform)
```bash
# First build the project
npm run build

# Then run the test
node test-consumption-report.js "C:\Path\To\Your\ALApp"
```

### Option 3: TypeScript (Development)
```bash
npx ts-node test-consumption-report.ts "C:\Path\To\Your\ALApp"
```

## Expected Output

The script will:

1. **Load App Information**
   - Read `app.json` for app name, ID, and version
   - Find auth key from `.bclicense` or `.objidconfig`

2. **Fetch Consumption Report**
   - Connect to the Object ID Ninja backend
   - Retrieve all consumed object IDs for the app

3. **Display Results**
   ```
   📊 Object ID Consumption:
   ----------------------------------------
      table: 5 IDs (50000, 50001, 50002, 50003, 50004)
      page: 3 IDs (60000, 60001, 60002)
      codeunit: 2 IDs (70000, 70001)
   ----------------------------------------
      Total: 10 consumed IDs
   ```

## Troubleshooting

### "No auth key found"
- Ensure your app is authorized with Object ID Ninja VSCode extension
- Check that `.bclicense` contains `authKey=your-key-here` line
- Or ensure `.objidconfig` contains `"authKey": "your-key-here"`

### "Failed to retrieve consumption report"
- Verify the auth key is correct
- Check internet connectivity
- Ensure the app is properly authorized in the Object ID Ninja backend

### "app.json not found"
- Make sure you're pointing to the correct AL app folder
- The folder should contain the AL app source code and manifest

## File Locations

The script looks for auth keys in these locations (in order):

1. `.bclicense` file: `authKey=your-key-here`
2. `.objidconfig` file: `"authKey": "your-key-here"`

## Example App Structure

```
MyALApp/
├── app.json                 # App manifest (required)
├── .bclicense              # Contains authKey (preferred)
├── .objidconfig            # Alternative auth key location
├── src/
│   ├── Tables/
│   ├── Pages/
│   └── Codeunits/
└── ...
```