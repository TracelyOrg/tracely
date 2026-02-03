export interface DataEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
}
