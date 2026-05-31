export function getOAuthConfig() {
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  return {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      apiUrl: 'https://api.github.com/user',
      isConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenantId,
      authorizeUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      apiUrl: 'https://graph.microsoft.com/v1.0/me',
      isConfigured: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    },
    callbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3000',
  };
}
