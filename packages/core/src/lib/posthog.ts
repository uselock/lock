import { PostHog } from 'posthog-node';

let _posthog: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!process.env.POSTHOG_KEY) return null;
  if (!_posthog) {
    _posthog = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST,
      enableExceptionAutocapture: true,
    });
  }
  return _posthog;
}

export async function shutdownPostHog(): Promise<void> {
  if (_posthog) {
    await _posthog.shutdown();
    _posthog = null;
  }
}
