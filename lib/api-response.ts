import { NextResponse } from "next/server";

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiPaginated<T>(
  data: T[],
  pageInfo: { nextCursor: string | null; hasNextPage: boolean }
) {
  return NextResponse.json({ data, pageInfo }, { status: 200 });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  requestId?: string
) {
  const body: ApiErrorShape = {
    error: {
      code,
      message,
      requestId: requestId || `req_${Date.now()}`,
    },
  };
  return NextResponse.json(body, { status });
}
