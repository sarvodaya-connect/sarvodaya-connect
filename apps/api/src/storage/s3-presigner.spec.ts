import { describe, expect, it } from 'vitest';

import { awsUriEncode, presignS3Url } from './s3-presigner.js';

// Worked example from the Amazon S3 API reference, "Authenticating Requests:
// Using Query Parameters (AWS Signature Version 4)". These are AWS's published
// documentation credentials, not real keys.
const AWS_EXAMPLE = {
  host: 'examplebucket.s3.amazonaws.com',
  key: 'test.txt',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  },
  now: new Date('2013-05-24T00:00:00.000Z'),
  expiresInSeconds: 86400,
};

describe('presignS3Url', () => {
  it('matches the signature published in the AWS documentation', () => {
    const url = presignS3Url({ ...AWS_EXAMPLE, method: 'GET' });

    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('signs extra headers and the session token for temporary credentials', () => {
    const url = new URL(
      presignS3Url({
        ...AWS_EXAMPLE,
        method: 'PUT',
        credentials: {
          ...AWS_EXAMPLE.credentials,
          sessionToken: 'example-session-token',
        },
        signedHeaders: { 'Content-Type': 'application/pdf' },
      }),
    );

    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-type;host',
    );
    expect(url.searchParams.get('X-Amz-Security-Token')).toBe(
      'example-session-token',
    );
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('encodes keys and query values as Signature Version 4 requires', () => {
    expect(awsUriEncode("Audit report (signed)!*'.pdf")).toBe(
      'Audit%20report%20%28signed%29%21%2A%27.pdf',
    );
    const url = presignS3Url({
      ...AWS_EXAMPLE,
      method: 'GET',
      key: 'societies/a b/file.pdf',
      query: {
        'response-content-disposition': 'attachment; filename="file.pdf"',
      },
    });
    expect(
      url.startsWith(
        'https://examplebucket.s3.amazonaws.com/societies/a%20b/file.pdf?',
      ),
    ).toBe(true);
    expect(url).toContain(
      'response-content-disposition=attachment%3B%20filename%3D%22file.pdf%22',
    );
  });

  it('refuses links that would last longer than seven days', () => {
    expect(() =>
      presignS3Url({ ...AWS_EXAMPLE, method: 'GET', expiresInSeconds: 604801 }),
    ).toThrow('within 1 second and 7 days');
  });
});
