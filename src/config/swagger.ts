import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Minecraft Skin Server API',
      version: '2.0.0',
      description: 'Yggdrasil API 兼容的 Minecraft 皮肤站系统 API 文档',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '开发环境',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'JWT access token',
        },
      },
    },
  },
  apis: ['./src/api/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
