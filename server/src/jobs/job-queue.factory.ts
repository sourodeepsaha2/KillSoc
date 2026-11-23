import type { IJobQueue } from './job-queue.interface.js';
import { BullMQJobQueue } from './bullmq-queue.service.js';
import { MockJobQueue } from './mock-queue.service.js';
import { env } from '../config/env.js';

let customQueueInstance: IJobQueue | null = null;
let defaultQueueInstance: IJobQueue | null = null;

export class JobQueueFactory {
  /**
   * Overrides the queue instance for testing or in-memory simulation.
   */
  static setCustomQueue(queue: IJobQueue | null): void {
    customQueueInstance = queue;
  }

  /**
   * Retrieves the configured IJobQueue instance.
   * Defaults to BullMQJobQueue in production or when Redis is configured;
   * falls back to MockJobQueue if testing or explicitly requested.
   */
  static getQueue(): IJobQueue {
    if (customQueueInstance) {
      return customQueueInstance;
    }

    if (!defaultQueueInstance) {
      if (env.NODE_ENV === 'test') {
        defaultQueueInstance = new MockJobQueue();
      } else {
        defaultQueueInstance = new BullMQJobQueue();
      }
    }

    return defaultQueueInstance;
  }

  /**
   * Resets instances for test isolation.
   */
  static reset(): void {
    customQueueInstance = null;
    defaultQueueInstance = null;
  }
}
