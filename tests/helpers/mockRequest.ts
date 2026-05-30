import { Request, Response } from 'express';

export function mockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as any,
    ...overrides,
  };
}

export function mockResponse(): Partial<Response> {
  const res: Partial<Response> = {};
  res.statusCode = 200;
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}
