/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  request_id?: string;
  timestamp?: string;
  success?: boolean;
}
