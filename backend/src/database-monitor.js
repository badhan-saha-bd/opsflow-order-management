/**
 * Periodically check MySQL availability and log only state changes.
 * No passwords, SQL statements, or raw database errors are logged.
 */
export function createDatabaseMonitor({ probe, logger = console, intervalMs = 15000 }) {
  if (typeof probe !== 'function') throw new TypeError('A database probe function is required');
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) throw new RangeError('intervalMs must be at least 1000');

  let lastStatus = null;
  let pending = false;
  let timer = null;
  let stopped = false;

  const checkOnce = async () => {
    if (pending || stopped) return;
    pending = true;
    try {
      await probe();
      if (lastStatus !== 'connected' && !stopped) {
        logger.log(JSON.stringify({
          time: new Date().toISOString(), level: 'info', event: 'database_connection',
          status: 'connected', message: lastStatus === 'failed'
            ? 'MySQL database connection restored'
            : 'MySQL database connected successfully',
        }));
      }
      lastStatus = 'connected';
    } catch (error) {
      if (lastStatus !== 'failed' && !stopped) {
        logger.error(JSON.stringify({
          time: new Date().toISOString(), level: 'error', event: 'database_connection',
          status: 'failed', message: 'MySQL database connection failed',
          errorCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN',
        }));
      }
      lastStatus = 'failed';
    } finally {
      pending = false;
    }
  };

  const start = () => {
    if (timer || stopped) return;
    void checkOnce();
    timer = setInterval(() => { void checkOnce(); }, intervalMs);
    timer.unref?.();
  };

  const stop = () => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  };

  return { start, stop, checkOnce };
}
