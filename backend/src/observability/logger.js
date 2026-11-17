const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40 };

function serializeError(error) {
  if (!error) return undefined;
  return {
    errorName: typeof error.name === 'string' ? error.name : 'Error',
    errorCode: typeof error.code === 'string' ? error.code : undefined,
  };
}

export function createLogger({
  level = 'info',
  base = {},
  sink = console,
} = {}) {
  const threshold = LEVEL_WEIGHT[level] ?? LEVEL_WEIGHT.info;

  function write(severity, event, fields = {}) {
    if (LEVEL_WEIGHT[severity] < threshold) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: severity,
      event,
      ...base,
      ...fields,
    };
    for (const key of Object.keys(entry)) {
      if (entry[key] === undefined) delete entry[key];
    }
    const line = JSON.stringify(entry);
    if (severity === 'error') sink.error(line);
    else if (severity === 'warn') sink.warn(line);
    else sink.log(line);
  }

  return {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields = {}, error) => write('error', event, {
      ...fields,
      ...serializeError(error),
    }),
  };
}
