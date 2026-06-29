import { NextResponse } from 'next/server'

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'GG Capital CRM API',
    version: '1.0.0',
    description:
      'Internal REST API for the GG Capital CRM. All endpoints require a Bearer token (Supabase JWT or a `ggc_` PAT created in Settings → Tokens).',
  },
  servers: [{ url: '/api/v1', description: 'Current deployment' }],
  security: [{ bearerAuth: [] }],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Supabase JWT | ggc_ PAT',
        description:
          'Send `Authorization: Bearer <token>`. Create PATs in **Settings → Tokens**. Scopes: `crm:read`, `crm:write`, `staging:read`, `staging:write`, `staging:promote`.',
      },
    },

    schemas: {
      DataStatus: {
        type: 'string',
        enum: ['stub', 'partial', 'complete'],
        description:
          '`stub` = only required fields; `partial` = some desired fields; `complete` = all desired fields.',
      },

      Company: {
        type: 'object',
        required: ['id', 'name', 'created_by', 'updated_by', 'created_at', 'updated_at'],
        properties: {
          id:                   { type: 'string', format: 'uuid' },
          name:                 { type: 'string' },
          description:          { type: 'string', nullable: true },
          source:               { type: 'string', enum: ['Direct', 'Fund'], nullable: true },
          industry_ids:         { type: 'array', items: { type: 'string', format: 'uuid' } },
          region_ids:           { type: 'array', items: { type: 'string', format: 'uuid' } },
          stage_ids:            { type: 'array', items: { type: 'string', format: 'uuid' } },
          type_id:              { type: 'string', format: 'uuid', nullable: true },
          status_id:            { type: 'string', format: 'uuid', nullable: true },
          parent_company_id:    { type: 'string', format: 'uuid', nullable: true },
          website:              { type: 'string', format: 'uri', nullable: true },
          round_size_musd:      { type: 'number', nullable: true },
          valuation_musd:       { type: 'number', nullable: true },
          legal:                { type: 'string', nullable: true },
          deal_date:            { type: 'string', format: 'date', nullable: true },
          country:              { type: 'string', nullable: true },
          investment_stage_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          files:                { type: 'array', items: { type: 'string' } },
          data_status:          { '$ref': '#/components/schemas/DataStatus' },
          missing_fields:       { type: 'array', items: { type: 'string' }, description: 'Desired fields not yet filled in.' },
          created_by:           { type: 'string', format: 'uuid' },
          updated_by:           { type: 'string', format: 'uuid' },
          created_at:           { type: 'string', format: 'date-time' },
          updated_at:           { type: 'string', format: 'date-time' },
          deleted_at:           { type: 'string', format: 'date-time', nullable: true },
        },
      },

      CompanyCreate: {
        type: 'object',
        required: ['name'],
        description: 'Required: `name`. All other fields are optional.',
        properties: {
          name:                 { type: 'string', example: 'Acme Corp' },
          description:          { type: 'string', nullable: true },
          source:               { type: 'string', enum: ['Direct', 'Fund'], nullable: true },
          industry_ids:         { type: 'array', items: { type: 'string', format: 'uuid' } },
          region_ids:           { type: 'array', items: { type: 'string', format: 'uuid' } },
          stage_ids:            { type: 'array', items: { type: 'string', format: 'uuid' } },
          type_id:              { type: 'string', format: 'uuid', nullable: true },
          status_id:            { type: 'string', format: 'uuid', nullable: true },
          parent_company_id:    { type: 'string', format: 'uuid', nullable: true },
          website:              { type: 'string', format: 'uri', nullable: true },
          round_size_musd:      { type: 'number', nullable: true },
          valuation_musd:       { type: 'number', nullable: true },
          legal:                { type: 'string', nullable: true },
          deal_date:            { type: 'string', format: 'date', nullable: true },
          country:              { type: 'string', nullable: true },
          investment_stage_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
          files:                { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },

      Contact: {
        type: 'object',
        required: ['id', 'name', 'email', 'company_id', 'created_by', 'updated_by', 'created_at', 'updated_at'],
        properties: {
          id:               { type: 'string', format: 'uuid' },
          name:             { type: 'string' },
          email:            { type: 'string', format: 'email' },
          company_id:       { type: 'string', format: 'uuid' },
          role:             { type: 'string', nullable: true },
          employer:         { type: 'string', nullable: true },
          phone:            { type: 'string', nullable: true },
          expertise:        { type: 'string', nullable: true },
          industry_ids:     { type: 'array', items: { type: 'string', format: 'uuid' } },
          region_ids:       { type: 'array', items: { type: 'string', format: 'uuid' } },
          investment_focus: { type: 'array', items: { type: 'string' } },
          linkedin:         { type: 'string', format: 'uri', nullable: true },
          location:         { type: 'string', nullable: true },
          stage_ids:        { type: 'array', items: { type: 'string', format: 'uuid' } },
          data_status:      { '$ref': '#/components/schemas/DataStatus' },
          missing_fields:   { type: 'array', items: { type: 'string' } },
          created_by:       { type: 'string', format: 'uuid' },
          updated_by:       { type: 'string', format: 'uuid' },
          created_at:       { type: 'string', format: 'date-time' },
          updated_at:       { type: 'string', format: 'date-time' },
          deleted_at:       { type: 'string', format: 'date-time', nullable: true },
        },
      },

      ContactCreate: {
        type: 'object',
        required: ['name', 'email', 'company_id'],
        description: 'Required: `name`, `email`, `company_id`. All other fields are optional.',
        properties: {
          name:             { type: 'string', example: 'Alice Chen' },
          email:            { type: 'string', format: 'email', example: 'alice@acme.com' },
          company_id:       { type: 'string', format: 'uuid' },
          role:             { type: 'string', nullable: true },
          employer:         { type: 'string', nullable: true },
          phone:            { type: 'string', nullable: true },
          expertise:        { type: 'string', nullable: true },
          industry_ids:     { type: 'array', items: { type: 'string', format: 'uuid' } },
          region_ids:       { type: 'array', items: { type: 'string', format: 'uuid' } },
          investment_focus: { type: 'array', items: { type: 'string' } },
          linkedin:         { type: 'string', format: 'uri', nullable: true },
          location:         { type: 'string', nullable: true },
          stage_ids:        { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
        additionalProperties: false,
      },

      Meeting: {
        type: 'object',
        required: ['id', 'company_id', 'date', 'title', 'created_by', 'updated_by', 'created_at', 'updated_at'],
        properties: {
          id:         { type: 'string', format: 'uuid' },
          company_id: { type: 'string', format: 'uuid' },
          date:       { type: 'string', format: 'date' },
          title:      { type: 'string' },
          notes:      { type: 'string', nullable: true },
          type_id:    { type: 'string', format: 'uuid', nullable: true },
          created_by: { type: 'string', format: 'uuid' },
          updated_by: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          deleted_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      MeetingCreate: {
        type: 'object',
        required: ['company_id', 'date', 'title'],
        description: 'Required: `company_id`, `date` (YYYY-MM-DD), `title`.',
        properties: {
          company_id: { type: 'string', format: 'uuid' },
          date:       { type: 'string', format: 'date', example: '2026-06-28' },
          title:      { type: 'string', example: 'Intro call' },
          notes:      { type: 'string', nullable: true },
          type_id:    { type: 'string', format: 'uuid', nullable: true },
        },
        additionalProperties: false,
      },

      Interaction: {
        type: 'object',
        required: ['id', 'contact_id', 'note', 'follow_up', 'created_by', 'created_at'],
        properties: {
          id:         { type: 'string', format: 'uuid' },
          contact_id: { type: 'string', format: 'uuid' },
          note:       { type: 'string' },
          follow_up:  { type: 'boolean' },
          meeting_id: { type: 'string', format: 'uuid', nullable: true },
          created_by: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      InteractionCreate: {
        type: 'object',
        required: ['contact_id', 'note'],
        description: 'Required: `contact_id`, `note`.',
        properties: {
          contact_id: { type: 'string', format: 'uuid' },
          note:       { type: 'string', example: 'Discussed Series B timeline.' },
          follow_up:  { type: 'boolean', default: false },
          meeting_id: { type: 'string', format: 'uuid', nullable: true },
        },
        additionalProperties: false,
      },

      TagItem: {
        type: 'object',
        required: ['id', 'name', 'created_at'],
        properties: {
          id:         { type: 'string', format: 'uuid' },
          name:       { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error:   { type: 'string' },
          details: { type: 'object' },
        },
      },
    },

    responses: {
      Unauthorized: {
        description: 'Missing or invalid Bearer token.',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Token lacks the required scope, or the operation requires admin role.',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found.',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Request body failed schema validation.',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
    },
  },

  paths: {
    '/companies': {
      get: {
        summary: 'List companies',
        operationId: 'listCompanies',
        tags: ['Companies'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Name search (ilike).' },
          { name: 'data_status', in: 'query', schema: { '$ref': '#/components/schemas/DataStatus' }, description: 'Filter by completeness.' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: { description: 'Array of companies.', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Company' } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
      post: {
        summary: 'Create a company',
        operationId: 'createCompany',
        tags: ['Companies'],
        security: [{ bearerAuth: ['crm:write'] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/CompanyCreate' },
              examples: {
                stub: { summary: 'Minimum (stub)', value: { name: 'Acme Corp' } },
                full: { summary: 'Fully populated', value: { name: 'Acme Corp', website: 'https://acme.com', description: 'Enterprise SaaS', country: 'US' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Company created.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Company' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },

    '/companies/{id}': {
      get: {
        summary: 'Get a company',
        operationId: 'getCompany',
        tags: ['Companies'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Company.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Company' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update a company',
        operationId: 'updateCompany',
        tags: ['Companies'],
        security: [{ bearerAuth: ['crm:write'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/CompanyCreate' } } } },
        responses: {
          200: { description: 'Updated company.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Company' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
      delete: {
        summary: 'Soft-delete a company (admin only)',
        operationId: 'deleteCompany',
        tags: ['Companies'],
        security: [{ bearerAuth: ['crm:write'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          204: { description: 'Deleted.' },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
    },

    '/contacts': {
      get: {
        summary: 'List contacts',
        operationId: 'listContacts',
        tags: ['Contacts'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'company_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'data_status', in: 'query', schema: { '$ref': '#/components/schemas/DataStatus' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: { description: 'Array of contacts.', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Contact' } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
      post: {
        summary: 'Create a contact',
        operationId: 'createContact',
        tags: ['Contacts'],
        security: [{ bearerAuth: ['crm:write'] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/ContactCreate' },
              examples: {
                stub: { summary: 'Minimum (stub)', value: { name: 'Alice Chen', email: 'alice@acme.com', company_id: '<uuid>' } },
                full: { summary: 'Fully populated', value: { name: 'Alice Chen', email: 'alice@acme.com', company_id: '<uuid>', role: 'CEO', phone: '+1-555-0100', linkedin: 'https://linkedin.com/in/alice', location: 'San Francisco, CA' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Contact created.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Contact' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },

    '/contacts/{id}': {
      get: {
        summary: 'Get a contact',
        operationId: 'getContact',
        tags: ['Contacts'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Contact.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Contact' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update a contact',
        operationId: 'updateContact',
        tags: ['Contacts'],
        security: [{ bearerAuth: ['crm:write'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ContactCreate' } } } },
        responses: {
          200: { description: 'Updated contact.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Contact' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Soft-delete a contact (admin only)',
        operationId: 'deleteContact',
        tags: ['Contacts'],
        security: [{ bearerAuth: ['crm:write'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          204: { description: 'Deleted.' },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
    },

    '/meetings': {
      get: {
        summary: 'List meetings',
        operationId: 'listMeetings',
        tags: ['Meetings'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [
          { name: 'company_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: { description: 'Array of meetings.', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Meeting' } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create a meeting',
        operationId: 'createMeeting',
        tags: ['Meetings'],
        security: [{ bearerAuth: ['crm:write'] }],
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/MeetingCreate' } } } },
        responses: {
          201: { description: 'Meeting created.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Meeting' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },

    '/meetings/{id}': {
      get: {
        summary: 'Get a meeting',
        operationId: 'getMeeting',
        tags: ['Meetings'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Meeting with participants.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Meeting' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      patch: {
        summary: 'Update a meeting',
        operationId: 'updateMeeting',
        tags: ['Meetings'],
        security: [{ bearerAuth: ['crm:write'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/MeetingCreate' } } } },
        responses: {
          200: { description: 'Updated meeting.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Meeting' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Soft-delete a meeting (admin only)',
        operationId: 'deleteMeeting',
        tags: ['Meetings'],
        security: [{ bearerAuth: ['crm:write'] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          204: { description: 'Deleted.' },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },

    '/interactions': {
      get: {
        summary: 'List interaction logs',
        operationId: 'listInteractions',
        tags: ['Interactions'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [
          { name: 'contact_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'follow_up', in: 'query', schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: { description: 'Array of interactions.', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Interaction' } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Log an interaction',
        operationId: 'createInteraction',
        tags: ['Interactions'],
        security: [{ bearerAuth: ['crm:write'] }],
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/InteractionCreate' } } } },
        responses: {
          201: { description: 'Interaction created.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Interaction' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },

    '/tags': {
      get: {
        summary: 'List tag catalogs',
        operationId: 'listTags',
        tags: ['Tags'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [
          {
            name: 'catalog', in: 'query',
            schema: { type: 'string', enum: ['industries', 'regions', 'stages', 'types', 'statuses', 'meetingTypes'] },
            description: 'Return only this catalog. Omit to return all six.',
          },
        ],
        responses: {
          200: { description: 'Tag catalogs.', content: { 'application/json': { schema: { type: 'object' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create a tag',
        operationId: 'createTag',
        tags: ['Tags'],
        security: [{ bearerAuth: ['crm:write'] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['catalog', 'name'],
                properties: {
                  catalog: { type: 'string', enum: ['industries', 'regions', 'stages', 'types', 'statuses', 'meetingTypes'] },
                  name:    { type: 'string' },
                },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          201: { description: 'Tag created.', content: { 'application/json': { schema: { '$ref': '#/components/schemas/TagItem' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },

    '/search': {
      get: {
        summary: 'Cross-entity search (dedupe)',
        operationId: 'search',
        tags: ['Search'],
        security: [{ bearerAuth: ['crm:read'] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 }, description: 'Search term. Matches company names and contact name/email.' },
        ],
        responses: {
          200: {
            description: 'Matched companies and contacts.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    q:         { type: 'string' },
                    companies: { type: 'array', items: { '$ref': '#/components/schemas/Company' } },
                    contacts:  { type: 'array', items: { '$ref': '#/components/schemas/Contact' } },
                    total:     { type: 'integer' },
                  },
                },
              },
            },
          },
          400: { description: 'q too short.' },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
    },
  },

  tags: [
    { name: 'Companies',    description: 'Portfolio companies, funds, and investors.' },
    { name: 'Contacts',     description: 'People linked to companies.' },
    { name: 'Meetings',     description: 'Meetings with participants.' },
    { name: 'Interactions', description: 'Interaction logs (calls, emails, notes).' },
    { name: 'Tags',         description: 'Tag catalogs: industries, regions, stages, types, statuses, meeting types.' },
    { name: 'Search',       description: 'Cross-entity search for deduplication.' },
  ],
}

export function GET() {
  return NextResponse.json(spec, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
}
