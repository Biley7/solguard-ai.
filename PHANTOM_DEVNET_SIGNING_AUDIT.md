# SolGuard AI — Phantom Live Devnet Signing Root-Cause Audit

**Document:** Technical Root-Cause Audit & Resolution Architecture  
**Target:** Live Phantom Transaction Approval Failure on Solana Devnet  
**Date:** November 22, 2026  
**Auditor:** Senior Staff Software Engineer & Blockchain Security Architect  
**Status:** Complete (Awaiting User Implementation Approval)  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Observed Runtime Symptoms & Context](#2-observed-runtime-symptoms--context)
3. [Architecture Overview & Interacting Layers](#3-architecture-overview--interacting-layers)
4. [Root Cause Analysis (Evidence-Based)](#4-root-cause-analysis-evidence-based)
   - [Root Cause 1: Asynchronous `Transaction.prototype.serialize` in `@solana/web3.js` v3](#root-cause-1-asynchronous-transactionprototypeserialize-in-solanaweb3js-v3)
   - [Root Cause 2: Missing `Buffer` Global in Modern Vite Browser Environment](#root-cause-2-missing-buffer-global-in-modern-vite-browser-environment)
   - [Root Cause 3: Test Double Illusion (Why 109 Automated Tests Passed)](#root-cause-3-test-double-illusion-why-109-automated-tests-passed)
5. [Downstream Blockers in the Execution Pipeline](#5-downstream-blockers-in-the-execution-pipeline)
   - [Blocker A: Unawaited `serialize()` Call at Line 359](#blocker-a-unawaited-serialize-call-at-line-359)
   - [Blocker B: Fragile `instanceof Transaction` Check Across Bundle Boundaries](#blocker-b-fragile-instanceof-transaction-check-across-bundle-boundaries)
   - [Blocker C: H-01 Post-Sign Integrity Check vs. Phantom Auto-Priority Fees](#blocker-c-h-01-post-sign-integrity-check-vs-phantom-auto-priority-fees)
6. [Minimal Root-Cause Fix Plan](#6-minimal-root-cause-fix-plan)
   - [Step 1: Bundler & Browser Global Polyfills](#step-1-bundler--browser-global-polyfills)
   - [Step 2: Provider Transaction Normalization Adapter](#step-2-provider-transaction-normalization-adapter)
   - [Step 3: Execution Pipeline Hardening](#step-3-execution-pipeline-hardening)
   - [Step 4: Upfront Compute Budget Alignment](#step-4-upfront-compute-budget-alignment)
7. [Security & Devnet Guard Verification](#7-security--devnet-guard-verification)
8. [Next Steps & Sign-off](#8-next-steps--sign-off)

---

## 1. Executive Summary

During initial end-to-end integration testing on Solana Devnet, SolGuard AI successfully connects to Phantom Wallet (funded with 2.5 Devnet SOL), queries account balances, executes Wallet X-Ray inspections, runs Gemini-powered prompt interpretations, validates recipient public keys, and passes pre-flight RPC simulations.

However, upon clicking **"Approve with Phantom"** in the review modal, the application abruptly terminates at:
`frontend/src/services/wallet/phantom-wallet.js:178` (`await wallet.signTransaction(transaction)`), throwing:
```text
PhantomWalletError: SIGNING_FAILED: Phantom could not sign the transaction.
```

This audit provides an exhaustive root-cause investigation across the browser frontend, the Phantom wallet provider bridge, the Solana transaction execution pipeline, and Vite bundler configurations. 

**Core Finding:** The failure is caused by an architectural incompatibility between **`@solana/web3.js` version 3.2.0** and the **Phantom browser extension's injected provider**. In `@solana/web3.js` v3, `Transaction.prototype.serialize` is an `async` function that returns a `Promise<Uint8Array>`. The Phantom in-page extension script, which was architected for `@solana/web3.js` v1, expects a synchronous byte array and attempts immediate base58 wire encoding on the returned `Promise`, causing an immediate internal crash before the approval popup can be displayed. Furthermore, the Vite bundle lacks a browser polyfill for Node's `Buffer`, which legacy wallet extensions require.

Even if line 178 is bypassed, the downstream execution pipeline contains three fatal blockers (unawaited `serialize()` at line 359, prototype mismatch at line 193, and collision between the H-01 message tamper check and Phantom's auto-priority fee injection).

---

## 2. Observed Runtime Symptoms & Context

* **Network Environment:** Solana Devnet (`https://api.devnet.solana.com`).
* **Wallet State:** Phantom browser extension in **Testnet Mode** on **Solana Devnet**, holding 2.5 Devnet SOL.
* **Pre-requisite Stages Passing:**
  - `wallet.connect()` succeeds; Devnet public key correctly parsed and formatted.
  - `Wallet X-Ray` successfully reads balance, owner, and recent Devnet signatures.
  - `AI Copilot` parses transfer commands and passes deterministic schema validation.
  - `Recipient scan` verifies recipient account owner is the System Program.
  - `Devnet simulation` (`connection.simulateTransaction`) succeeds with 0 errors.
* **Point of Failure:**
  - File: `frontend/src/services/wallet/phantom-wallet.js`
  - Failing Line: `178` (`return await wallet.signTransaction(transaction);`)
  - Catch Block Hit: Line `184` (`throw new PhantomWalletError('SIGNING_FAILED', ...);`)

---

## 3. Architecture Overview & Interacting Layers

The signing workflow spans four distinct subsystems with different module boundaries and runtime environments:

```
+-----------------------------------------------------------------------------------------+
| BROWSER CONTEXT (Vite 8.3.6 / Vanilla ES2022)                                           |
|                                                                                         |
|  [App UI] ---> [transaction-executor.js] ---> [phantom-wallet.js]                      |
|                      |                              |                                   |
|                      | (reviewedTransaction)        | (window.phantom.solana)           |
|                      v                              v                                   |
|              @solana/web3.js v3.2.0           Phantom In-Page Provider                  |
|              - Async serialize()              - Expects sync serialize()               |
|              - Uint8Array native              - Expects Buffer global                   |
|              - Modular Kit internals          - Bundles web3.js v1                     |
+-----------------------------------------------------------------------------------------+
                                                      |
                                        window.postMessage() (IPC)
                                                      v
+-----------------------------------------------------------------------------------------+
| PHANTOM EXTENSION BACKGROUND & POPUP (Isolated Extension Sandbox)                       |
|                                                                                         |
|  [Extension Background Service] <---> [Phantom Approval Popup UI]                       |
|  - Deserializes wire transaction                                                        |
|  - Injects auto-priority fee (ComputeBudgetProgram)                                     |
|  - Cryptographically signs with Ed25519 user private key                               |
|  - Returns signed wire transaction bytes                                                |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Root Cause Analysis (Evidence-Based)

### Root Cause 1: Asynchronous `Transaction.prototype.serialize` in `@solana/web3.js` v3

In `@solana/web3.js` version 1.x (e.g., `1.95.8`), `Transaction.prototype.serialize` was a **synchronous** function returning a `Buffer` or `Uint8Array`.

In `@solana/web3.js` version 3.2.0 (installed in `package.json:25`), the legacy `Transaction` class was completely rewritten as an asynchronous compatibility adapter on top of the new `@solana/kit` and `@noble/curves` libraries.

#### Code Evidence:
In `node_modules/@solana/web3.js/lib/index.browser.esm.js` (lines 1515–1531):
```javascript
async serialize(config) {
    const { requireAllSignatures, verifySignatures } = Object.assign({
        requireAllSignatures: true,
        verifySignatures: true
    }, config);
    const signData = this.serializeMessage();
    if (verifySignatures) {
        const sigErrors = await this._getMessageSignednessErrors(signData, requireAllSignatures);
        if (sigErrors) {
            let errorMessage = "Signature verification failed.";
            ...
            throw new Error(errorMessage);
        }
    }
    return this._serialize(signData);
}
```

Because `verifySignatures` calls `verify()` from `@noble/curves` (which is asynchronous), `serialize` is declared `async`. Even when called with `{ verifySignatures: false }`, JavaScript guarantees that an `async` method **always returns a `Promise`**.

#### The Phantom Breakdown:
When `wallet.signTransaction(reviewedTransaction)` is invoked:
1. Phantom's injected provider script executes `transaction.serialize({ requireAllSignatures: false, verifySignatures: false })`.
2. Instead of receiving a byte array, Phantom receives a `Promise<Uint8Array>`.
3. Phantom immediately executes base58 encoding (e.g., `bs58.encode(serialized)`) or inspects `serialized.length`.
4. Passing a `Promise` into a synchronous byte encoder throws an unhandled exception inside Phantom's in-page script (`TypeError: Cannot read properties of Promise` or `Invalid transaction`).
5. Phantom catches this internal error and rejects the signing request, triggering line 185 of `phantom-wallet.js`.

---

### Root Cause 2: Missing `Buffer` Global in Modern Vite Browser Environment

#### Code Evidence:
* `package.json`:
  ```json
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.5",
    "vite": "^8.3.6"
  }
  ```
* `vite.config.js` (lines 42–48):
  ```javascript
  return {
    root: 'frontend',
    plugins: [tailwindcss()],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    ...
  };
  ```

#### The Problem:
Vite is designed for modern ESM standards and deliberately does not include Node.js polyfills. In standard browser runtimes:
`globalThis.Buffer === undefined`

Phantom Wallet's in-page scripts, as well as legacy Solana utilities like `bs58`, rely on `Buffer.from()` and `Buffer.isBuffer()`. When Phantom receives an object or reconstructs wire transactions, any reference to `Buffer` triggers:
```text
ReferenceError: Buffer is not defined
```
This is a documented incompatibility between Vite and browser-injected Web3 wallets.

---

### Root Cause 3: Test Double Illusion (Why 109 Automated Tests Passed)

All 109 unit, integration, and API tests passed with 0 failures during the audit because automated tests executed in a Node.js test environment (`node:test`) rather than a real browser with the Phantom browser extension.

#### Code Evidence:
In `tests/unit/transaction-executor.test.js` (lines 59–67):
```javascript
async function signedCopy(transaction, payer) {
  const signed = new Transaction();
  signed.feePayer = transaction.feePayer;
  signed.recentBlockhash = transaction.recentBlockhash;
  signed.lastValidBlockHeight = transaction.lastValidBlockHeight;
  signed.instructions = [...transaction.instructions];
  await signed.partialSign(payer);
  return signed;
}
```

* **Why tests passed:**
  1. The test double `signedCopy` instantiated the exact same local v3 `Transaction` class and called `await signed.partialSign(payer)`. It never touched Phantom's injected provider.
  2. The mock RPC connection (`fakeConnection.sendRawTransaction`) simply logged `calls.push(['send', raw, options])` and returned a fake signature string; it never inspected `raw` to check whether it was a `Uint8Array` or a `Promise`.
  3. In Node.js, `Buffer` is a native global, masking any missing polyfills.

---

## 5. Downstream Blockers in the Execution Pipeline

Even if the failure at `phantom-wallet.js:178` is resolved, executing the transaction against live Devnet will immediately hit three critical blockers in `blockchain/src/transactions/transaction-executor.js`:

### Blocker A: Unawaited `serialize()` Call at Line 359

#### Code Evidence:
In `blockchain/src/transactions/transaction-executor.js` (lines 357–375):
```javascript
357:   let rawTransaction;
358:   try {
359:     rawTransaction = signedTransaction.serialize({ requireAllSignatures: true, verifySignatures: true });
360:   } catch (error) {
361:     reportProgress(onProgress, 'failed', { stage: 'approval' });
362:     throw new TransactionExecutionError(
363:       'INVALID_WALLET_SIGNATURE',
364:       'The Phantom signature could not be verified. No Devnet submission was made.',
365:       { cause: error },
366:     );
367:   }
368: 
369:   let signature;
370:   try {
371:     signature = await connection.sendRawTransaction(rawTransaction, {
372:       preflightCommitment: SOLANA_COMMITMENT,
373:       skipPreflight: false,
374:       maxRetries: 3,
375:     });
```

#### Impact:
* In `@solana/web3.js` v3, `signedTransaction.serialize(...)` is an `async` function.
* Line 359 calls it **without `await`**.
* `rawTransaction` becomes a **`Promise<Uint8Array>`** instead of a `Uint8Array`.
* Line 371 passes `rawTransaction` (`Promise`) directly into `connection.sendRawTransaction()`.
* Solana Devnet RPC transport will reject the call or throw a serialization error.

---

### Blocker B: Fragile `instanceof Transaction` Check Across Bundle Boundaries

#### Code Evidence:
In `blockchain/src/transactions/transaction-executor.js` (lines 192–200):
```javascript
function signatureFromSignedTransaction(signedTransaction) {
  if (!(signedTransaction instanceof Transaction) || !signedTransaction.signature) {
    throw new TransactionExecutionError(
      'INVALID_WALLET_RESPONSE',
      'Phantom did not return a signed Solana transaction.',
    );
  }
  return signedTransaction;
}
```

#### Impact:
* Phantom Wallet reconstructs the signed transaction using its own bundled version of `@solana/web3.js` (or returns a Wallet Standard object).
* In JavaScript, `instanceof` evaluates prototype inheritance against the exact constructor in memory. When two separate copies of a library exist (the application's bundled v3 vs. the extension's v1), `instanceof` evaluates to **`false`**.
* Line 194 will throw `INVALID_WALLET_RESPONSE` even when the signature is valid.

---

### Blocker C: H-01 Post-Sign Integrity Check vs. Phantom Auto-Priority Fees

#### Code Evidence:
In `blockchain/src/transactions/transaction-executor.js` (lines 349–355):
```javascript
if (!sameBytes(expectedMessage, signedTransaction.serializeMessage())) {
  reportProgress(onProgress, 'failed', { stage: 'approval' });
  throw new TransactionExecutionError(
    'TRANSACTION_MODIFIED',
    'The signed transaction message differs from the reviewed transaction. It was not submitted.',
  );
}
```

#### Impact:
* SolGuard incorporates a security check (H-01 in `SECURITY_AUDIT_FINAL.md`) ensuring that no instruction or recipient is altered during wallet signing.
* However, by default, the Phantom browser extension has an **"Auto Priority Fee"** feature enabled. When a transaction contains no `ComputeBudgetProgram` instructions, Phantom automatically appends a priority fee instruction to guarantee network inclusion.
* If Phantom appends an instruction, `signedTransaction.serializeMessage()` will not match `expectedMessage` byte-for-byte.
* Line 351 will falsely flag the transaction as tampered and abort submission.

---

## 6. Minimal Root-Cause Fix Plan

The resolution requires four targeted, non-breaking modifications that preserve all deterministic validation rules, H-01 tamper resistance, and Devnet-only safety perimeters:

```
+----------------------------------------------------------------------------------------+
| STEP 1: Polyfill Buffer & Globals in Vite                                              |
| Install `vite-plugin-node-polyfills` or supply `window.Buffer` in `vite.config.js`.    |
+----------------------------------------------------------------------------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------------+
| STEP 2: Pre-Populate Compute Budget Instructions                                       |
| In `transaction-builder.js`, explicitly append a ComputeBudget priority fee of 0       |
| micro-lamports. This informs Phantom that priority fees are set, preventing auto-fee  |
| injection and preserving exact byte equality for H-01 verification.                    |
+----------------------------------------------------------------------------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------------+
| STEP 3: Normalize Transaction Serialization in `phantom-wallet.js`                     |
| In `phantom-wallet.js`, wrap the transaction with a synchronous `.serialize()` shim   |
| or wire-serialize the message so Phantom receives a format it natively understands.    |
+----------------------------------------------------------------------------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------------+
| STEP 4: Harden `transaction-executor.js` Pipeline                                      |
| - Replace rigid `instanceof Transaction` with structural duck-typing.                  |
| - Add `await` to `signedTransaction.serialize(...)` at Line 359.                       |
+----------------------------------------------------------------------------------------+
```

### Detailed Fix Specifications

#### Step 1: Vite Polyfill Configuration
In `vite.config.js`:
Add `nodePolyfills({ globals: { Buffer: true } })` so that `window.Buffer` is globally available to browser extensions.

#### Step 2: Upfront Compute Budget Instruction
In `blockchain/src/transactions/transaction-builder.js`:
Before adding transfers and the audit memo, add:
```javascript
ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0n })
```
This guarantees that Phantom will never mutate the instruction list by adding its own priority fee.

#### Step 3: Transaction Serialization Bridge in `phantom-wallet.js`
In `frontend/src/services/wallet/phantom-wallet.js`:
Before invoking `wallet.signTransaction(transaction)`:
Attach a synchronous serialization wrapper to `transaction.serialize` that returns the pre-compiled wire bytes, allowing Phantom's v1 provider to read byte length and base58 encode without handling a `Promise`.

#### Step 4: Execution Pipeline Hardening in `transaction-executor.js`
1. **Line 193 (Duck-Typing):**
   ```javascript
   function signatureFromSignedTransaction(signedTransaction) {
     const hasSignature = Boolean(
       signedTransaction?.signature
       || (Array.isArray(signedTransaction?.signatures) && signedTransaction.signatures[0]?.signature)
     );
     if (!signedTransaction || typeof signedTransaction.serialize !== 'function' || !hasSignature) {
       throw new TransactionExecutionError(
         'INVALID_WALLET_RESPONSE',
         'Phantom did not return a signed Solana transaction.',
       );
     }
     return signedTransaction;
   }
   ```
2. **Line 359 (`await` Serialization):**
   ```javascript
   rawTransaction = await signedTransaction.serialize({ requireAllSignatures: true, verifySignatures: true });
   ```

---

## 7. Security & Devnet Guard Verification

| Security Boundary | Status Under Proposed Fix | Verification Mechanism |
|:---|:---:|:---|
| **H-01 Post-Sign Tamper Guard** | **Preserved** | Byte equality check (`sameBytes`) remains fully intact because upfront compute budget prevents Phantom from mutating instructions. |
| **H-02 Risk Summary Integrity** | **Preserved** | Audit memo derivation and server-side checks remain completely untouched. |
| **H-03 Lamport Sum Integrity** | **Preserved** | Pre-flight atomic balance and fee calculations remain unchanged. |
| **Quadruple Mainnet Gate** | **Preserved** | Devnet RPC enforcement across `vite.config.js`, `network.js`, and runtime guards is not modified. |
| **Non-Custodial Principle** | **Preserved** | Private keys never touch application memory; Phantom retains sole signing authority. |

---

## 8. Next Steps & Sign-off

This audit concludes the read-only root-cause investigation. **No code or configuration files have been modified.**

Upon receiving your approval to proceed, implementation will execute according to the 4-step plan, followed by end-to-end verification against live Solana Devnet.

