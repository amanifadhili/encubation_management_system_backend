import Joi from 'joi';

// Common validation patterns
const objectIdPattern = /^[a-fA-F0-9]{25}$/; // CUID pattern
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// User roles enum
const userRoles = ['director', 'manager', 'mentor', 'incubator'];
const teamStatuses = ['active', 'pending', 'inactive'];
const projectStatuses = ['active', 'pending', 'completed', 'on_hold'];
const projectCategories = ['Technology', 'Agriculture', 'Health', 'Education', 'Design'];
const inventoryStatuses = ['available', 'low_stock', 'out_of_stock'];
const requestStatuses = ['pending', 'approved', 'declined'];
const messageTypes = ['text', 'file'];
const recipientTypes = ['team', 'user'];
const teamMemberRoles = ['team_leader', 'member'];

// Custom validation functions
const validateObjectId = (value: string, helpers: Joi.CustomHelpers) => {
  if (!objectIdPattern.test(value)) {
    return helpers.error('string.pattern.base', { pattern: 'CUID format' });
  }
  return value;
};

const validateEmail = (value: string, helpers: Joi.CustomHelpers) => {
  if (!emailPattern.test(value)) {
    return helpers.error('string.pattern.base', { pattern: 'email format' });
  }
  return value;
};

const validatePassword = (value: string, helpers: Joi.CustomHelpers) => {
  if (!passwordPattern.test(value)) {
    return helpers.error('string.pattern.base', {
      pattern: 'at least 8 characters with uppercase, lowercase, number, and special character'
    });
  }
  return value;
};

// Authentication Schemas
export const authSchemas = {
  login: Joi.object({
    email: Joi.string()
      .required()
      .custom(validateEmail)
      .messages({
        'string.empty': 'Email is required',
        'any.required': 'Email is required',
        'string.pattern.base': 'Please enter a valid email address'
      }),

    password: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is required'
      })
  }),

  register: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),

    email: Joi.string()
      .required()
      .custom(validateEmail)
      .messages({
        'string.empty': 'Email is required',
        'any.required': 'Email is required',
        'string.pattern.base': 'Please enter a valid email address'
      }),

    password: Joi.string()
      .required()
      .custom(validatePassword)
      .messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is required',
        'string.pattern.base': 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      }),

    role: Joi.string()
      .valid(...userRoles)
      .required()
      .messages({
        'any.only': `Role must be one of: ${userRoles.join(', ')}`,
        'any.required': 'Role is required'
      }),

    teamId: Joi.string()
      .custom(validateObjectId)
      .when('role', {
        is: 'incubator',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.required': 'Team ID is required for incubator role',
        'string.pattern.base': 'Invalid team ID format'
      })
  })
};

// Team Schemas
export const teamSchemas = {
  create: Joi.object({
    team_name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.empty': 'Team name is required',
        'string.min': 'Team name must be at least 2 characters',
        'string.max': 'Team name cannot exceed 100 characters',
        'any.required': 'Team name is required'
      }),

    company_name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.min': 'Company name must be at least 2 characters',
        'string.max': 'Company name cannot exceed 100 characters'
      }),

    status: Joi.string()
      .valid(...teamStatuses)
      .default('pending')
      .messages({
        'any.only': `Status must be one of: ${teamStatuses.join(', ')}`
      }),

    credentials: Joi.object({
      email: Joi.string()
        .required()
        .custom(validateEmail)
        .messages({
          'string.empty': 'Team email is required',
          'any.required': 'Team email is required',
          'string.pattern.base': 'Please enter a valid email address'
        }),

      password: Joi.string()
        .required()
        .custom(validatePassword)
        .messages({
          'string.empty': 'Team password is required',
          'any.required': 'Team password is required',
          'string.pattern.base': 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        })
    }).required()
  }),

  update: Joi.object({
    team_name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.min': 'Team name must be at least 2 characters',
        'string.max': 'Team name cannot exceed 100 characters'
      }),

    company_name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.min': 'Company name must be at least 2 characters',
        'string.max': 'Company name cannot exceed 100 characters'
      }),

    status: Joi.string()
      .valid(...teamStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${teamStatuses.join(', ')}`
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  }),

  addMember: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.empty': 'Member name is required',
        'string.min': 'Member name must be at least 2 characters',
        'string.max': 'Member name cannot exceed 100 characters',
        'any.required': 'Member name is required'
      }),

    email: Joi.string()
      .required()
      .custom(validateEmail)
      .messages({
        'string.empty': 'Member email is required',
        'any.required': 'Member email is required',
        'string.pattern.base': 'Please enter a valid email address'
      }),

    role: Joi.string()
      .valid(...teamMemberRoles)
      .default('member')
      .messages({
        'any.only': `Role must be one of: ${teamMemberRoles.join(', ')}`
      })
  })
};

// Project Schemas
export const projectSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .required()
      .messages({
        'string.empty': 'Project name is required',
        'string.min': 'Project name must be at least 2 characters',
        'string.max': 'Project name cannot exceed 200 characters',
        'any.required': 'Project name is required'
      }),

    description: Joi.string()
      .max(1000)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),

    category: Joi.string()
      .valid(...projectCategories)
      .required()
      .messages({
        'any.only': `Category must be one of: ${projectCategories.join(', ')}`,
        'any.required': 'Category is required'
      }),

    status: Joi.string()
      .valid(...projectStatuses)
      .default('pending')
      .messages({
        'any.only': `Status must be one of: ${projectStatuses.join(', ')}`
      }),

    progress: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .default(0)
      .messages({
        'number.base': 'Progress must be a number',
        'number.min': 'Progress cannot be less than 0',
        'number.max': 'Progress cannot exceed 100'
      })
  }),

  update: Joi.object({
    name: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .optional()
      .messages({
        'string.min': 'Project name must be at least 2 characters',
        'string.max': 'Project name cannot exceed 200 characters'
      }),

    description: Joi.string()
      .max(1000)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),

    category: Joi.string()
      .valid(...projectCategories)
      .optional()
      .messages({
        'any.only': `Category must be one of: ${projectCategories.join(', ')}`
      }),

    status: Joi.string()
      .valid(...projectStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${projectStatuses.join(', ')}`
      }),

    progress: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .optional()
      .messages({
        'number.base': 'Progress must be a number',
        'number.min': 'Progress cannot be less than 0',
        'number.max': 'Progress cannot exceed 100'
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

// Mentor Schemas
export const mentorSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.empty': 'Mentor name is required',
        'string.min': 'Mentor name must be at least 2 characters',
        'string.max': 'Mentor name cannot exceed 100 characters',
        'any.required': 'Mentor name is required'
      }),

    email: Joi.string()
      .required()
      .custom(validateEmail)
      .messages({
        'string.empty': 'Mentor email is required',
        'any.required': 'Mentor email is required',
        'string.pattern.base': 'Please enter a valid email address'
      }),

    expertise: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.min': 'Expertise must be at least 2 characters',
        'string.max': 'Expertise cannot exceed 200 characters'
      }),

    phone: Joi.string()
      .pattern(/^[\+]?[1-9][\d]{0,15}$/)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'Please enter a valid phone number'
      })
  }),

  update: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.min': 'Mentor name must be at least 2 characters',
        'string.max': 'Mentor name cannot exceed 100 characters'
      }),

    email: Joi.string()
      .custom(validateEmail)
      .optional()
      .messages({
        'string.pattern.base': 'Please enter a valid email address'
      }),

    expertise: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.min': 'Expertise must be at least 2 characters',
        'string.max': 'Expertise cannot exceed 200 characters'
      }),

    phone: Joi.string()
      .pattern(/^[\+]?[1-9][\d]{0,15}$/)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'Please enter a valid phone number'
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  }),

  assign: Joi.object({
    team_id: Joi.string()
      .required()
      .custom(validateObjectId)
      .messages({
        'string.empty': 'Team ID is required',
        'any.required': 'Team ID is required',
        'string.pattern.base': 'Invalid team ID format'
      })
  })
};

// Inventory Schemas
export const inventorySchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .required()
      .messages({
        'string.empty': 'Item name is required',
        'string.min': 'Item name must be at least 2 characters',
        'string.max': 'Item name cannot exceed 200 characters',
        'any.required': 'Item name is required'
      }),

    description: Joi.string()
      .max(500)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),

    total_quantity: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.base': 'Total quantity must be a number',
        'number.min': 'Total quantity cannot be negative'
      }),

    available_quantity: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.base': 'Available quantity must be a number',
        'number.min': 'Available quantity cannot be negative'
      }),

    status: Joi.string()
      .valid(...inventoryStatuses)
      .default('available')
      .messages({
        'any.only': `Status must be one of: ${inventoryStatuses.join(', ')}`
      })
  }),

  update: Joi.object({
    name: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .optional()
      .messages({
        'string.min': 'Item name must be at least 2 characters',
        'string.max': 'Item name cannot exceed 200 characters'
      }),

    description: Joi.string()
      .max(500)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),

    total_quantity: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.base': 'Total quantity must be a number',
        'number.min': 'Total quantity cannot be negative'
      }),

    available_quantity: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.base': 'Available quantity must be a number',
        'number.min': 'Available quantity cannot be negative'
      }),

    status: Joi.string()
      .valid(...inventoryStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${inventoryStatuses.join(', ')}`
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  }),

  assign: Joi.object({
    team_id: Joi.string()
      .required()
      .custom(validateObjectId)
      .messages({
        'string.empty': 'Team ID is required',
        'any.required': 'Team ID is required',
        'string.pattern.base': 'Invalid team ID format'
      }),

    quantity: Joi.number()
      .integer()
      .min(1)
      .required()
      .messages({
        'number.base': 'Quantity must be a number',
        'number.min': 'Quantity must be at least 1',
        'any.required': 'Quantity is required'
      })
  })
};

// Material Request Schemas
export const requestSchemas = {
  create: Joi.object({
    item_name: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .required()
      .messages({
        'string.empty': 'Item name is required',
        'string.min': 'Item name must be at least 2 characters',
        'string.max': 'Item name cannot exceed 200 characters',
        'any.required': 'Item name is required'
      }),

    description: Joi.string()
      .max(500)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      })
  }),

  updateStatus: Joi.object({
    status: Joi.string()
      .valid(...requestStatuses)
      .required()
      .messages({
        'any.only': `Status must be one of: ${requestStatuses.join(', ')}`,
        'any.required': 'Status is required'
      }),

    notes: Joi.string()
      .max(500)
      .trim()
      .optional()
      .allow('')
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      })
  })
};

// Message Schemas
export const messageSchemas = {
  create: Joi.object({
    conversation_id: Joi.string()
      .required()
      .custom(validateObjectId)
      .messages({
        'string.empty': 'Conversation ID is required',
        'any.required': 'Conversation ID is required',
        'string.pattern.base': 'Invalid conversation ID format'
      }),

    content: Joi.string()
      .min(1)
      .max(1000)
      .trim()
      .required()
      .messages({
        'string.empty': 'Message content is required',
        'string.min': 'Message content cannot be empty',
        'string.max': 'Message content cannot exceed 1000 characters',
        'any.required': 'Message content is required'
      }),

    message_type: Joi.string()
      .valid(...messageTypes)
      .default('text')
      .messages({
        'any.only': `Message type must be one of: ${messageTypes.join(', ')}`
      }),

    file_path: Joi.string()
      .max(500)
      .when('message_type', {
        is: 'file',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'string.max': 'File path cannot exceed 500 characters',
        'any.required': 'File path is required for file messages'
      })
  }),

  createConversation: Joi.object({
    participants: Joi.array()
      .items(Joi.string().custom(validateObjectId))
      .min(2)
      .max(50)
      .required()
      .messages({
        'array.min': 'Conversation must have at least 2 participants',
        'array.max': 'Conversation cannot have more than 50 participants',
        'any.required': 'Participants are required',
        'string.pattern.base': 'Invalid participant ID format'
      })
  })
};

// Notification Schemas
export const notificationSchemas = {
  create: Joi.object({
    title: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .required()
      .messages({
        'string.empty': 'Notification title is required',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Notification title is required'
      }),

    message: Joi.string()
      .min(2)
      .max(1000)
      .trim()
      .required()
      .messages({
        'string.empty': 'Notification message is required',
        'string.min': 'Message must be at least 2 characters',
        'string.max': 'Message cannot exceed 1000 characters',
        'any.required': 'Notification message is required'
      }),

    recipient_type: Joi.string()
      .valid(...recipientTypes)
      .required()
      .messages({
        'any.only': `Recipient type must be one of: ${recipientTypes.join(', ')}`,
        'any.required': 'Recipient type is required'
      }),

    recipient_id: Joi.string()
      .required()
      .custom(validateObjectId)
      .messages({
        'string.empty': 'Recipient ID is required',
        'any.required': 'Recipient ID is required',
        'string.pattern.base': 'Invalid recipient ID format'
      })
  })
};

// Announcement Schemas
export const announcementSchemas = {
  create: Joi.object({
    title: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .required()
      .messages({
        'string.empty': 'Announcement title is required',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Announcement title is required'
      }),

    content: Joi.string()
      .min(10)
      .max(5000)
      .trim()
      .required()
      .messages({
        'string.empty': 'Announcement content is required',
        'string.min': 'Content must be at least 10 characters',
        'string.max': 'Content cannot exceed 5000 characters',
        'any.required': 'Announcement content is required'
      })
  }),

  update: Joi.object({
    title: Joi.string()
      .min(2)
      .max(200)
      .trim()
      .optional()
      .messages({
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 200 characters'
      }),

    content: Joi.string()
      .min(10)
      .max(5000)
      .trim()
      .optional()
      .messages({
        'string.min': 'Content must be at least 10 characters',
        'string.max': 'Content cannot exceed 5000 characters'
      })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

// Upload Schemas
export const uploadSchemas = {
  search: Joi.object({
    q: Joi.string()
      .min(1)
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.min': 'Search query must be at least 1 character',
        'string.max': 'Search query cannot exceed 100 characters'
      }),

    project_id: Joi.string()
      .custom(validateObjectId)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid project ID format'
      }),

    file_type: Joi.string()
      .valid('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
             'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .optional()
      .messages({
        'any.only': 'Invalid file type'
      })
  }),

  batchDelete: Joi.object({
    file_ids: Joi.array()
      .items(Joi.string().custom(validateObjectId))
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one file ID must be provided',
        'array.max': 'Cannot delete more than 50 files at once',
        'any.required': 'File IDs are required',
        'string.pattern.base': 'Invalid file ID format'
      })
  })
};

// Query Parameter Schemas
export const querySchemas = {
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.min': 'Page must be at least 1'
      }),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      })
  }),

  teamFilters: Joi.object({
    status: Joi.string()
      .valid(...teamStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${teamStatuses.join(', ')}`
      }),

    search: Joi.string()
      .min(1)
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.min': 'Search query must be at least 1 character',
        'string.max': 'Search query cannot exceed 100 characters'
      })
  }),

  projectFilters: Joi.object({
    category: Joi.string()
      .valid(...projectCategories)
      .optional()
      .messages({
        'any.only': `Category must be one of: ${projectCategories.join(', ')}`
      }),

    status: Joi.string()
      .valid(...projectStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${projectStatuses.join(', ')}`
      }),

    team_id: Joi.string()
      .custom(validateObjectId)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid team ID format'
      }),

    search: Joi.string()
      .min(1)
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.min': 'Search query must be at least 1 character',
        'string.max': 'Search query cannot exceed 100 characters'
      })
  }),

  reportFilters: Joi.object({
    category: Joi.string()
      .valid(...projectCategories)
      .optional()
      .messages({
        'any.only': `Category must be one of: ${projectCategories.join(', ')}`
      }),

    status: Joi.string()
      .valid(...teamStatuses)
      .optional()
      .messages({
        'any.only': `Status must be one of: ${teamStatuses.join(', ')}`
      }),

    start_date: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Start date must be in ISO format'
      }),

    end_date: Joi.date()
      .iso()
      .when('start_date', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('start_date')).messages({
          'date.greater': 'End date must be after start date'
        })
      })
      .optional()
      .messages({
        'date.format': 'End date must be in ISO format'
      })
  })
};

// Validation middleware function
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
        code: 'VALIDATION_ERROR'
      });
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Query validation middleware
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors,
        code: 'QUERY_VALIDATION_ERROR'
      });
    }

    // Replace request query with validated and sanitized data
    req.query = value;
    next();
  };
};

// Parameter validation middleware
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Parameter validation failed',
        errors,
        code: 'PARAM_VALIDATION_ERROR'
      });
    }

    // Replace request params with validated and sanitized data
    req.params = value;
    next();
  };
};