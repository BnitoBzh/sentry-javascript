import { getCurrentHub, Scope } from '@sentry/hub';
import { Integration, SentryEvent } from '@sentry/types';
import { getGlobalObject } from '@sentry/utils/misc';

/** JSDoc */
export class Ember implements Integration {
  /**
   * @inheritDoc
   */
  public name: string = 'Ember';

  /**
   * @inheritDoc
   */
  private readonly Ember: any; // tslint:disable-line:variable-name

  /**
   * @inheritDoc
   */
  public constructor(options: { Ember?: any } = {}) {
    this.Ember =
      options.Ember ||
      (getGlobalObject() as {
        Ember: any;
      }).Ember;
  }

  /**
   * @inheritDoc
   */
  public install(): void {
    if (!this.Ember) {
      return;
    }

    const oldOnError = this.Ember.onerror;

    this.Ember.onerror = (error: Error): void => {
      getCurrentHub().withScope(() => {
        getCurrentHub().configureScope((scope: Scope) => {
          this.addIntegrationToSdkInfo(scope);
        });
        getCurrentHub().captureException(error, { originalException: error });
      });

      if (typeof oldOnError === 'function') {
        oldOnError.call(this.Ember, error);
      }
    };

    this.Ember.RSVP.on(
      'error',
      (reason: any): void => {
        getCurrentHub().pushScope();

        if (reason instanceof Error) {
          getCurrentHub().configureScope((scope: Scope) => {
            scope.setExtra('context', 'Unhandled Promise error detected');
            this.addIntegrationToSdkInfo(scope);
          });

          getCurrentHub().captureException(reason, { originalException: reason });
        } else {
          getCurrentHub().configureScope((scope: Scope) => {
            scope.setExtra('reason', reason);
            this.addIntegrationToSdkInfo(scope);
          });

          getCurrentHub().captureMessage('Unhandled Promise error detected');
        }

        getCurrentHub().popScope();
      },
    );
  }

  /**
   * Appends SDK integrations
   * @param scope The scope currently used.
   */
  private addIntegrationToSdkInfo(scope: Scope): void {
    scope.addEventProcessor(async (event: SentryEvent) => {
      if (event.sdk) {
        const integrations = event.sdk.integrations || [];
        event.sdk = {
          ...event.sdk,
          integrations: [...integrations, 'ember'],
        };
      }
      return event;
    });
  }
}