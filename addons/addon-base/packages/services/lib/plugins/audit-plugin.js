async function prepare({ requestContext, container, auditEvent }) {
  if (!auditEvent.logEventType) {
    auditEvent.logEventType = 'audit';
  }
  return { requestContext, container, auditEvent };
}
async function write({ requestContext, container, auditEvent }) {
  const logger = await container.find('log');
  logger.log(auditEvent);
  return { requestContext, container, auditEvent };
}

/**
 * A basic audit plugin that just logs audit events using the logger. The default logger writes logs using "console".
 * In AWS Lambda based deployments, these logs will automatically go to AWS CloudWatch Logs.
 * The plugin adds a field named "logEventType = audit" to the audit event. This allows searching for all audit log
 * events using AWS CloudWatch Logs Insights using <pre><code>filter logEventType = 'audit'</code></pre>.
 *
 * For example,
 * <pre><code>
 *    fields @timestamp, @message
 *    | sort @timestamp desc
 *    | limit 20
 *    | filter logEventType = 'audit'
 * </code></pre>
 *
 * @type {{prepare: (function({requestContext: *, container: *, auditEvent: *}): {container: *, requestContext: *, auditEvent: *}), write: (function({requestContext: *, container: *, auditEvent?: *}): {container: *, requestContext: *, auditEvent: *})}}
 */
const plugin = {
  prepare,
  write,
};

module.exports = plugin;
