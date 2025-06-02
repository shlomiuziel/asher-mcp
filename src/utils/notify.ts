import notifier from 'node-notifier';

export type NotificationCallback = (
  err: Error | null,
  response: 'activate' | 'timeout' | 'dismissed' | 'replied' | string,
  metadata?: {
    activationValue?: string;
    response?: string;
    [key: string]: any;
  }
) => void;

export interface NotificationOptions {
  title: string;
  message: string;
  timeout?: number;
  closeLabel?: string;
  reply?: string;
  replyButton?: string;
  sound?: string | boolean;
  subtitle?: string;
  actions?: string | string[];
  wait?: boolean;
  callback?: NotificationCallback;
}

export async function sendNotification(options: NotificationOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const notificationOptions = {
      title: options.title,
      message: options.message,
      sound: options.sound,
      wait: options.wait !== undefined ? options.wait : true,
      timeout: options.timeout || 30, // seconds to wait before dismissing automatically
      reply: options.reply,
      subtitle: options.subtitle,
      closeLabel: options.closeLabel,
      actions: options.actions,
      replyButton: options.replyButton,
    };

    // Get the callback from options if provided
    const callback = options.callback;

    // Use type assertion for node-notifier as its types are not perfect with callback parameters
    (notifier as any).notify(notificationOptions, (err: any, response: any, metadata?: any) => {
      if (err) {
        // If a callback was provided, call it with the error
        if (callback) {
          callback(err, response, metadata);
        }
        reject(err);
        return;
      }

      // If a callback was provided, call it with the response
      if (callback) {
        callback(null, response, metadata);
      }
      resolve(response);
    });

    if (!options.wait) {
      resolve();
    }
  });
}
