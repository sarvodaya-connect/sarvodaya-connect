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

  // Expected signatures were produced offline by the AWS SDK's own signer
  // (@smithy/signature-v4, presign with UNSIGNED-PAYLOAD) for the same inputs.
  describe('agrees with the AWS SDK signer', () => {
    const signature = (url: string) =>
      new URL(url).searchParams.get('X-Amz-Signature');

    it('orders query names by character code: mixed case, reserved characters and a session token', () => {
      const url = presignS3Url({
        ...AWS_EXAMPLE,
        method: 'GET',
        region: 'ap-southeast-1',
        expiresInSeconds: 900,
        key: "societies/a b/Audit (signed)!*'~.pdf",
        credentials: {
          ...AWS_EXAMPLE.credentials,
          sessionToken: 'session/token+with=reserved',
        },
        query: {
          'response-content-disposition':
            'attachment; filename="Audit (signed).pdf"',
          'response-content-type': 'application/pdf',
          'X-Amz-Meta-Tag': 'tie',
          'x-id': 'GetObject',
        },
      });
      const names = new URL(url).search
        .slice(1)
        .split('&')
        .map((pair) => pair.split('=')[0]);
      // Upper-case "X-Amz-*" before lower-case names; locale order would reverse this.
      expect(names).toEqual([
        'X-Amz-Algorithm',
        'X-Amz-Credential',
        'X-Amz-Date',
        'X-Amz-Expires',
        'X-Amz-Meta-Tag',
        'X-Amz-Security-Token',
        'X-Amz-SignedHeaders',
        'response-content-disposition',
        'response-content-type',
        'x-id',
        'X-Amz-Signature',
      ]);
      expect(signature(url)).toBe(
        'ed225af5239ab1d0ca421328b06acaa3fdadfcca00084a7bb81a02d7fa63c5ea',
      );
    });

    it('orders several signed headers and trims their values', () => {
      const url = presignS3Url({
        ...AWS_EXAMPLE,
        method: 'PUT',
        host: 'examplebucket.s3.ap-southeast-1.amazonaws.com',
        region: 'ap-southeast-1',
        expiresInSeconds: 900,
        key: '7f0c/9a1e.pdf',
        signedHeaders: {
          'X-Amz-Checksum-Sha256': ' n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg= ',
          'Content-Type': 'application/pdf',
          'x-amz-meta-a': '1',
          'X-Amz-Meta-B': '2',
        },
      });
      expect(new URL(url).searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-type;host;x-amz-checksum-sha256;x-amz-meta-a;x-amz-meta-b',
      );
      expect(signature(url)).toBe(
        '2d8cb642fe58ac1c5fb392f980f292c58c03d3ede74cb26f8f5ca7834b9a4d49',
      );
    });

    it('signs path-style links for a local store', () => {
      const url = presignS3Url({
        ...AWS_EXAMPLE,
        method: 'HEAD',
        host: 'localhost:9000',
        protocol: 'http',
        bucketInPath: 'my-bucket',
        key: 'k/v',
        expiresInSeconds: 60,
      });
      expect(url.startsWith('http://localhost:9000/my-bucket/k/v?')).toBe(true);
      expect(signature(url)).toBe(
        'be666d9ca58f40ad0e9b546b2e522946428e7ce8f8a75972231154b82c68eba2',
      );
    });
  });

  it('refuses links that would last longer than seven days', () => {
    expect(() =>
      presignS3Url({ ...AWS_EXAMPLE, method: 'GET', expiresInSeconds: 604801 }),
    ).toThrow('within 1 second and 7 days');
  });
});
