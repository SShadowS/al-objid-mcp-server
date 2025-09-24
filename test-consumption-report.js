#!/usr/bin/env ts-node
"use strict";
/**
 * Test script to fetch consumption report for an AL app folder
 * Usage: npx ts-node test-consumption-report.ts <app-folder-path>
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const BackendService_1 = require("./dist/lib/backend/BackendService");
function findAppJson(appPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const appJsonPath = path.join(appPath, 'app.json');
        if (!fs.existsSync(appJsonPath)) {
            throw new Error(`app.json not found in ${appPath}`);
        }
        const content = fs.readFileSync(appJsonPath, 'utf8');
        return JSON.parse(content);
    });
}
function findObjIdConfig(appPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const objIdConfigPath = path.join(appPath, '.objidconfig');
        if (!fs.existsSync(objIdConfigPath)) {
            return null;
        }
        const content = fs.readFileSync(objIdConfigPath, 'utf8');
        // Remove comments for JSON parsing
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        return JSON.parse(cleanContent);
    });
}
function findAuthKey(appPath) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check .bclicense file
        const bcLicensePath = path.join(appPath, '.bclicense');
        if (fs.existsSync(bcLicensePath)) {
            const content = fs.readFileSync(bcLicensePath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.startsWith('authKey=')) {
                    return line.substring('authKey='.length).trim();
                }
            }
        }
        // Check .objidconfig for authKey
        const objIdConfig = yield findObjIdConfig(appPath);
        if (objIdConfig && objIdConfig.authKey) {
            return objIdConfig.authKey;
        }
        return undefined;
    });
}
function loadAppFromFolder(appPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const absolutePath = path.resolve(appPath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`App folder does not exist: ${absolutePath}`);
        }
        const appJson = yield findAppJson(absolutePath);
        const authKey = yield findAuthKey(absolutePath);
        const app = {
            name: appJson.name,
            appId: appJson.id,
            version: appJson.version,
            path: absolutePath,
            authKey
        };
        return app;
    });
}
function testConsumptionReport(appPath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🚀 AL Object ID Ninja - Consumption Report Test');
        console.log('='.repeat(60));
        try {
            // Load app information
            console.log(`📂 Loading app from: ${appPath}`);
            const app = yield loadAppFromFolder(appPath);
            console.log(`📱 App: ${app.name} v${app.version}`);
            console.log(`🆔 App ID: ${app.appId}`);
            console.log(`🔐 Auth Key: ${app.authKey ? app.authKey.substring(0, 8) + '...' : 'NOT FOUND'}`);
            console.log();
            if (!app.authKey) {
                console.log('❌ No auth key found. Please ensure the app is authorized with Object ID Ninja.');
                console.log('   Auth key should be in .bclicense file as: authKey=your-key-here');
                return;
            }
            // Initialize backend service
            const backendService = new BackendService_1.BackendService();
            console.log('🌐 Fetching consumption report...');
            // Fetch consumption report
            const request = {
                appId: app.appId,
                authKey: app.authKey
            };
            const result = yield backendService.getConsumption(request);
            if (!result) {
                console.log('❌ Failed to retrieve consumption report');
                console.log('   Possible causes:');
                console.log('   - Invalid auth key');
                console.log('   - App not authorized');
                console.log('   - Network connectivity issues');
                return;
            }
            console.log('✅ Consumption report retrieved successfully!');
            console.log();
            console.log('📊 Object ID Consumption:');
            console.log('-'.repeat(40));
            let totalIds = 0;
            const objectTypes = Object.keys(result).sort();
            if (objectTypes.length === 0) {
                console.log('   No consumed IDs found');
            }
            else {
                for (const objectType of objectTypes) {
                    const ids = result[objectType];
                    if (ids && ids.length > 0) {
                        totalIds += ids.length;
                        const preview = ids.slice(0, 5).join(', ');
                        const suffix = ids.length > 5 ? `... (+${ids.length - 5} more)` : '';
                        console.log(`   ${objectType}: ${ids.length} IDs (${preview}${suffix})`);
                    }
                }
                console.log('-'.repeat(40));
                console.log(`   Total: ${totalIds} consumed IDs`);
            }
        }
        catch (error) {
            console.log(`❌ Error: ${error.message}`);
            if (error.stack) {
                console.log('\nStack trace:');
                console.log(error.stack);
            }
        }
    });
}
// Main execution
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        if (args.length === 0) {
            console.log('Usage: npx ts-node test-consumption-report.ts <app-folder-path>');
            console.log('');
            console.log('Example:');
            console.log('  npx ts-node test-consumption-report.ts "C:\\MyALApps\\MyApp"');
            console.log('  npx ts-node test-consumption-report.ts ./my-al-app');
            process.exit(1);
        }
        const appPath = args[0];
        yield testConsumptionReport(appPath);
    });
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=test-consumption-report.js.map