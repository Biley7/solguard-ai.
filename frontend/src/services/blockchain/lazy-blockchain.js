let modulesPromise;

export function loadBlockchainModules() {
  modulesPromise ??= Promise.all([
    import('../../../../blockchain/src/inspection/wallet-security.js'),
    import('../../../../blockchain/src/transactions/transaction-builder.js'),
    import('../../../../blockchain/src/transactions/transaction-executor.js'),
    import('../../../../blockchain/src/rpc/devnet-connection.js'),
    import('../../../../blockchain/src/security/transaction-risk.js'),
    import('./wallet-balance.js'),
  ]).then(([
    inspection,
    builder,
    executor,
    rpc,
    risk,
    balance,
  ]) => ({
    inspectWalletSecurity: inspection.inspectWalletSecurity,
    prepareSolTransferTransaction: builder.prepareSolTransferTransaction,
    executePreparedTransfer: executor.executePreparedTransfer,
    getDevnetConnection: rpc.getDevnetConnection,
    summarizeTransactionRisk: risk.summarizeTransactionRisk,
    fetchDevnetBalance: balance.fetchDevnetBalance,
  }));

  return modulesPromise;
}
