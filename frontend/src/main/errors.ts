// Internal error codes (docs/API.md §4). Logs store only the code, never content.
export type ErrorCode =
  | 'no_api_key'
  | 'invalid_api_key'
  | 'rate_limited'
  | 'network_error'
  | 'provider_error'
  | 'audio_too_large'
  | 'mic_denied'
  | 'mic_unavailable'
  | 'recorder_failed'
  | 'no_speech'
  | 'paste_blocked'
  | 'session_timeout';
