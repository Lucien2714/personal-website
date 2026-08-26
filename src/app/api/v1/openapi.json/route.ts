import {NextResponse} from 'next/server';

import {API_SCOPES} from '@/lib/api/scopes';
import {corsHeaders} from '@/lib/api/response';
import {env} from '@/lib/env';

/**
 * The OpenAPI 3.1 description of `/api/v1`.
 *
 * Written by hand rather than generated from the Zod schemas. A generator
 * would keep the two in lockstep automatically, but it would also pull a
 * schema-conversion dependency into the runtime for a document that changes a
 * few times a year. The trade is recorded here so the next person can revisit
 * it if the API grows.
 */

/** Reusable component schemas. */
const SCHEMAS = {
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            enum: [
              'bad_request',
              'unauthorized',
              'forbidden',
              'not_found',
              'rate_limited',
              'payload_too_large',
              'unsupported_media_type',
              'internal_error',
            ],
          },
          message: {type: 'string'},
          details: {},
        },
      },
    },
  },
  ListMeta: {
    type: 'object',
    required: ['page', 'perPage', 'total', 'totalPages'],
    properties: {
      page: {type: 'integer', minimum: 1},
      perPage: {type: 'integer', minimum: 1, maximum: 100},
      total: {type: 'integer', minimum: 0},
      totalPages: {type: 'integer', minimum: 1},
    },
  },
  PostSummary: {
    type: 'object',
    properties: {
      id: {type: 'string'},
      slug: {type: 'string'},
      locale: {type: 'string', enum: ['en', 'zh']},
      title: {type: 'string'},
      description: {type: ['string', 'null']},
      url: {type: 'string', format: 'uri'},
      coverUrl: {type: ['string', 'null'], format: 'uri'},
      publishedAt: {type: ['string', 'null'], format: 'date-time'},
      readingMinutes: {type: 'integer'},
      pinned: {type: 'boolean'},
      viewCount: {type: 'integer'},
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {slug: {type: 'string'}, name: {type: 'string'}},
        },
      },
      tags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {slug: {type: 'string'}, name: {type: 'string'}},
        },
      },
    },
  },
  Moment: {
    type: 'object',
    properties: {
      id: {type: 'string'},
      body: {type: 'string'},
      images: {type: 'array', items: {type: 'string', format: 'uri'}},
      mood: {type: ['string', 'null']},
      location: {type: ['string', 'null']},
      createdAt: {type: 'string', format: 'date-time'},
    },
  },
  Project: {
    type: 'object',
    properties: {
      id: {type: 'string'},
      slug: {type: 'string'},
      name: {type: 'string'},
      summary: {type: 'string'},
      html: {type: ['string', 'null']},
      url: {type: 'string', format: 'uri'},
      repoUrl: {type: ['string', 'null']},
      liveUrl: {type: ['string', 'null']},
      embedUrl: {type: ['string', 'null']},
      coverUrl: {type: ['string', 'null']},
      techStack: {type: 'array', items: {type: 'string'}},
      featured: {type: 'boolean'},
    },
  },
} as const;

/** Query parameters shared by the list endpoints. */
const LIST_PARAMETERS = [
  {
    name: 'locale',
    in: 'query',
    schema: {type: 'string', enum: ['en', 'zh'], default: 'en'},
    description:
      'Language to return. Untranslated content falls back to whichever language exists.',
  },
  {
    name: 'page',
    in: 'query',
    schema: {type: 'integer', minimum: 1, default: 1},
  },
  {
    name: 'perPage',
    in: 'query',
    schema: {type: 'integer', minimum: 1, maximum: 100, default: 20},
  },
] as const;

/** A JSON response body wrapping one schema. */
const dataResponse = (schema: object, withMeta = false) => ({
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: schema,
          ...(withMeta ? {meta: {$ref: '#/components/schemas/ListMeta'}} : {}),
        },
      },
    },
  },
});

/** The standard failure response. */
const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {schema: {$ref: '#/components/schemas/Error'}},
  },
});

/** Serves the specification. */
export function GET(request: Request): NextResponse {
  const document = {
    openapi: '3.1.0',
    info: {
      title: 'personal-website API',
      version: '1.0.0',
      description:
        'Read and write the content of this site. Read endpoints are public; write endpoints need an API key created in the admin console.',
    },
    servers: [{url: env.NEXT_PUBLIC_SITE_URL}],
    components: {
      schemas: SCHEMAS,
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          description: `Bearer token created in the console. Scopes: ${API_SCOPES.join(', ')}.`,
        },
      },
    },
    paths: {
      '/api/v1/posts': {
        get: {
          summary: 'List published posts',
          parameters: [
            ...LIST_PARAMETERS,
            {name: 'category', in: 'query', schema: {type: 'string'}},
            {name: 'tag', in: 'query', schema: {type: 'string'}},
            {
              name: 'q',
              in: 'query',
              schema: {type: 'string'},
              description: 'Case-insensitive match on title and description.',
            },
          ],
          responses: {
            '200': dataResponse(
              {
                type: 'array',
                items: {$ref: '#/components/schemas/PostSummary'},
              },
              true,
            ),
          },
        },
        post: {
          summary: 'Create a post',
          security: [{apiKey: []}],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['translations'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED'],
                      default: 'DRAFT',
                    },
                    publishedAt: {type: 'string', format: 'date-time'},
                    pinned: {type: 'boolean', default: false},
                    coverUrl: {type: 'string'},
                    categories: {type: 'array', items: {type: 'string'}},
                    tags: {type: 'array', items: {type: 'string'}},
                    translations: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        required: ['locale', 'title', 'bodyMarkdown'],
                        properties: {
                          locale: {type: 'string', enum: ['EN', 'ZH']},
                          title: {type: 'string'},
                          slug: {type: 'string'},
                          description: {type: 'string'},
                          bodyMarkdown: {type: 'string'},
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': dataResponse({type: 'object'}),
            '400': errorResponse('Validation failed'),
            '401': errorResponse('Missing or invalid key'),
            '403': errorResponse('Key lacks posts:write'),
          },
        },
      },
      '/api/v1/posts/{slug}': {
        get: {
          summary: 'Fetch one post, including rendered HTML',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
            LIST_PARAMETERS[0],
          ],
          responses: {
            '200': dataResponse({$ref: '#/components/schemas/PostSummary'}),
            '404': errorResponse('No published post with that slug'),
          },
        },
      },
      '/api/v1/moments': {
        get: {
          summary: 'List published moments',
          parameters: [LIST_PARAMETERS[1], LIST_PARAMETERS[2]],
          responses: {
            '200': dataResponse(
              {type: 'array', items: {$ref: '#/components/schemas/Moment'}},
              true,
            ),
          },
        },
        post: {
          summary: 'Post a moment',
          security: [{apiKey: []}],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['body'],
                  properties: {
                    body: {type: 'string', maxLength: 2000},
                    images: {
                      type: 'array',
                      maxItems: 9,
                      items: {type: 'string'},
                    },
                    mood: {type: 'string', maxLength: 16},
                    location: {type: 'string', maxLength: 120},
                  },
                },
              },
            },
          },
          responses: {
            '201': dataResponse({type: 'object'}),
            '401': errorResponse('Missing or invalid key'),
            '403': errorResponse('Key lacks moments:write'),
          },
        },
      },
      '/api/v1/projects': {
        get: {
          summary: 'List published projects',
          parameters: [
            LIST_PARAMETERS[0],
            {name: 'featured', in: 'query', schema: {type: 'boolean'}},
          ],
          responses: {
            '200': dataResponse({
              type: 'array',
              items: {$ref: '#/components/schemas/Project'},
            }),
          },
        },
      },
      '/api/v1/projects/{slug}': {
        get: {
          summary: 'Fetch one project',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
            LIST_PARAMETERS[0],
          ],
          responses: {
            '200': dataResponse({$ref: '#/components/schemas/Project'}),
            '404': errorResponse('No published project with that slug'),
          },
        },
      },
      '/api/v1/pages/{slug}': {
        get: {
          summary: 'Fetch a standalone page, such as `about`',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: {type: 'string'},
            },
            LIST_PARAMETERS[0],
          ],
          responses: {
            '200': dataResponse({type: 'object'}),
            '404': errorResponse('No published page with that slug'),
          },
        },
      },
      '/api/v1/categories': {
        get: {
          summary: 'List categories that have published posts',
          parameters: [LIST_PARAMETERS[0]],
          responses: {'200': dataResponse({type: 'array'})},
        },
      },
      '/api/v1/tags': {
        get: {
          summary: 'List tags that have published posts',
          parameters: [LIST_PARAMETERS[0]],
          responses: {'200': dataResponse({type: 'array'})},
        },
      },
      '/api/v1/media': {
        post: {
          summary: 'Upload an image',
          security: [{apiKey: []}],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: {type: 'string', format: 'binary'},
                    altText: {type: 'string'},
                  },
                },
              },
            },
          },
          responses: {
            '201': dataResponse({type: 'object'}),
            '200': dataResponse({
              type: 'object',
              description: 'An identical file was already stored.',
            }),
            '413': errorResponse('File too large'),
            '415': errorResponse('Unsupported file type'),
          },
        },
      },
    },
  };

  return NextResponse.json(document, {
    headers: {
      ...corsHeaders(request),
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
