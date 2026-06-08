import { NextResponse } from 'next/server';

export function requireDocumentStatus(
  currentStatus: string,
  expectedStatus: string,
  action: string
): NextResponse | null {
  if (currentStatus !== expectedStatus) {
    return NextResponse.json(
      {
        error: {
          code: 'CONFLICT',
          message: `Cannot ${action}: document status is "${currentStatus}", expected "${expectedStatus}"`,
        },
      },
      { status: 409 }
    );
  }
  return null;
}

export function requireFieldStatus(
  currentStatus: string,
  expectedStatus: string,
  action: string
): NextResponse | null {
  if (currentStatus !== expectedStatus) {
    return NextResponse.json(
      {
        error: {
          code: 'CONFLICT',
          message: `Cannot ${action}: field status is "${currentStatus}", expected "${expectedStatus}"`,
        },
      },
      { status: 409 }
    );
  }
  return null;
}
