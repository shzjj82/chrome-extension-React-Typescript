import type { PetTopic, PetTopicPayload } from './topics';

/**
 * 按主题订阅的消息总线：`run:start`、`hover:enter`、`animation`（汇总）等。
 */
class PetTopicBus {
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  subscribe = <T extends PetTopic>(topic: T, listener: (payload: PetTopicPayload[T]) => void) => {
    const bucket = this.listeners.get(topic) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    this.listeners.set(topic, bucket);
  };

  unsubscribe = <T extends PetTopic>(topic: T, listener: (payload: PetTopicPayload[T]) => void) => {
    this.listeners.get(topic)?.delete(listener as (payload: unknown) => void);
  };

  publish = <T extends PetTopic>(topic: T, payload: PetTopicPayload[T]) => {
    this.listeners.get(topic)?.forEach(listener => {
      listener(payload);
    });
  };

  clear = () => {
    this.listeners.clear();
  };
}

export { PetTopicBus };
