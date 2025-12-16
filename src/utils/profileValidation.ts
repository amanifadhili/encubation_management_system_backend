import Joi from 'joi';

// Profile-related constants
// Match Prisma enum values exactly (case-sensitive)
const enrollmentStatuses = ['CurrentlyEnrolled', 'Graduated', 'OnLeave', 'Other'];
const currentRoles = ['ProjectLead', 'Employee', 'FounderCoFounder', 'AttendsWorkshopsOnly', 'Other'];

// Phone validation pattern (international format)
const phonePattern = /^\+?[1-9]\d{1,14}$/;

// Profile Validation Schemas
export const profileSchemas = {
  // Phase 1: Essential Information
  phase1Basic: Joi.object({
    first_name: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.empty': 'First name is required',
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 50 characters',
        'any.required': 'First name is required'
      }),

    middle_name: Joi.string()
      .min(1)
      .max(50)
      .trim()
      .optional()
      .allow('', null)
      .messages({
        'string.min': 'Middle name must be at least 1 character',
        'string.max': 'Middle name cannot exceed 50 characters'
      }),

    last_name: Joi.string()
      .min(2)
      .max(50)
      .trim()
      .required()
      .messages({
        'string.empty': 'Last name is required',
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 50 characters',
        'any.required': 'Last name is required'
      }),

    phone: Joi.string()
      .pattern(phonePattern)
      .required()
      .messages({
        'string.empty': 'Phone number is required',
        'string.pattern.base': 'Please enter a valid phone number (international format, e.g., +250123456789)',
        'any.required': 'Phone number is required'
      }),

    profile_photo_url: Joi.string()
      .uri()
      .max(500)
      .optional()
      .allow('', null)
      .messages({
        'string.uri': 'Profile photo URL must be a valid URL',
        'string.max': 'Profile photo URL cannot exceed 500 characters'
      })
  }),

  // Phase 2: Academic Profile
  phase2Academic: Joi.object({
    enrollment_status: Joi.string()
      .valid(...enrollmentStatuses)
      .required()
      .messages({
        'any.only': `Enrollment status must be one of: ${enrollmentStatuses.join(', ')}`,
        'any.required': 'Enrollment status is required'
      }),

    major_program: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.empty': 'Major/Program of study is required',
        'string.min': 'Major/Program must be at least 2 characters',
        'string.max': 'Major/Program cannot exceed 100 characters',
        'any.required': 'Major/Program of study is required'
      }),

    program_of_study: Joi.string()
      .min(2)
      .max(100)
      .trim()
      .required()
      .messages({
        'string.empty': 'Program of study is required',
        'string.min': 'Program of study must be at least 2 characters',
        'string.max': 'Program of study cannot exceed 100 characters',
        'any.required': 'Program of study is required'
      }),

    graduation_year: Joi.number()
      .integer()
      .min(1900)
      .max(new Date().getFullYear() + 10)
      .required()
      .messages({
        'number.base': 'Graduation year must be a number',
        'number.min': 'Graduation year must be after 1900',
        'number.max': `Graduation year cannot be more than ${new Date().getFullYear() + 10}`,
        'any.required': 'Graduation year is required'
      })
  }),

  // Phase 3: Professional Profile
  phase3Professional: Joi.object({
    current_role: Joi.string()
      .valid(...currentRoles)
      .required()
      .messages({
        'any.only': `Current role must be one of: ${currentRoles.join(', ')}`,
        'any.required': 'Current role is required'
      }),

    skills: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim()).min(1),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
            return helpers.error('array.min');
          } catch {
            return helpers.error('array.base');
          }
        })
      )
      .required()
      .messages({
        'array.min': 'Please select at least one skill',
        'array.base': 'Skills must be an array',
        'any.required': 'Skills are required'
      }),

    support_interests: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim()).min(1),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
            return helpers.error('array.min');
          } catch {
            return helpers.error('array.base');
          }
        })
      )
      .required()
      .messages({
        'array.min': 'Please select at least one support interest',
        'array.base': 'Support interests must be an array',
        'any.required': 'Support interests are required'
      })
  }),

  // Phase 5: Additional Information
  phase5Additional: Joi.object({
    additional_notes: Joi.string()
      .max(5000)
      .trim()
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Additional notes cannot exceed 5000 characters'
      })
  }),

  // Profile Photo Upload
  photoUpload: Joi.object({
    profile_photo_url: Joi.string()
      .uri()
      .max(500)
      .required()
      .messages({
        'string.uri': 'Profile photo URL must be a valid URL',
        'string.max': 'Profile photo URL cannot exceed 500 characters',
        'any.required': 'Profile photo URL is required'
      })
  })
};

